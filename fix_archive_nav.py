"""Clean up broken nav from earlier inject + add archive link properly."""
import re
from pathlib import Path

ROOT = Path(r"G:\내 드라이브\chiropracticos")

ARCHIVE_LI = '<li><a href="./archive.html">📂 아카이브</a></li>'


def fix(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    # Remove broken leftover markup from earlier injection
    text = re.sub(
        r'      <div class="archive-nav-spacer"></div>\s*\n\s*</ul>\s*\n',
        "",
        text,
    )

    # Add archive link before </ul> of nav-links (first occurrence) if not present
    if 'href="./archive.html"' not in text:
        text = re.sub(
            r'(<ul class="nav-links">(?:\s*<li>[^<]*<a[^>]*>[^<]*</a></li>)+)',
            lambda m: m.group(1) + '\n        ' + ARCHIVE_LI,
            text,
            count=1,
        )

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    for html in sorted(ROOT.glob("chapter*.html")):
        changed = fix(html)
        print(f"{'[FIX]':6s} {html.name}" if changed else f"{'[OK]':6s} {html.name}")


if __name__ == "__main__":
    main()
