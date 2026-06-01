"""
Scan G drive assets and rebuild index.html + chapter HTMLs with real status badges.
Distinguishes READY (✅ clickable links) vs PENDING (⏳ dimmed).
Also converts any new PPTX to PDF via PowerPoint COM before rebuilding, so .pptx
links can point at matching .pdf files (PDFs render inline in every browser).
"""
import os, json, sys, subprocess
sys.stdout.reconfigure(encoding='utf-8')

ROOT = r"G:\내 드라이브\chiropracticos"

# Convert any new/changed PPTX to PDF first (idempotent — skips if PDF is up to date)
def convert_pptx_stale():
    try:
        subprocess.run(
            [sys.executable, os.path.join(os.path.dirname(__file__), "convert_pptx_to_pdf.py")],
            check=False,
        )
    except Exception as e:
        print(f"[WARN] pptx→pdf 변환 단계 건너뜀: {e}")

convert_pptx_stale()

CHAPTERS = [
    {"num": 1, "slug": None,                "file": "chapter01_introduction.html",      "title": "서설",                    "subtitle": "카이로프랙틱 역사·철학·원칙"},
    {"num": 2, "slug": "functional_neurology", "file": "chapter02_functional_neurology.html", "title": "Functional Neurology", "subtitle": "⭐ 진단·치료·평가의 근간", "assets_dir": "functional_neurology/v2", "lecture_dir": "functional_neurology/lecture", "notebook_id": "e4f43415-ed66-4621-a902-c4c450a6925d"},
    {"num": 3, "slug": "diversified",       "file": "chapter03_diversified.html",       "title": "Diversified HVLA",        "subtitle": "미국 DC 95.9% 사용 · 기본기",     "assets_dir": "diversified",     "lecture_dir": "diversified/lecture",     "notebook_id": "291e66c6-c8b5-4de0-9ef9-f3bab92ac4ff"},
    {"num": 4, "slug": "gonstead",          "file": "chapter04_gonstead.html",          "title": "Gonstead Technique",      "subtitle": "5 Components · X-ray listing",     "assets_dir": "gonstead",         "lecture_dir": "gonstead/lecture",         "notebook_id": "4e8b2040-ae5a-438c-90ad-a8acc7a542f2"},
    {"num": 5, "slug": "toggle_recoil",     "file": "chapter05_toggle_recoil.html",     "title": "Toggle Recoil (HIO)",      "subtitle": "상부경추 특이 · 🔴 HIO 비판",       "assets_dir": "toggle_recoil",    "lecture_dir": "toggle_recoil/lecture",    "notebook_id": "2b8b7956-cc5e-4591-a0c1-b0904f95d591"},
    {"num": 6, "slug": "thompson",          "file": "chapter06_thompson.html",          "title": "Thompson",                 "subtitle": "드롭 테이블 · Derifield leg check", "assets_dir": "thompson",         "lecture_dir": "thompson/lecture",         "notebook_id": "b01b6979-fff3-432e-b62c-d351a389b853"},
    {"num": 7, "slug": "activator",         "file": "chapter07_activator.html",         "title": "Activator Methods",         "subtitle": "기구 교정 · NIH grant 수혜",       "assets_dir": "activator",        "lecture_dir": "activator/lecture",        "notebook_id": "b250bba3-2ff3-44e1-9bd0-3b0fb26aaabd"},
    {"num": 8, "slug": "cox",               "file": "chapter08_cox.html",               "title": "Cox Flexion-Distraction",  "subtitle": "척추 감압 · 디스크·신경근증",        "assets_dir": "cox",              "lecture_dir": "cox/lecture",              "notebook_id": "4c81bbd8-19e9-4727-9e48-eaf5a0a389b2"},
    {"num": 9, "slug": "logan",             "file": "chapter09_logan.html",             "title": "Logan Basic",              "subtitle": "천골 저강도 · 임산부·소아",          "assets_dir": "logan",            "lecture_dir": "logan/lecture",            "notebook_id": "a8039cf8-6d09-49f4-b80b-9e5e78c0a968"},
    {"num": 10, "slug": "sot",              "file": "chapter10_sot.html",               "title": "Sacro-Occipital Technique", "subtitle": "Category I/II/III · 🔴 Cranial 비판","assets_dir": "sot",              "lecture_dir": "sot/lecture",              "notebook_id": "2b73a534-51e0-4404-8538-7b60bc4dc780"},
    {"num": 11, "slug": "cbp",              "file": "chapter11_cbp.html",               "title": "Harrison CBP",              "subtitle": "수학 기반 · Mirror Image® · Denneroll","assets_dir": "cbp",             "lecture_dir": "cbp/lecture",              "notebook_id": "37eea36e-8142-45af-b223-108d078ebd09"},
    {"num": 12, "slug": "ak",               "file": "chapter12_ak.html",                "title": "Applied Kinesiology",       "subtitle": "MMT · 🔴 AK 확장 진단 근거 없음",    "assets_dir": "ak",               "lecture_dir": "ak/lecture",               "notebook_id": "416ef164-398d-46f0-8d11-45558467bd7f"},
]

