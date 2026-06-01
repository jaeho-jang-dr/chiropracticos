"""
For each MD file, wrap the first occurrence of each medical abbreviation
in <abbr class="med-abbr" title="...">X</abbr>. Subsequent occurrences left as-is.

Skips matches inside fenced code blocks (```), inline code (`...`),
HTML comments (<!--...-->), URLs, and existing abbr wrappers.
"""
import re
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# Abbreviation -> title (full name · Korean meaning)
ABBR: dict[str, str] = {
    "CNS": "Central Nervous System · 중추신경계 (뇌 + 척수)",
    "PNS": "Peripheral Nervous System · 말초신경계 (뇌·척수 외 모든 신경)",
    "ANS": "Autonomic Nervous System · 자율신경계 (교감·부교감)",
    "FN": "Functional Neurology · 기능 신경학",
    "EBM": "Evidence-Based Medicine · 근거 기반 의학",
    "VOR": "Vestibulo-Ocular Reflex · 전정안반사 — 머리 회전 시 망막상 안정화 반사",
    "VSR": "Vestibulospinal Reflex · 전정척수반사 — 자세·균형 유지",
    "VCR": "Vestibulocollic Reflex · 전정경부반사 — 머리 안정화",
    "MLF": "Medial Longitudinal Fasciculus · 내측세로다발 — 동안신경·외전신경 핵을 잇는 백질",
    "PPRF": "Paramedian Pontine Reticular Formation · 곁정중교뇌그물체 (수평 응시 중추)",
    "FEF": "Frontal Eye Field · 전두안구야 (수의적 안구운동 중추)",
    "PAG": "Periaqueductal Gray · 수도주위회백질 (내인성 통증 조절)",
    "RVM": "Rostral Ventromedial Medulla · 입쪽 배내측 연수 (하행 통증 억제)",
    "ARAS": "Ascending Reticular Activating System · 상행망상활성계 (각성·의식)",
    "RAS": "Reticular Activating System · 망상활성계",
    "BPPV": "Benign Paroxysmal Positional Vertigo · 양성돌발성체위현훈 (이석 이탈)",
    "HINTS": "Head Impulse · Nystagmus · Test of Skew — 급성현훈 3종 검사 (말초 vs 중추 감별)",
    "AVS": "Acute Vestibular Syndrome · 급성전정증후군",
    "VBI": "Vertebrobasilar Insufficiency · 척추기저동맥부전",
    "HIT": "Head Impulse Test · 두부충동검사 (Halmagyi)",
    "DVA": "Dynamic Visual Acuity · 동적시력 (VOR 기능 정량)",
    "INO": "Internuclear Ophthalmoplegia · 핵간안근마비 (MLF 병변)",
    "SCC": "Semicircular Canal · 반고리관",
    "VOMS": "Vestibular/Ocular Motor Screening · 전정-안구운동 선별검사 (Mucha 2014)",
    "BESS": "Balance Error Scoring System · 균형 오류 채점 시스템",
    "DHI": "Dizziness Handicap Inventory · 어지럼장애지수 (0-100, ≥18 변화 = MCID)",
    "NPRS": "Numeric Pain Rating Scale · 숫자통증등급 (0-10)",
    "VAS": "Visual Analog Scale · 시각 아날로그 척도",
    "PCSS": "Post-Concussion Symptom Scale · 뇌진탕 후 증상 척도",
    "RPQ": "Rivermead Post-Concussion Symptoms Questionnaire",
    "MCID": "Minimal Clinically Important Difference · 최소 임상적 의미 차이",
    "CPG": "Clinical Practice Guideline · 임상진료지침",
    "RCT": "Randomized Controlled Trial · 무작위대조군시험",
    "MS": "Multiple Sclerosis · 다발성경화증",
    "TBI": "Traumatic Brain Injury · 외상성 뇌손상",
    "mTBI": "mild Traumatic Brain Injury · 경도 외상성 뇌손상 (뇌진탕)",
    "MRI": "Magnetic Resonance Imaging · 자기공명영상",
    "EMG": "Electromyography · 근전도 검사",
    "fMRI": "functional Magnetic Resonance Imaging · 기능적 자기공명영상",
    "EEG": "Electroencephalography · 뇌파 검사",
    "tDCS": "transcranial Direct Current Stimulation · 경두개 직류 자극",
    "TMS": "Transcranial Magnetic Stimulation · 경두개 자기 자극",
    "ACNB": "American Chiropractic Neurology Board · 미국 카이로프랙틱 신경학 위원회",
    "DACNB": "Diplomate of American Chiropractic Neurology Board · 미국 카이로프랙틱 신경학 전문의",
    # SR/MR/LR/SO/IR/IO는 Ch 2 안에서만 안구 근육 의미로 적용 (다른 챕터에선 SR=Systematic Review, MR=저자 이니셜 등 충돌)
    # → 자동 사전에서 제외하고 Ch 2 lecture MD에 별도 처리
    "CN III": "Cranial Nerve III · 3번 뇌신경 — Oculomotor (동안신경)",
    "CN IV": "Cranial Nerve IV · 4번 뇌신경 — Trochlear (활차신경)",
    "CN VI": "Cranial Nerve VI · 6번 뇌신경 — Abducens (외전신경)",
    "CN VII": "Cranial Nerve VII · 7번 뇌신경 — Facial (안면신경)",
    # ─── 일반 카이로프랙틱·정형 ───
    "DC": "Doctor of Chiropractic · 카이로프랙틱 의사 학위",
    "HVLA": "High-Velocity Low-Amplitude · 고속·저진폭 수기 교정",
    "SMT": "Spinal Manipulative Therapy · 척추 도수 치료",
    "ROM": "Range of Motion · 관절가동범위",
    "LBP": "Low Back Pain · 요통",
    "CLBP": "Chronic Low Back Pain · 만성 요통",
    "NDI": "Neck Disability Index · 경부장애지수 (0-50)",
    "ODI": "Oswestry Disability Index · Oswestry 요통 장애지수 (0-100)",
    "HEP": "Home Exercise Program · 가정 운동 프로그램",
    "ADL": "Activities of Daily Living · 일상생활동작",
    "DDD": "Degenerative Disc Disease · 추간판 변성증",
    "DJD": "Degenerative Joint Disease · 관절 변성증",
    "OA": "Osteoarthritis · 골관절염",
    "RA": "Rheumatoid Arthritis · 류마티스 관절염",
    "NSAID": "Non-Steroidal Anti-Inflammatory Drug · 비스테로이드성 소염진통제",
    "PSIS": "Posterior Superior Iliac Spine · 후상장골극",
    "ASIS": "Anterior Superior Iliac Spine · 전상장골극",
    "HNP": "Herniated Nucleus Pulposus · 추간판 탈출증",
    "CTS": "Carpal Tunnel Syndrome · 수근관 증후군",
    "TOS": "Thoracic Outlet Syndrome · 흉곽출구 증후군",
    "FBSS": "Failed Back Surgery Syndrome · 척추수술 실패 증후군",
    "DEXA": "Dual-Energy X-ray Absorptiometry · 이중에너지 X선 흡수계측 (골밀도)",
    # ─── Gonstead listings (Ch 4) ───
    "PLS": "Posterior-Left-Superior · Gonstead listing 후-좌-상",
    "PRS": "Posterior-Right-Superior · Gonstead listing 후-우-상",
    "PLI": "Posterior-Left-Inferior · Gonstead listing 후-좌-하",
    "PRI": "Posterior-Right-Inferior · Gonstead listing 후-우-하",
    # ─── Toggle Recoil / 상부경추 (Ch 5) ───
    "HIO": "Hole-In-One · B.J. Palmer 상부경추 단일 교정 이론 (Toggle Recoil)",
    "ASR": "Atlas Superior Right · C1 상-우 listing",
    "ASL": "Atlas Superior Left · C1 상-좌 listing",
    # ─── Activator (Ch 7) ───
    "AMCT": "Activator Methods Chiropractic Technique · 액티베이터 카이로프랙틱 기법",
    # ─── Cox (Ch 8) ───
    "FDM": "Flexion-Distraction Manipulation · 굴곡-신연 수기 (Cox)",
    # ─── SOT (Ch 10) ───
    "SOT": "Sacro-Occipital Technique · 천골-후두 기법 (DeJarnette)",
    "CMRT": "Chiropractic Manipulative Reflex Technique · 카이로프랙틱 수기 반사 기법",
    # ─── CBP (Ch 11) ───
    "CBP": "Chiropractic BioPhysics · 카이로프랙틱 바이오피직스 (자세·구조 교정)",
    "NHP": "Normal Head Posture · 정상 두부 자세",
    "AHT": "Anterior Head Translation · 전방 두부 변위",
    "ETT": "Extension Traction Therapy · 신전 견인 치료",
    # ─── AK (Ch 12) ───
    "AK": "Applied Kinesiology · 응용 운동학 (George Goodheart, 1964)",
    "MMT": "Manual Muscle Testing · 도수 근력 검사",
    "TL": "Therapy Localization · 치료 위치화 (AK)",
    "IRT": "Injury Recall Technique · 손상 회상 기법 (AK)",
}

