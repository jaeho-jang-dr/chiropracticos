"""
Remove the first <span>...Dr. Jang...</span> from <div class="footer-bottom">,
keeping only the disclaimer span.
"""
import re
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# Match: <div class="footer-bottom">\n  <span>(C/©) 2026 Dr. Jang ... </span>
PATTERN = re.compile(
    r'(<div class="footer-bottom">)\s*<span>[^<]*Dr\.\s*Jang[^<]*</span>',
    re.DOTALL,
)


def process(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    new_text, n = PATTERN.subn(r'\1', text)
    if n == 0:
        return "no match"
    path.write_text(new_text, encoding="utf-8")
    return f"removed {n}"


if __name__ == "__main__":
    for p in sys.argv[1:]:
        path = Path(p)
        if not path.exists():
            print(f"SKIP: {p}")
            continue
        print(f"{path.name}: {process(path)}")