def find_file(folder, patterns, min_size=1000):
    """Return relative path from ROOT if a file matching any pattern exists."""
    if not os.path.exists(folder):
        return None
    for f in sorted(os.listdir(folder)):
        fp = os.path.join(folder, f)
        if not os.path.isfile(fp):
            continue
        if os.path.getsize(fp) < min_size:
            continue
        low = f.lower()
        for p in patterns:
            if all(kw.lower() in low for kw in p):
                rel = os.path.relpath(fp, ROOT).replace("\\", "/")
                return rel
    return None

def scan_chapter(ch):
    """Return dict of asset status."""
    status = {
        "podcast": None,
        "video_part1": None,
        "video_part2": None,
        "slides": [None, None, None, None],
        "reports": [None, None, None, None],
        "lecture_md": None,
        "html": None,
    }

    # HTML always exists
    html_path = os.path.join(ROOT, ch["file"])
    if os.path.exists(html_path):
        status["html"] = ch["file"]

    if not ch.get("assets_dir"):
        return status

    assets_dir = os.path.join(ROOT, ch["assets_dir"])

    # Podcast
    status["podcast"] = find_file(assets_dir, [["podcast"], ["01_podcast"]], 100000)

    # Videos
    status["video_part1"] = find_file(assets_dir, [["part1", "mp4"], ["02_", "mp4"]], 1000000)
    status["video_part2"] = find_file(assets_dir, [["part2", "mp4"], ["03_", "mp4"]], 1000000)

    # Slides 1-4
    for i, pat in enumerate([["04_"], ["05_"], ["06_"], ["07_"]]):
        status["slides"][i] = find_file(assets_dir, [pat + ["pptx"], ["week" + str(i+1), "pptx"], ["part" + str(i+1), "pptx"]], 50000)

    # Reports 1-4
    for i, pat in enumerate([["08_"], ["09_"], ["10_"], ["11_"]]):
        status["reports"][i] = find_file(assets_dir, [pat + ["md"], ["week" + str(i+1), "md", "report"], ["part" + str(i+1), "md", "report"]], 1000)

    # Lecture MD
    lec_dir = os.path.join(ROOT, ch.get("lecture_dir", ""))
    if lec_dir and os.path.exists(lec_dir):
        mds = [f for f in sorted(os.listdir(lec_dir)) if f.endswith(".md") and f != "00_master_index.md"]
        if mds:
            status["lecture_md"] = os.path.relpath(os.path.join(lec_dir, mds[0]), ROOT).replace("\\", "/")

    return status

def count_ready(status):
    """Count ready artifacts out of 11 (1 podcast + 2 video + 4 slides + 4 reports)."""
    n = 0
    if status["podcast"]: n += 1
    if status["video_part1"]: n += 1
    if status["video_part2"]: n += 1
    n += sum(1 for x in status["slides"] if x)
    n += sum(1 for x in status["reports"] if x)
    return n

# Scan all
overall = {}
for ch in CHAPTERS:
    overall[ch["num"]] = {"meta": ch, "status": scan_chapter(ch), "ready": 0}
    overall[ch["num"]]["ready"] = count_ready(overall[ch["num"]]["status"])

# Save JSON
json_path = os.path.join(ROOT, "assets", "chapters-status.json")
os.makedirs(os.path.dirname(json_path), exist_ok=True)
with open(json_path, "w", encoding="utf-8") as f:
    json.dump({str(k): v for k, v in overall.items()}, f, ensure_ascii=False, indent=2, default=str)
print(f"[JSON] {json_path}")

