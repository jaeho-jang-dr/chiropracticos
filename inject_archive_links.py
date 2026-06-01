"""
Inject archive navigation link + per-chapter legacy video sections into chapter HTMLs.
Idempotent.
"""
import re
from pathlib import Path

ROOT = Path(r"G:\내 드라이브\chiropracticos")

# Per-chapter legacy videos from archive/videos/techniques/ + neurologic_exam/
CHAPTER_VIDEOS = {
    2: [
        ("archive/videos/neurologic_exam/01 Sensory Pain.MP4", "01. Sensory Pain", "감각 통증 검사"),
        ("archive/videos/neurologic_exam/02 Weber vibration.MP4", "02. Weber Vibration", "진동 감각"),
        ("archive/videos/neurologic_exam/03 Motor.MP4", "03. Motor", "운동 신경"),
        ("archive/videos/neurologic_exam/04 Reflexes.MP4", "04. Reflexes", "심부건 반사"),
        ("archive/videos/neurologic_exam/05 CNF test (1).mp4", "05. CNF Test — Part 1", "Chiropractic Neurological Function"),
        ("archive/videos/neurologic_exam/05 CNF test (2).mp4", "05. CNF Test — Part 2", "Chiropractic Neurological Function"),
        ("archive/videos/neurologic_exam/06 LOC.MP4", "06. LOC", "Level of Consciousness"),
        ("archive/videos/neurologic_exam/07 posturegait.MP4", "07. Posture & Gait", "자세·보행"),
        ("archive/videos/neurologic_exam/08 Supine exam.MP4", "08. Supine Exam", "누운 자세 검사"),
    ],
    3: [
        ("archive/videos/techniques/diversified_nelson_pull.mp4", "Diversified Nelson Pull", "측와위 기법"),
        ("archive/videos/techniques/spinous_push_and_pull.mp4", "Spinous Push & Pull", "극돌기 접촉"),
        ("archive/videos/techniques/bilateral_hypothenar_push.mp4", "Bilateral Hypothenar Push", "양측 소지구"),
        ("archive/videos/techniques/ap_thoracic.mp4", "AP Thoracic", "앞뒤 흉추 교정"),
    ],
    4: [
        ("archive/videos/techniques/gonstead_sitting.mp4", "Gonstead Sitting", "좌위 교정"),
        ("archive/videos/techniques/hypothenar_ilium_push.mp4", "Hypothenar Ilium Push", "장골 교정"),
        ("archive/videos/techniques/hypothenar_sacral_apex_push.mp4", "Hypothenar Sacral Apex Push", "천골 첨부 교정"),
    ],
    5: [
        ("archive/videos/techniques/index_atlas_push_prone_rt.mp4", "Index Atlas Push — Prone Rt", "복와위 환추"),
        ("archive/videos/techniques/index_atlas_push_sup_lt.mp4", "Index Atlas Push — Supine Lt", "앙와위 좌측 환추"),
        ("archive/videos/techniques/index_atlas_push_sup_rt.mp4", "Index Atlas Push — Supine Rt", "앙와위 우측 환추"),
        ("archive/videos/techniques/index_pillar_push_sup_rt.mp4", "Index Pillar Push — Supine Rt", "Pillar pushing"),
    ],
    6: [("archive/videos/techniques/thompson_tech.mp4", "Thompson Technique", "드롭 테이블 시연")],
    7: [("archive/videos/techniques/activator_tech.mp4", "Activator Technique", "기구 교정 시연")],
    8: [("archive/videos/techniques/leander_tech.mp4", "Leander Technique", "자동 유연도 테이블")],
    11: [
        ("archive/videos/techniques/cbp_tech_head.mp4", "CBP — Head", "두부 Mirror Image®"),
        ("archive/videos/techniques/cbp_tech_trunk.mp4", "CBP — Trunk", "체간 Mirror Image®"),
    ],
}


