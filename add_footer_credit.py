"""
Insert <div class="footer-credit">...</div> right before <div class="footer-bottom">
in every HTML file. Idempotent: skips files that already contain footer-credit.
"""
import re
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

CREDIT_HTML = (
    '<div class="footer-credit">\n'
    '        Edited by <strong>Jae-Ho Jang, M.D., BAppSc(Chiro)., D.C., PhD</strong>\n'
    '        <span class="credit-creds">Board Certified Orthopedic Surgeon · Member of Korean Spine Society · 정형외과전문의 · 척추학회정회원</span>\n'
    '      </div>\n'
    '      '
)

PATTERN = re.compile(r'<div class="footer-bottom">')


def process(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if 'footer-credit' in text:
        return "already has credit"
    if not PATTERN.search(text):
        return "no footer-bottom"
    new_text = PATTERN.sub(CREDIT_HTML + '<div class="footer-bottom">', text, count=1)
    path.write_text(new_text, encoding="utf-8")
    return "added"


def main(paths):
    for p in paths:
        path = Path(p)
        if not path.exists():
            print(f"SKIP (not found): {p}")
            continue
        result = process(path)
        print(f"{path.name}: {result}")


if __name__ == "__main__":
    main(sys.argv[1:])