print("\n=== 12 챕터 자산 스캔 결과 ===")
for num, d in overall.items():
    ch = d["meta"]
    s = d["status"]
    ready = d["ready"]
    mark_lec = "✅" if s["lecture_md"] else "  "
    print(f"Ch {num:2d} {ch['title'][:25]:25s} | HTML ✅ | MD {mark_lec} | 아티팩트 {ready}/11")

# ============================================================================
# Generate updated resource section HTML for each chapter
# ============================================================================

def resource_href(url: str) -> tuple[str, str]:
    """Return (href, extra_attrs) for a given asset path.
    - .md   → viewer.html?src=... (rendered markdown)
    - .pptx → companion .pdf (renders inline in every browser). If no PDF exists yet,
              fall back to pptx download.
    - others → raw path (audio/video handled by browser)
    """
    if url.endswith(".md"):
        from urllib.parse import quote
        return f"./viewer.html?src={quote(url)}", ""
    if url.endswith(".pptx"):
        pdf_rel = url[:-5] + ".pdf"
        pdf_abs = os.path.join(ROOT, pdf_rel.replace("/", os.sep))
        if os.path.exists(pdf_abs):
            return f"./{pdf_rel}", ""
        return f"./{url}", " download"
    return f"./{url}", ""


def resource_row(label, icon, url, desc=""):
    if url:
        href, extra = resource_href(url)
        return f'<a class="resource-link" href="{href}"{extra}><span class="icon">{icon}</span><span><strong>{label}</strong> <span class="status-badge ready">✅ 준비 완료</span><br/><small>{desc}</small></span></a>'
    else:
        return f'<div class="resource-link pending" title="생성 예정"><span class="icon" style="opacity:.4">{icon}</span><span><strong style="color:var(--c-text-muted)">{label}</strong> <span class="status-badge pending">⏳ 생성 예정</span><br/><small>Google NotebookLM quota 리셋 후 · 24h</small></span></div>'

def make_resource_section(ch_num, status):
    parts = []
    parts.append('<section id="resources">')
    parts.append('  <h2>강의 자료</h2>')

    ready = count_ready(status)
    if ready == 0:
        parts.append(f'  <div class="callout callout-warn"><h4>⏳ 생성 대기</h4><p>이 챕터의 NotebookLM 아티팩트는 아직 생성되지 않았습니다. 다음 세션에서 할당량 리셋 후 제출 예정. 강의록 MD와 HTML은 이미 준비되어 있습니다.</p></div>')
    else:
        parts.append(f'  <p class="section-lead"><strong>{ready}/11</strong> 자료 준비 완료.</p>')

    # Lecture MD
    parts.append('  <h3>📖 강의록</h3>')
    parts.append('  <div class="resource-row">')
    if status["lecture_md"]:
        parts.append(f'    {resource_row("상세 강의록 MD", "📖", status["lecture_md"], "근거 기반 · 참고문헌")}')
    else:
        parts.append(f'    {resource_row("상세 강의록 MD", "📖", None)}')
    parts.append('  </div>')

    # Podcast
    parts.append('  <h3>🎧 팟캐스트</h3>')
    parts.append('  <div class="resource-row">')
    parts.append(f'    {resource_row("Deep Dive 2인 대화 60분+", "🎧", status["podcast"], "evidence-based · 비판적 시각")}')
    parts.append('  </div>')

    # Videos
    parts.append('  <h3>🎥 AI 동영상</h3>')
    parts.append('  <div class="resource-row">')
    parts.append(f'    {resource_row("Part 1 (이론)", "🎥", status["video_part1"], "화이트보드 explainer")}')
    parts.append(f'    {resource_row("Part 2 (임상·비판)", "🎥", status["video_part2"], "화이트보드 explainer")}')
    parts.append('  </div>')

    # Slides
    parts.append('  <h3>🎴 PPTX 슬라이드 (4개 × 15장)</h3>')
    parts.append('  <div class="resource-row">')
    slide_labels = ["Part 1 · 기초", "Part 2 · Aff/Def/Eff", "Part 3 · Assessment", "Part 4 · 임상·비판"]
    for i, (lbl, url) in enumerate(zip(slide_labels, status["slides"])):
        parts.append(f'    {resource_row(lbl, "🎴", url, "15장")}')
    parts.append('  </div>')

    # Reports
    parts.append('  <h3>📄 Report Markdown</h3>')
    parts.append('  <div class="resource-row">')
    report_labels = ["Report 1/4", "Report 2/4", "Report 3/4", "Report 4/4"]
    for lbl, url in zip(report_labels, status["reports"]):
        parts.append(f'    {resource_row(lbl, "📄", url, "NotebookLM 자동 생성")}')
    parts.append('  </div>')

    ch_meta = next((c for c in CHAPTERS if c["num"] == ch_num), {})
    nb_id = ch_meta.get("notebook_id")
    if nb_id:
        parts.append(f'  <p style="margin-top:1rem">NotebookLM 노트북: <a href="https://notebooklm.google.com/notebook/{nb_id}" target="_blank" rel="noopener">열기 →</a></p>')
    parts.append('</section>')
    return "\n    ".join(parts)