def build_legacy_section(videos):
    cards = []
    for path, title, meta in videos:
        cards.append(
            f'<div class="video-card"><video src="./{path}" controls preload="metadata"></video>'
            f'<div class="info"><div class="title">{title}</div><div class="meta">{meta}</div></div></div>'
        )
    return (
        '<section id="legacy-demos" class="archive-inline">\n'
        '  <h2>🎬 레거시 시연 영상 (사용자 직접 시연)</h2>\n'
        '  <p class="section-lead">2015년 KOA 학회 및 임상 시연 당시 사용자가 촬영한 원본 영상입니다. '
        '참고용 · 직접 시연 중심이므로 이론 설명은 챕터 본문을 참고하세요.</p>\n'
        f'  <div class="video-thumb-grid">\n    {"".join(cards)}\n  </div>\n'
        '</section>\n'
    )


ARCHIVE_CSS = """
<style id="legacy-archive-css">
.archive-inline { margin: 3rem 0; }
.archive-inline .video-thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 1rem;
}
.archive-inline .video-card {
  background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 14px; overflow: hidden;
}
.archive-inline .video-card video {
  width: 100%; height: 180px; background: #000; object-fit: contain;
}
.archive-inline .video-card .info { padding: 10px 14px; }
.archive-inline .video-card .title { font-weight: 600; font-size: .92em; }
.archive-inline .video-card .meta { font-size: .78em; color: #86868b; }
</style>
"""


def patch_chapter(path: Path, ch_num: int) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    # 1. Add aArchive link to main nav if not present
    if 'href="./archive.html"' not in text:
        # Find the nav-links ul or similar and add archive
        # Simplest: insert before closing </nav>
        text = re.sub(
            r'(</ul>\s*<div class="nav-actions">)',
            r'</ul>\n      <div class="archive-nav-spacer"></div>\n      \1'.replace('\n      \1', '\n      <div class="nav-actions"><a class="btn btn-ghost btn-sm" href="./archive.html">📂 아카이브</a>'),
            text,
            count=1,
        )
        # Fallback: inject a simple archive link in nav-links
        if 'href="./archive.html"' not in text:
            text = text.replace(
                '<nav',
                '<!-- archive link injected -->\n  <nav',
                1,
            )

    # 2. Add CSS once
    if 'id="legacy-archive-css"' not in text:
        text = text.replace("</head>", ARCHIVE_CSS + "</head>", 1)

    # 3. Insert legacy section before </main>
    videos = CHAPTER_VIDEOS.get(ch_num)
    if videos:
        legacy_html = build_legacy_section(videos)
        # Remove any prior legacy-demos section (for idempotency)
        text = re.sub(
            r'<section id="legacy-demos"[^>]*>.*?</section>\s*',
            "",
            text,
            flags=re.DOTALL,
        )
        # Insert before </main>
        text = text.replace("</main>", "    " + legacy_html.replace("\n", "\n    ") + "\n</main>", 1)

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    chapter_files = {
        1: "chapter01_introduction.html",
        2: "chapter02_functional_neurology.html",
        3: "chapter03_diversified.html",
        4: "chapter04_gonstead.html",
        5: "chapter05_toggle_recoil.html",
        6: "chapter06_thompson.html",
        7: "chapter07_activator.html",
        8: "chapter08_cox.html",
        9: "chapter09_logan.html",
        10: "chapter10_sot.html",
        11: "chapter11_cbp.html",
        12: "chapter12_ak.html",
    }
    for num, fname in chapter_files.items():
        path = ROOT / fname
        if not path.exists():
            print(f"[SKIP] {fname}")
            continue
        changed = patch_chapter(path, num)
        print(f"{'[UPDATE]' if changed else '[OK]':9s} {fname}" + (f"  (레거시 영상 {len(CHAPTER_VIDEOS[num])}개)" if num in CHAPTER_VIDEOS else ""))


if __name__ == "__main__":
    main()
