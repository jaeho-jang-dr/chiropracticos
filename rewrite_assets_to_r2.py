"""
챕터 HTML 안의 미디어 URL을 R2 public URL로 일괄 교체.
패턴:
  "./gonstead/01_podcast.m4a"  →  "https://pub-XXX.r2.dev/gonstead/01_podcast.m4a"
  "./archive/videos/...mp4"     →  "https://pub-XXX.r2.dev/archive/videos/...mp4"

KEEP unchanged:
  ./images/...      (Vercel에 이미 있음)
  ./assets/...      (Vercel에 이미 있음)
  ./viewer.html?src=... (MD viewer, MD 파일은 Vercel에 있음)

Usage:
  python rewrite_assets_to_r2.py [--dry-run]
"""
import os, re, sys, glob

R2_BASE = "https://pub-e44b2168eea2482095d15cb22dc4d9b7.r2.dev"

# 미디어가 위치하는 폴더 (R2로 옮길 대상)
MEDIA_DIRS = [
    "gonstead", "cox", "logan", "sot", "cbp", "ak",
    "activator", "thompson", "toggle_recoil", "diversified",
    "functional_neurology", "intro", "archive",
]

# 매치 패턴: "./<folder>/<path>.<ext>"  (확장자가 미디어인 경우만)
MEDIA_EXT = "(?:mp4|m4a|webm|mp3|wav|pdf|pptx|docx|zip|jpg|jpeg|png|webp)"
DIRS_GROUP = "(?:" + "|".join(MEDIA_DIRS) + ")"

# 큰따옴표 안의 ./<folder>/<path>.<ext>
PATTERN_DQUOTE = re.compile(
    r'"\./(' + DIRS_GROUP + r'/[^"]+?\.' + MEDIA_EXT + r')"',
    re.IGNORECASE,
)
# 작은따옴표 안 (혹시 모르니)
PATTERN_SQUOTE = re.compile(
    r"'\./(" + DIRS_GROUP + r"/[^']+?\." + MEDIA_EXT + r")'",
    re.IGNORECASE,
)

def rewrite(html: str) -> tuple[str, int]:
    cnt = 0
    def repl(m):
        nonlocal cnt
        cnt += 1
        return f'"{R2_BASE}/{m.group(1)}"'
    def repl_s(m):
        nonlocal cnt
        cnt += 1
        return f"'{R2_BASE}/{m.group(1)}'"
    new = PATTERN_DQUOTE.sub(repl, html)
    new = PATTERN_SQUOTE.sub(repl_s, new)
    return new, cnt

def main():
    dry = "--dry-run" in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    files = sorted(glob.glob(os.path.join(here, "*.html")))
    total = 0
    for fp in files:
        with open(fp, "r", encoding="utf-8") as f:
            orig = f.read()
        new, cnt = rewrite(orig)
        if cnt == 0:
            print(f"  [skip] {os.path.basename(fp):40s} 0 changes")
            continue
        if not dry:
            with open(fp, "w", encoding="utf-8") as f:
                f.write(new)
        marker = "[DRY]" if dry else "[OK ]"
        print(f"  {marker} {os.path.basename(fp):40s} {cnt} URLs replaced")
        total += cnt
    print(f"\n총 {total} URL {'대상' if dry else '치환됨'}")
    if dry:
        print("실제 적용: python rewrite_assets_to_r2.py")

if __name__ == "__main__":
    main()
