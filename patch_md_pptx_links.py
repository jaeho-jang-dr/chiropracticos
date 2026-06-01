"""
One-off patch: rewrite <a href="./foo.md"> to viewer URLs and swap .pptx links to
matching .pdf when the PDF exists (PDF renders inline in every browser).
Idempotent — safe to run multiple times.
"""
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(r"G:\내 드라이브\chiropracticos")

# Match an <a ... href="./PATH.md"> or href="./PATH.md#anchor"
# Path cannot contain quote/space/angle brackets.
MD_HREF_RE = re.compile(r'href="\.\/([^"<>\s]+\.md(?:#[^"]*)?)"')

# Match <a ... href="./PATH.pptx"[... download ...]> — we want to swap to PDF.
PPTX_HREF_RE = re.compile(r'href="\.\/([^"<>\s]+)\.pptx"')

# Match <a ... href="./PATH.pptx"> with anything (no existing download attr) in the tag.
# Fallback if PDF doesn't exist — ensure download attr.
PPTX_TAG_RE = re.compile(
    r'(<a\b[^>]*?href="\.\/[^"<>\s]+\.pptx"[^>]*?)(>)',
    re.IGNORECASE,
)


def rewrite_md(m: re.Match) -> str:
    path = m.group(1)
    # skip if already pointing into viewer (shouldn't with this regex, but safe)
    if path.startswith("viewer.html"):
        return m.group(0)
    return f'href="./viewer.html?src={quote(path, safe="/#")}"'


def ensure_download(m: re.Match) -> str:
    opening = m.group(1)
    if re.search(r'\sdownload(\s|=|>)', opening, re.IGNORECASE):
        return m.group(0)
    return f'{opening} download{m.group(2)}'


def swap_pptx_to_pdf(m: re.Match) -> str:
    stem = m.group(1)  # relative path without .pptx
    pdf_path = ROOT / (stem + ".pdf")
    if pdf_path.exists():
        return f'href="./{stem}.pdf"'
    return m.group(0)  # leave unchanged if no PDF yet


def patch_file(path: Path) -> tuple[int, int, int]:
    text = path.read_text(encoding="utf-8")
    before = text

    md_count = len(MD_HREF_RE.findall(text))
    text = MD_HREF_RE.sub(rewrite_md, text)

    # PPTX → PDF swap when PDF exists
    pptx_to_pdf = 0
    def count_and_swap(m):
        nonlocal pptx_to_pdf
        new = swap_pptx_to_pdf(m)
        if new != m.group(0):
            pptx_to_pdf += 1
        return new
    text = PPTX_HREF_RE.sub(count_and_swap, text)

    # For remaining PPTX tags (no PDF yet), ensure download attr
    pptx_download = 0
    def count_and_fix(m):
        nonlocal pptx_download
        opening = m.group(1)
        if not re.search(r'\sdownload(\s|=|>)', opening, re.IGNORECASE):
            pptx_download += 1
        return ensure_download(m)
    text = PPTX_TAG_RE.sub(count_and_fix, text)

    if text != before:
        path.write_text(text, encoding="utf-8")
    return md_count, pptx_to_pdf, pptx_download


def main():
    total_md = 0
    total_pdf = 0
    total_dl = 0
    for html in ROOT.glob("*.html"):
        if html.name == "viewer.html":
            continue
        md_n, pdf_n, dl_n = patch_file(html)
        if md_n or pdf_n or dl_n:
            print(f"{html.name}: MD={md_n}, PPTX→PDF={pdf_n}, download={dl_n}")
            total_md += md_n
            total_pdf += pdf_n
            total_dl += dl_n
    print(f"\nTotal: {total_md} MD rewrites, {total_pdf} PPTX→PDF swaps, {total_dl} download attrs")


if __name__ == "__main__":
    main()