# Process longer/specific abbrs first to avoid CN VI being matched inside CN VII, etc.
ORDERED = sorted(ABBR.keys(), key=lambda k: (-len(k), k))


def make_pattern(abbr: str) -> re.Pattern:
    # Use lookbehind/lookahead so we don't match inside other words.
    # Boundary chars: not letter, digit, underscore, or another abbr-relevant char.
    # Python \b works because Hangul chars aren't in \w.
    if " " in abbr:
        # multi-word: escape and use boundaries on first/last word
        return re.compile(r'(?<![A-Za-z0-9])' + re.escape(abbr) + r'(?![A-Za-z0-9])')
    return re.compile(r'(?<![A-Za-z0-9])' + re.escape(abbr) + r'(?![A-Za-z0-9])')


def mask_excluded_regions(text: str) -> tuple[str, list[tuple[int, int, str]]]:
    """Replace excluded regions (code blocks, inline code, HTML comments, URLs,
    existing abbr tags, image tags, link URLs) with placeholders so abbrs inside
    them are not matched. Returns masked text + restoration map."""
    placeholders: list[tuple[int, int, str]] = []

    patterns = [
        re.compile(r'```.*?```', re.DOTALL),                  # fenced code
        re.compile(r'`[^`\n]+`'),                              # inline code
        re.compile(r'<!--.*?-->', re.DOTALL),                  # HTML comments
        re.compile(r'<style\b[^>]*>.*?</style>', re.DOTALL),   # <style> blocks
        re.compile(r'<script\b[^>]*>.*?</script>', re.DOTALL), # <script> blocks
        re.compile(r'<abbr\b[^>]*>.*?</abbr>', re.DOTALL),     # existing abbr (avoid double-wrap)
        re.compile(r'<[^>]+>'),                                 # any HTML tag (incl. attr values)
        re.compile(r'https?://\S+'),                           # bare URLs in text
        re.compile(r'!\[[^\]]*\]\([^)]+\)'),                   # markdown images
        re.compile(r'\[[^\]]*\]\([^)]+\)'),                    # markdown links
    ]

    spans: list[tuple[int, int]] = []
    for pat in patterns:
        for m in pat.finditer(text):
            spans.append((m.start(), m.end()))

    spans.sort()
    # Merge overlapping
    merged: list[tuple[int, int]] = []
    for s, e in spans:
        if merged and s < merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))

    # Build masked string with sentinels
    out: list[str] = []
    last = 0
    for i, (s, e) in enumerate(merged):
        out.append(text[last:s])
        sentinel = f"\x00MASK{i:05d}\x00"
        out.append(sentinel)
        placeholders.append((i, e - s, text[s:e]))
        last = e
    out.append(text[last:])
    return "".join(out), placeholders


