"""
Keep only the first <abbr class="med-abbr" title="...">X</abbr> per file per abbreviation.
Subsequent occurrences are reverted to plain text X.
"""
import re
import sys
import io
from pathlib import Path

# Force UTF-8 stdout (Windows console default is cp949)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# Pattern matches: <abbr class="med-abbr" title="...">CONTENT</abbr>
# title may contain anything except double-quote
PATTERN = re.compile(
    r'<abbr class="med-abbr" title="[^"]*">([^<]+)</abbr>'
)

def dedupe(text: str) -> tuple[str, dict]:
    seen: dict[str, int] = {}
    counts: dict[str, list[int]] = {}  # name -> [kept, removed]

    def replace(m: re.Match) -> str:
        content = m.group(1)
        counts.setdefault(content, [0, 0])
        if content not in seen:
            seen[content] = 1
            counts[content][0] += 1
            return m.group(0)  # keep abbr wrapper
        else:
            seen[content] += 1
            counts[content][1] += 1
            return content  # plain text

    new_text = PATTERN.sub(replace, text)
    return new_text, counts


def main(paths: list[str]) -> None:
    for p in paths:
        path = Path(p)
        if not path.exists():
            print(f"SKIP (not found): {p}")
            continue
        text = path.read_text(encoding="utf-8")
        new_text, counts = dedupe(text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            total_kept = sum(c[0] for c in counts.values())
            total_removed = sum(c[1] for c in counts.values())
            print(f"\n{path.name}: kept {total_kept}, removed {total_removed}")
            for name in sorted(counts.keys()):
                kept, removed = counts[name]
                if removed > 0:
                    print(f"  {name}: kept 1, reverted {removed}")
        else:
            print(f"{path.name}: no changes")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python dedupe_abbr.py <file1> [file2 ...]")
        sys.exit(1)
    main(sys.argv[1:])
