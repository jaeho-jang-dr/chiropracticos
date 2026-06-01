"""
Remove 한의학·추나 references from all HTML/MD files under G:/내 드라이브/chiropracticos/.

Strategy:
1. Line-level deletions: remove entire lines that exist solely to reference 한의학/추나 (ToC entries,
   table rows, list items, references).
2. Inline substitutions: strip forbidden tokens from sentences that carry other meaning,
   replacing with neutral equivalents where appropriate.
3. Block-level deletions: for entire sections devoted to 한의학/추나 content, drop the section.

Writes a .bak alongside each modified file on first run for safety.
Outputs a summary of changes applied to each file.
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(r"G:\내 드라이브\chiropracticos")
BACKUP_ROOT = Path(r"D:\Entertainments\DevEnvironment\chiropraticos\_kmd_chuna_backup")


def backup(path: Path):
    rel = path.relative_to(ROOT)
    dst = BACKUP_ROOT / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        shutil.copy2(path, dst)


def write(path: Path, text: str):
    backup(path)
    path.write_text(text, encoding="utf-8")


# ----- HTML chapter files: identical EBM disclaimer line -----
EBM_OLD = (
    "<p>근거 기반 의학(EBM) 관점. Vitalism · 전신질환 인과론 · 한의학 경락 · "
    "AK 진단 확장 · Cranial rhythm 등 No evidence 주장은 🔴 제외 또는 비판적으로만 언급합니다.</p>"
)
EBM_NEW = (
    "<p>근거 기반 의학(EBM) 관점. Vitalism · 전신질환 인과론 · "
    "AK 진단 확장 · Cranial rhythm 등 No evidence 주장은 🔴 제외 또는 비판적으로만 언급합니다.</p>"
)


def clean_chapter_html(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    if EBM_OLD in text:
        new_text = text.replace(EBM_OLD, EBM_NEW)
        write(path, new_text)
        return 1
    return 0


def clean_index_html():
    path = ROOT / "index.html"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 449: "한의학 경락·기(氣)·음양오행 이론 ·" — remove this fragment entirely (likely inside a list)
    text = re.sub(
        r"<li>[^<]*한의학[^<]*경락[^<]*음양오행[^<]*</li>\s*",
        "",
        text,
    )
    # 편집 원칙 single fragment without li wrapper
    text = text.replace("한의학 경락·기(氣)·음양오행 이론 ·", "")
    text = text.replace("한의학 경락·기(氣)·음양오행 이론·", "")
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_chapter01():
    path = ROOT / "chapter01_introduction.html"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 89: "🔴 한의학 경락·기혈 이론 · Cranial rhythm · Visceral manipulation — <strong>제외</strong>"
    text = re.sub(
        r"<li>🔴 한의학 경락·기혈 이론 · Cranial rhythm · Visceral manipulation — <strong>제외</strong></li>",
        "<li>🔴 Cranial rhythm · Visceral manipulation — <strong>제외</strong></li>",
        text,
    )
    # Line 223: same as index.html duplicate
    text = re.sub(
        r"<li>[^<]*한의학[^<]*경락[^<]*음양오행[^<]*</li>\s*",
        "",
        text,
    )
    text = text.replace("한의학 경락·기(氣)·음양오행 이론 ·", "")
    text = text.replace("한의학 경락·기(氣)·음양오행 이론·", "")
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_chapter02_html():
    path = ROOT / "chapter02_functional_neurology.html"
    text = path.read_text(encoding="utf-8")
    original = text
    text = text.replace(
        'Vitalism · "Innate Intelligence" · 한의학 경락 이론 · 측정 불가한 추상 개념은 제외합니다.',
        'Vitalism · "Innate Intelligence" · 측정 불가한 추상 개념은 제외합니다.',
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_chapter03_html():
    path = ROOT / "chapter03_diversified.html"
    text = path.read_text(encoding="utf-8")
    original = text
    text = text.replace(
        "<li>Diversified HVLA를 OMT·MOB·MET·추나 HVLA와 구분해 정의한다</li>",
        "<li>Diversified HVLA를 OMT·MOB·MET와 구분해 정의한다</li>",
    )
    text = text.replace(
        "<li>다학제 협진(MD · PT · DC · KMD) 의뢰 기준</li>",
        "<li>다학제 협진(MD · PT · DC) 의뢰 기준</li>",
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_chapter12_html():
    path = ROOT / "chapter12_ak.html"
    text = path.read_text(encoding="utf-8")
    original = text
    # Remove "/meridian" from 5 IVF factors description, remove 한국 임상 학회 언급
    text = text.replace(
        "Manual Muscle Testing(MMT)과 5 IVF factors(nerve·neurolymphatic/Chapman·neurovascular/Bennett·CSF·meridian). 한국 임상에서 대한응용근신경학회 중심 수용.",
        "Manual Muscle Testing(MMT)과 IVF factors(nerve·neurolymphatic/Chapman·neurovascular/Bennett·CSF). 한국 임상에서도 일부 DC·PT가 수용.",
    )
    if text != original:
        write(path, text)
        return 1
    return 0


# ---------------- MD files ----------------

def clean_diversified_report_week4():
    """diversified/11_report_week4.md — lines 10, 108, 110."""
    path = ROOT / "diversified" / "11_report_week4.md"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 10: "한국적 임상 환경(추나/도수치료)" → "한국적 임상 환경(도수치료)"
    text = text.replace(
        "한국적 임상 환경(추나/도수치료)", "한국적 임상 환경(도수치료)"
    )
    # Line 108: delete the entire 추나요법 bullet (it starts with "*   **추나요법:**")
    text = re.sub(
        r"\*\s+\*\*추나요법:\*\*[^\n]*\n",
        "",
        text,
    )
    # Line 110: "DC, 의사, 한의사, 물리치료사" → "DC, 의사, 물리치료사"
    text = text.replace(
        "DC(카이로프랙틱 의사), 의사, 한의사, 물리치료사",
        "DC(카이로프랙틱 의사), 의사, 물리치료사",
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_ak_lecture():
    path = ROOT / "ak" / "lecture" / "chapter12_ak.md"
    text = path.read_text(encoding="utf-8")
    original = text

    # Line 19 ToC: "9. [한국 임상 맥락 — 대한응용근신경학회](...)" → "9. [한국 임상 맥락](#한국)"
    text = re.sub(
        r"9\.\s+\[한국 임상 맥락[^\]]*\]\(#[^\)]+\)",
        "9. [한국 임상 맥락](#한국)",
        text,
    )

    # Line 58 timeline row: "| 1990s+ | 감정·심리 상태·에너지 경락 진단 |"
    text = re.sub(
        r"\|\s*1990s\+\s*\|\s*감정·심리 상태·에너지 경락 진단\s*\|\n",
        "| 1990s+ | 감정·심리 상태·에너지 진단 확장 |\n",
        text,
    )

    # Line 103 "5. **Acupuncture Meridian** — 한의학 경락"
    # The whole bullet is from AK's "5 IVF Factors" — remove this bullet entirely so we list only 4.
    text = re.sub(
        r"5\.\s+\*\*Acupuncture Meridian\*\*[^\n]*\n",
        "",
        text,
    )
    # Some lists may reference "5 IVF Factors" in text — downgrade to "4 IVF Factors"
    text = text.replace("5 IVF Factors", "IVF Factors")
    text = text.replace("5 IVF factors", "IVF factors")

    # Line 113 table row: "| Acupuncture Meridian | 🔴 **한의학 이론** — 본 강의 제외 원칙 |"
    text = re.sub(
        r"\|\s*Acupuncture Meridian[^\|]*\|[^\|]*\|\n",
        "",
        text,
    )

    # Section heading line 205: "## 한국 임상 맥락 — 대한응용근신경학회 {#한국}"
    text = re.sub(
        r"## 한국 임상 맥락 — 대한응용근신경학회\s*\{#한국\}",
        "## 한국 임상 맥락 {#한국}",
        text,
    )

    # Line 209: "- 한국 일부 DC·한의사·도수치료사가 AK 교육 이수"
    text = text.replace(
        "- 한국 일부 DC·한의사·도수치료사가 AK 교육 이수",
        "- 한국 일부 DC·도수치료사(PT)가 AK 교육 이수",
    )

    # Line 210: "- **대한응용근신경학회 (KAKA)** 등 조직" — delete
    text = re.sub(
        r"^- \*\*대한응용근신경학회[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    # Line 241: "- 5 Factors 중 Meridian·Chapman·Bennett·CSF 관련 확장 주장"
    text = text.replace(
        "- 5 Factors 중 Meridian·Chapman·Bennett·CSF 관련 확장 주장",
        "- Chapman reflex·Bennett neurovascular·CSF 관련 확장 주장",
    )

    # Line 281 reference: "16. 대한응용근신경학회 (KAKA) — 한국 조직" — delete
    text = re.sub(
        r"^\d+\.\s+대한응용근신경학회[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    # Line 285: "17. Kwon YD et al. 한국의 도수치료·추나요법 맥락에서의 MMT 활용 연구."
    text = re.sub(
        r"^\d+\.\s+Kwon YD et al\. 한국의 도수치료·추나요법[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )
    # Line 286: "18. 대한추나의학회 추나요법 표준 교과서 — MMT 관련 부분." — delete
    text = re.sub(
        r"^\d+\.\s+대한추나의학회[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    if text != original:
        write(path, text)
        return 1
    return 0


def clean_sot_lecture():
    path = ROOT / "sot" / "lecture" / "chapter10_sot.md"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 209: replace 한의사 with neutral
    text = text.replace(
        "- 한의사·도수치료사의 **두개천골 요법**은 SOT cranial과 유사하나 **과학적 근거 없음** — 임상 의사결정의 기준으로 쓰면 안 됨",
        "- 도수치료사(PT)의 **두개천골 요법(CST)**은 SOT cranial과 유사하나 **과학적 근거 없음** — 임상 의사결정의 기준으로 쓰면 안 됨",
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_gonstead_lecture():
    path = ROOT / "gonstead" / "lecture" / "chapter04_gonstead.md"
    text = path.read_text(encoding="utf-8")
    original = text

    # Line 336 section header: "### 추나·도수치료와의 관계" → remove whole section until next "### " or "## "
    # Locate and strip the block
    pattern = re.compile(
        r"### 추나·도수치료와의 관계\n.*?(?=\n###|\n##|\Z)",
        re.DOTALL,
    )
    text = pattern.sub("", text)

    # Line 345 급여 line (may have escaped the block removal — belt-and-suspenders):
    text = re.sub(
        r"^- 급여: 추나요법\(한의사\)[^\n]*\n",
        "- 급여: 도수치료(비급여/실손)\n",
        text,
        flags=re.MULTILINE,
    )

    # Line 395 reference: delete
    text = re.sub(
        r"^\d+\.\s+대한추나의학회[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    if text != original:
        write(path, text)
        return 1
    return 0


def clean_fn_lecture():
    path = ROOT / "functional_neurology" / "lecture" / "chapter02_functional_neurology.md"
    text = path.read_text(encoding="utf-8")
    original = text

    # Line 7 editorial principle: replace "한의학 이론·" with nothing
    text = text.replace(
        "Vitalism·생기론·한의학 이론·측정 불가능한 추상 개념 전면 제외",
        "Vitalism·생기론·측정 불가능한 추상 개념 전면 제외",
    )

    # ToC line 100: "9.2 도수치료·추나 현장에서의 Assessment 통합"
    text = text.replace(
        "9.2 도수치료·추나 현장에서의 Assessment 통합",
        "9.2 도수치료 현장에서의 Assessment 통합",
    )
    # ToC line 113: "10.10 한국 임상·추나·도수치료 문헌"
    text = text.replace(
        "10.10 한국 임상·추나·도수치료 문헌",
        "10.10 한국 임상·도수치료 문헌",
    )
    # Anchors using "추나" need to be cleaned too if they exist as IDs
    text = text.replace(
        "#92-도수치료추나-현장에서의-assessment-통합",
        "#92-도수치료-현장에서의-assessment-통합",
    )
    text = text.replace(
        "#1010-한국-임상추나도수치료-문헌",
        "#1010-한국-임상도수치료-문헌",
    )

    # Section heading line 969
    text = text.replace(
        "## 9.2 도수치료·추나 현장에서의 Assessment 통합",
        "## 9.2 도수치료 현장에서의 Assessment 통합",
    )
    # Section heading line 1045
    text = text.replace(
        "## 10.10 한국 임상·추나·도수치료 문헌",
        "## 10.10 한국 임상·도수치료 문헌",
    )

    # Reference lines: delete 대한추나 / Chuna manual medicine lines
    text = re.sub(
        r"^\d+\.\s+대한추나의학회[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(
        r"^\d+\.\s+An introduction to Chuna manual medicine[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    if text != original:
        write(path, text)
        return 1
    return 0


def clean_fn_v2_part1():
    path = ROOT / "functional_neurology" / "v2" / "08_report_part1.md"
    text = path.read_text(encoding="utf-8")
    original = text
    text = text.replace(
        "🔴 **제외 원칙:** 경락, 기혈, 두개천골 요법(CST), 내장 교정, AK(Applied Kinesiology) 진단법 등 과학적 근거가 부족하거나 생리학적 기전이 입증되지 않은 대안 요법.",
        "🔴 **제외 원칙:** 두개천골 요법(CST), 내장 교정, AK(Applied Kinesiology) 진단법 등 과학적 근거가 부족하거나 생리학적 기전이 입증되지 않은 대안 요법.",
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_fn_v2_part4():
    path = ROOT / "functional_neurology" / "v2" / "11_report_part4.md"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 105: "*   **한의사:** 추나 요법과 FN 원리를 결합하되, 한의 표준 임상 진료 지침의 범위를 존중."
    text = re.sub(
        r"\*\s+\*\*한의사:\*\*[^\n]*\n",
        "",
        text,
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_diversified_master_index():
    path = ROOT / "diversified" / "lecture" / "00_master_index.md"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 27: "- 경락·기(氣)·음양오행 등 한의학 이론" — delete entire bullet
    text = re.sub(
        r"^- 경락·기[^·\n]*·음양오행 등 한의학[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )
    # Line 64: "- 제6부. Diversified vs OMT·MOB·MET·추나 HVLA 비교"
    text = text.replace(
        "- 제6부. Diversified vs OMT·MOB·MET·추나 HVLA 비교",
        "- 제6부. Diversified vs OMT·MOB·MET 비교",
    )
    # Line 128: "- 제9부. 한국 임상 현장 — 추나·도수·정형 협진"
    text = text.replace(
        "- 제9부. 한국 임상 현장 — 추나·도수·정형 협진",
        "- 제9부. 한국 임상 현장 — 도수치료·정형·재활의학 협진",
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_diversified_week1():
    """Heaviest file: 45 hits. Rewrite specific blocks aggressively."""
    path = ROOT / "diversified" / "lecture" / "week1_history_foundations.md"
    text = path.read_text(encoding="utf-8")
    original = text

    # Line 12: objective list
    text = text.replace(
        "osteopathic HVLA(OMT)·물리치료 관절 가동술(MOB)·추나 HVLA와 구분할 수 있다",
        "osteopathic HVLA(OMT)·물리치료 관절 가동술(MOB)과 구분할 수 있다",
    )

    # Line 31 table row exclusion column
    text = text.replace(
        "| 안전성 통계·금기증 | 한의학 경락·기(氣)·음양오행 이론 |",
        "| 안전성 통계·금기증 | Vitalism·생기론·측정 불가 개념 |",
    )

    # Lines 59-61: 한국 급여 table rows — delete these three rows entirely
    text = re.sub(
        r"\|\s*\*\*한국 급여\*\*\s*\|\s*39014\s*\|\s*추나요법[^\n]*\n",
        "",
        text,
    )
    text = re.sub(
        r"\|\s*\|\s*39015\s*\|\s*추나요법[^\n]*\n",
        "",
        text,
    )
    text = re.sub(
        r"\|\s*\|\s*39016\s*\|\s*추나요법[^\n]*\n",
        "",
        text,
    )

    # Section 6.1 comparison table: header has "추나 HVLA (KMD)" as last column.
    # Drop the last column from header + separator + all body rows uniformly.
    def drop_last_col_block(block: str) -> str:
        out_rows = []
        for row in block.split("\n"):
            if row.startswith("|") and row.count("|") >= 3:
                cells = row.split("|")
                if cells[-1] == "":
                    cells = cells[:-2] + [cells[-1]]
                else:
                    cells = cells[:-1]
                row = "|".join(cells)
            out_rows.append(row)
        return "\n".join(out_rows)

    text = re.sub(
        r"(\| 항목 \| \*\*Diversified \(DC\)\*\*[^\n]*추나 HVLA \(KMD\)[^\n]*\n(?:\|[^\n]*\n)+)",
        lambda m: drop_last_col_block(m.group(1).rstrip("\n")) + "\n",
        text,
    )

    # Line 78 blockquote: mention of OMT·추나 HVLA·MD 도수치료 — drop the 추나 token
    text = text.replace("OMT·추나 HVLA·MD 도수치료", "OMT·MD 도수치료")

    # Line 274 blockquote: whole sentence "\"추나\" 용어는 한의학적 맥락이 섞여..." — delete the sentence
    text = re.sub(
        r'\s*"추나" 용어는 한의학적 맥락이 섞여[^"]*"HVLA manipulation"으로 병기 권장\.',
        "",
        text,
    )

    # Line 305 Mermaid node: "Options --> KMD[추나요법<br/>한의사 — 별도 보험 항목]" — delete this node line
    text = re.sub(
        r"^\s*Options --> KMD\[추나요법[^\]]*\]\s*\n",
        "",
        text,
        flags=re.MULTILINE,
    )
    # The KMD node may also appear in other Mermaid chart lines; delete lines that reference KMD standalone
    text = re.sub(
        r"^\s*KMD\[한의사[^\]]*\]\s*\n",
        "",
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(
        r"^\s*MD -\.의뢰\.-> KMD\s*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    # Line 316 summary blockquote: "정형외과·재활의학과 의사·도수치료 훈련 물리치료사·한의사" → remove 한의사
    text = text.replace(
        "정형외과·재활의학과 의사·도수치료 훈련 물리치료사·한의사",
        "정형외과·재활의학과 의사·도수치료 훈련 물리치료사",
    )
    # "(DC/DO/PT/KMD)" → "(DC/DO/PT)"
    text = text.replace("(DC/DO/PT/KMD)", "(DC/DO/PT)")

    # Line 414 list item
    text = text.replace(
        "OMT HVLA(DO), PT MOB(진동 중심), MET(환자 등척성), 추나 HVLA(KMD) — **기법적 중첩 있음**",
        "OMT HVLA(DO), PT MOB(진동 중심), MET(환자 등척성) — **기법적 중첩 있음**",
    )

    # Line 504 reference: delete line
    text = re.sub(
        r"^- Chuna manual medicine in Korea:[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    if text != original:
        write(path, text)
        return 1
    return 0


def clean_diversified_v2_week1_report():
    path = ROOT / "diversified" / "v2" / "08_report_week1_v2.md"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 31: "한국 건강보험: 39014-39016 (추나요법...)" → delete bullet
    text = re.sub(
        r"\*\s+\*\*한국 건강보험:\*\*\s+39014[^\n]*\n",
        "",
        text,
    )
    # Line 124: "국내 현황: 복잡추나(급여)와 도수치료(비급여) 환경..."
    text = re.sub(
        r"\*\s+\*\*국내 현황:\*\*\s+복잡추나[^\n]*\n",
        "*   **국내 현황:** 도수치료(비급여) 환경에서 HVLA는 관절 가동성 회복을 위한 핵심 중재로 자리 잡고 있습니다.\n",
        text,
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def clean_diversified_v2_week4_report():
    path = ROOT / "diversified" / "v2" / "11_report_week4_v2.md"
    text = path.read_text(encoding="utf-8")
    original = text
    # Line 129: "제도적 이원화: 한의사의 '추나(급여)'와 의사/물리치료사의 '도수치료(비급여)'"
    text = text.replace(
        "*   **제도적 이원화:** 한의사의 '추나(급여)'와 의사/물리치료사의 '도수치료(비급여)'로 구분됨.",
        "*   **제도 맥락:** 본 강의는 의사·물리치료사가 수행하는 '도수치료(비급여/실손)' 임상 환경을 기준으로 한다.",
    )
    if text != original:
        write(path, text)
        return 1
    return 0


def main():
    results = {}
    modifiers = [
        # HTML
        ("chapter04_gonstead.html", lambda: clean_chapter_html(ROOT / "chapter04_gonstead.html")),
        ("chapter05_toggle_recoil.html", lambda: clean_chapter_html(ROOT / "chapter05_toggle_recoil.html")),
        ("chapter06_thompson.html", lambda: clean_chapter_html(ROOT / "chapter06_thompson.html")),
        ("chapter07_activator.html", lambda: clean_chapter_html(ROOT / "chapter07_activator.html")),
        ("chapter08_cox.html", lambda: clean_chapter_html(ROOT / "chapter08_cox.html")),
        ("chapter09_logan.html", lambda: clean_chapter_html(ROOT / "chapter09_logan.html")),
        ("chapter10_sot.html", lambda: clean_chapter_html(ROOT / "chapter10_sot.html")),
        ("chapter11_cbp.html", lambda: clean_chapter_html(ROOT / "chapter11_cbp.html")),
        ("chapter12_ak.html (disclaimer)", lambda: clean_chapter_html(ROOT / "chapter12_ak.html")),
        ("chapter12_ak.html (body)", clean_chapter12_html),
        ("chapter01_introduction.html", clean_chapter01),
        ("chapter02_functional_neurology.html", clean_chapter02_html),
        ("chapter03_diversified.html", clean_chapter03_html),
        ("index.html", clean_index_html),
        # MD
        ("diversified/11_report_week4.md", clean_diversified_report_week4),
        ("ak/lecture/chapter12_ak.md", clean_ak_lecture),
        ("sot/lecture/chapter10_sot.md", clean_sot_lecture),
        ("gonstead/lecture/chapter04_gonstead.md", clean_gonstead_lecture),
        ("functional_neurology/lecture/chapter02_functional_neurology.md", clean_fn_lecture),
        ("functional_neurology/v2/08_report_part1.md", clean_fn_v2_part1),
        ("functional_neurology/v2/11_report_part4.md", clean_fn_v2_part4),
        ("diversified/lecture/00_master_index.md", clean_diversified_master_index),
        ("diversified/lecture/week1_history_foundations.md", clean_diversified_week1),
        ("diversified/v2/08_report_week1_v2.md", clean_diversified_v2_week1_report),
        ("diversified/v2/11_report_week4_v2.md", clean_diversified_v2_week4_report),
    ]

    for name, fn in modifiers:
        try:
            n = fn()
            results[name] = "modified" if n else "no-op"
        except Exception as e:
            results[name] = f"ERROR: {e}"

    for name, status in results.items():
        print(f"{status:12s}  {name}")


if __name__ == "__main__":
    main()