def unmask(text: str, placeholders: list[tuple[int, int, str]]) -> str:
    for i, _, original in placeholders:
        sentinel = f"\x00MASK{i:05d}\x00"
        text = text.replace(sentinel, original, 1)
    return text


def wrap_first(text: str) -> tuple[str, dict]:
    masked, placeholders = mask_excluded_regions(text)
    counts: dict[str, int] = {}

    for abbr in ORDERED:
        title = ABBR[abbr]
        pat = make_pattern(abbr)
        m = pat.search(masked)
        if m:
            replacement = f'<abbr class="med-abbr" title="{title}">{abbr}</abbr>'
            # Replace only first match
            masked = masked[:m.start()] + replacement + masked[m.end():]
            counts[abbr] = 1

    return unmask(masked, placeholders), counts


def main(paths: list[str]) -> None:
    for p in paths:
        path = Path(p)
        if not path.exists():
            print(f"SKIP (not found): {p}")
            continue
        text = path.read_text(encoding="utf-8")
        new_text, counts = wrap_first(text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            print(f"\n{path.name}: wrapped {len(counts)} abbrs")
            for name in sorted(counts.keys()):
                print(f"  + {name}")
        else:
            print(f"{path.name}: no abbrs found")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python wrap_abbr_first.py <file1.md> [file2.md ...]")
        sys.exit(1)
    main(sys.argv[1:])
