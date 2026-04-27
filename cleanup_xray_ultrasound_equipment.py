"""
정리 작업 (사용자 요청 2026-04-27):
1. 환자 케이스 X-ray 모두 제거
2. 초음파 영상 모두 제거
3. 장비 — Leander table만 남기고 모두 제거 (다시 추가 예정)

처리:
- legacy_manifest.json 필터링
- archive.html 의 X-ray + 초음파 섹션 제거
- chapter04_gonstead.html 의 X-ray img 태그 제거
- 같은 변경을 Drive 원본에도 적용
- 파일 시스템에서 삭제 (Drive 로컬)
- R2 객체 삭제
"""
import os, json, re, shutil, sys

APP_DIR = r"D:\Entertainments\DevEnvironment\chiropraticos-app"
DRIVE_DIR = r"G:\내 드라이브\chiropracticos"

KEEP_TABLE = "Leander table.jpg"

# 삭제할 폴더/파일 패턴
DELETE_FOLDERS = [
    "images/clinical_cases/xrays",
    "images/chapter2/ultrasound",
]
DELETE_TABLE_PATTERN = re.compile(r"^20150405\d+_IMG_\d+\.JPG$")

# ───────────────────────────────────────────────────────────────────────────
# 1. legacy_manifest.json 정리
# ───────────────────────────────────────────────────────────────────────────
manifest_paths = [
    os.path.join(APP_DIR, "images", "legacy_manifest.json"),
    os.path.join(DRIVE_DIR, "images", "legacy_manifest.json"),
]
for mp in manifest_paths:
    if not os.path.exists(mp):
        print(f"[skip] manifest 없음: {mp}")
        continue
    with open(mp, encoding="utf-8") as f:
        m = json.load(f)
    before = {k: len(v) for k, v in m.items()}
    # xray, ultrasound 카테고리 제거
    m.pop("xray", None)
    m.pop("ultrasound", None)
    # table 카테고리 — Leander만
    if "table" in m:
        m["table"] = [it for it in m["table"] if KEEP_TABLE in (it.get("name") or "") or KEEP_TABLE in (it.get("dst") or "")]
    after = {k: len(v) for k, v in m.items()}
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(m, f, ensure_ascii=False, indent=2)
    print(f"[OK] {mp}")
    print(f"  before: {before}")
    print(f"  after : {after}")

# ───────────────────────────────────────────────────────────────────────────
# 2. archive.html 정리 (clinical-cases + ultrasound 섹션 제거)
# ───────────────────────────────────────────────────────────────────────────
ARCHIVE_PATCHES = [
    # X-ray 섹션 통째로 제거
    (
        re.compile(
            r"  <!-- Clinical Cases \(X-rays\) -->\s*\n"
            r"  <section class=\"archive-section\" id=\"clinical-cases\">.*?</section>\n\n",
            re.DOTALL,
        ),
        "",
    ),
    # 초음파 섹션 통째로 제거
    (
        re.compile(
            r"  <!-- Ultrasound -->\s*\n"
            r"  <section class=\"archive-section\" id=\"ultrasound\">.*?</section>\n\n",
            re.DOTALL,
        ),
        "",
    ),
    # 장비 섹션 헤더의 (18건) → (1건)
    (
        re.compile(r'<h2>🛠 카이로프랙틱 장비 \(18건\)</h2>'),
        '<h2>🛠 카이로프랙틱 장비 (1건 — Leander only)</h2>',
    ),
    # JS 호출 제거
    (re.compile(r"  loadGallery\('xray', 'xray-grid'\);\n"), ""),
    (re.compile(r"  loadGallery\('ultrasound', 'ultrasound-grid'\);\n"), ""),
    # intro 텍스트의 "환자 X-ray 케이스 · 카이로프랙틱 교재 서가 · 초음파 영상 · 장비 사진" → 정리
    (
        re.compile(r"환자 X-ray 케이스 · 카이로프랙틱 교재 서가 · 초음파 영상 · 장비 사진"),
        "카이로프랙틱 교재 서가 · 장비 사진",
    ),
]
for archive_path in [os.path.join(APP_DIR, "archive.html"), os.path.join(DRIVE_DIR, "archive.html")]:
    if not os.path.exists(archive_path):
        print(f"[skip] {archive_path}")
        continue
    with open(archive_path, encoding="utf-8") as f:
        s = f.read()
    orig_len = len(s)
    for pat, rep in ARCHIVE_PATCHES:
        s = pat.sub(rep, s)
    with open(archive_path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"[OK] {archive_path}  {orig_len:,} → {len(s):,} bytes")

# ───────────────────────────────────────────────────────────────────────────
# 3. chapter04_gonstead.html — X-ray <div class="gs-xray-box has-image">...</div> 제거
# ───────────────────────────────────────────────────────────────────────────
XRAY_BOX = re.compile(
    r'\s*<div class="gs-xray-box has-image">\s*'
    r'<img src="(?:\./images/clinical_cases/xrays/|https://[^"]*r2\.dev/[^"]*clinical_cases/xrays/)[^"]+"[^/]*/>\s*'
    r'<div class="caption">[^<]+</div>\s*'
    r'</div>',
    re.DOTALL,
)
for ch4 in [os.path.join(APP_DIR, "chapter04_gonstead.html"), os.path.join(DRIVE_DIR, "chapter04_gonstead.html")]:
    if not os.path.exists(ch4):
        continue
    with open(ch4, encoding="utf-8") as f:
        s = f.read()
    new, n = XRAY_BOX.subn("", s)
    with open(ch4, "w", encoding="utf-8") as f:
        f.write(new)
    print(f"[OK] {ch4} — {n} X-ray box removed")

# ───────────────────────────────────────────────────────────────────────────
# 4. 파일 시스템 삭제 (Drive 로컬)
# ───────────────────────────────────────────────────────────────────────────
print("\n=== Drive 파일 삭제 ===")
for sub in DELETE_FOLDERS:
    p = os.path.join(DRIVE_DIR, sub.replace("/", os.sep))
    if os.path.isdir(p):
        cnt = sum(1 for _ in os.scandir(p))
        shutil.rmtree(p)
        print(f"  [DELETE] {p} ({cnt} files)")

# table 폴더에서 Leander 제외 IMG_*.JPG 삭제
table_dir = os.path.join(DRIVE_DIR, "images", "equipment", "tables")
if os.path.isdir(table_dir):
    removed = 0
    for fname in os.listdir(table_dir):
        if DELETE_TABLE_PATTERN.match(fname):
            os.remove(os.path.join(table_dir, fname))
            removed += 1
    print(f"  [DELETE] {table_dir} — {removed} IMG files (Leander 보존)")

print("\n완료. 다음: aws s3 rm으로 R2 정리 + deploy.sh")