# Add status-badge CSS to main.css if not present
css_path = os.path.join(ROOT, "assets", "main.css")
with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

badge_css = """

/* ========== STATUS BADGES ========== */
.status-badge {
  display: inline-block;
  padding: .15rem .55rem;
  border-radius: var(--r-pill);
  font-size: .7rem;
  font-weight: 600;
  margin-left: .3rem;
  vertical-align: middle;
}
.status-badge.ready   { background: #d4edda; color: #155724; }
.status-badge.pending { background: #f0f0f3; color: #86868b; }
.resource-link.pending {
  opacity: .55;
  cursor: not-allowed;
  pointer-events: none;
}
.resource-link.pending:hover {
  background: var(--c-bg);
  border-color: var(--c-border-light);
  transform: none;
}

/* ========== DASHBOARD (index) ========== */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}
.dash-card {
  background: var(--c-bg);
  border: 1px solid var(--c-border-light);
  border-radius: var(--r-lg);
  padding: 1.25rem;
  transition: all .15s var(--ease);
  text-decoration: none;
  color: inherit;
  display: block;
}
.dash-card:hover {
  border-color: var(--c-border);
  transform: translateY(-2px);
  box-shadow: var(--sh-md);
  text-decoration: none;
}
.dash-card .dash-head {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: .5rem;
}
.dash-card .dash-num {
  display: inline-block;
  background: var(--c-bg-section);
  color: var(--c-text-muted);
  min-width: 1.75rem; height: 1.75rem; line-height: 1.75rem;
  text-align: center;
  border-radius: var(--r-pill);
  font-weight: 600;
  font-size: .8rem;
  padding: 0 .6rem;
}
.dash-card .dash-ready {
  font-size: .75rem;
  color: var(--c-text-muted);
  font-weight: 500;
}
.dash-card h4 {
  margin: .35rem 0 .25rem;
  font-size: 1rem;
  color: var(--c-text);
}
.dash-card .dash-sub {
  font-size: .82rem;
  color: var(--c-text-muted);
  margin: 0 0 .75rem;
  line-height: 1.4;
}
.dash-bar {
  height: 6px;
  background: var(--c-bg-section);
  border-radius: var(--r-pill);
  overflow: hidden;
  margin-bottom: .5rem;
}
.dash-fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #34c759);
  transition: width .3s;
}
.dash-chips {
  display: flex; flex-wrap: wrap; gap: .3rem;
  font-size: .68rem;
}
.chip {
  padding: .1rem .45rem;
  border-radius: var(--r-pill);
  background: var(--c-bg-section);
  color: var(--c-text-muted);
}
.chip.ready   { background: #e6f7ed; color: #1f7a3f; }
.chip.partial { background: #fff7e0; color: #8a5a00; }
.chip.empty   { background: #f8f8f9; color: #a8a8ad; }
"""

if ".status-badge {" not in css:
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(css + badge_css)
    print(f"[CSS] badge + dashboard CSS 추가")

# Update each chapter HTML - replace resources section
import re
for ch in CHAPTERS:
    html_path = os.path.join(ROOT, ch["file"])
    if not os.path.exists(html_path):
        continue
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    new_resource = make_resource_section(ch["num"], overall[ch["num"]]["status"])
    # Replace <section id="resources">...</section>
    pattern = re.compile(r'<section id="resources">.*?</section>', re.DOTALL)
    if pattern.search(html):
        html = pattern.sub(new_resource, html, count=1)
    else:
        # append before </main>
        html = html.replace("</main>", "    " + new_resource + "\n  </main>", 1)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[UPDATE] {ch['file']}")

# Now update index.html to add dashboard before curriculum
index_path = os.path.join(ROOT, "index.html")
with open(index_path, "r", encoding="utf-8") as f:
    idx = f.read()

# Build dashboard HTML
dash_cards = []
total_ready = 0
total_assets = 0
for num in sorted(overall.keys()):
    d = overall[num]
    s = d["status"]
    ch = d["meta"]
    ready = d["ready"]
    total_ready += ready
    total_assets += 11 if ch.get("assets_dir") else 0
    percent = int((ready / 11) * 100) if ch.get("assets_dir") else 0

    podcast_chip = '<span class="chip ready">🎧</span>' if s["podcast"] else '<span class="chip empty">🎧</span>'
    video_chip   = '<span class="chip ready">🎥×2</span>' if s["video_part1"] and s["video_part2"] else ('<span class="chip partial">🎥</span>' if s["video_part1"] else '<span class="chip empty">🎥</span>')
    slides_r = sum(1 for x in s["slides"] if x)
    slides_chip = f'<span class="chip {"ready" if slides_r==4 else ("partial" if slides_r else "empty")}">🎴{slides_r}/4</span>'
    reports_r = sum(1 for x in s["reports"] if x)
    reports_chip = f'<span class="chip {"ready" if reports_r==4 else ("partial" if reports_r else "empty")}">📄{reports_r}/4</span>'
    md_chip = '<span class="chip ready">📖</span>' if s["lecture_md"] else '<span class="chip empty">📖</span>'

    if not ch.get("assets_dir"):
        chips = f'{md_chip}<span class="chip">HTML</span>'
        ready_display = "HTML only"
    else:
        chips = f'{md_chip}{podcast_chip}{video_chip}{slides_chip}{reports_chip}'
        ready_display = f"{ready}/11"

    dash_cards.append(f'''    <a class="dash-card" href="./{ch["file"]}">
      <div class="dash-head">
        <span class="dash-num">Ch {num}</span>
        <span class="dash-ready">{ready_display}</span>
      </div>
      <h4>{ch["title"]}</h4>
      <p class="dash-sub">{ch["subtitle"]}</p>
      <div class="dash-bar"><div class="dash-fill" style="width: {percent}%"></div></div>
      <div class="dash-chips">{chips}</div>
    </a>''')

dashboard_html = f'''    <!-- ========== DASHBOARD (Asset Status) ========== -->
    <section id="dashboard">
      <h2>📊 자산 준비 현황</h2>
      <p class="section-lead">각 챕터의 강의록·팟캐스트·영상·슬라이드·리포트 준비 상태. ✅ 준비 완료 · ⏳ 생성 예정.</p>

      <div class="callout callout-info">
        <h4>현재 상태</h4>
        <p>총 <strong>{total_ready}/{total_assets}</strong>개 NotebookLM 아티팩트 + 11개 챕터 MD + 12개 HTML 준비 완료. 나머지는 Google 할당량 리셋 후 점진 채워집니다.</p>
      </div>

      <div class="dashboard-grid">
{chr(10).join(dash_cards)}
      </div>
    </section>

'''

# Insert dashboard after about/core or before curriculum
if '<section id="dashboard">' not in idx:
    # insert before curriculum section
    idx = idx.replace('<!-- ========== CURRICULUM ========== -->', dashboard_html + '    <!-- ========== CURRICULUM ========== -->', 1)
else:
    # replace existing
    idx = re.sub(r'<!-- ========== DASHBOARD \(Asset Status\) ========== -->\s*<section id="dashboard">.*?</section>\s*\n', dashboard_html, idx, flags=re.DOTALL)

# Also add dashboard link to nav
if '<a href="#dashboard">' not in idx:
    idx = idx.replace('<li><a href="#curriculum">커리큘럼</a></li>',
                      '<li><a href="#dashboard">📊 현황</a></li>\n        <li><a href="#curriculum">커리큘럼</a></li>', 1)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(idx)
print(f"[INDEX] dashboard + nav 업데이트")

print(f"\n=== 완료 ===")
print(f"총 {total_ready}/{total_assets} NotebookLM 아티팩트 준비 · 11개 MD · 12개 HTML")
