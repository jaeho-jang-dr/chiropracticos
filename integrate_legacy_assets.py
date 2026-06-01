"""
Integrate legacy chiropractic assets from Dropbox into the app's chapter folders.

Phase 1 (images only — video conversion deferred):
- Ch 1 Introduction: 13 textbook covers → images/chapter1/references/
- Ch 2 FN: 9 ultrasound images → images/chapter2/ultrasound/
- Ch 5 Toggle Recoil: Fencer + Toggle stance → images/chapter5/stances/
- Ch 10 SOT or general: 9 chiropractic table photos → images/equipment/tables/
- X-ray cases: 29 patient X-rays → images/clinical_cases/xrays/ (shared)

Generates `images/legacy_manifest.json` listing what was copied.
Idempotent: skips files already copied with same size.
"""
import json
import shutil
from pathlib import Path

DROPBOX = Path(r"G:\내 드라이브\Dropbox")
APP_ROOT = Path(r"G:\내 드라이브\chiropracticos")
IMAGES = APP_ROOT / "images"


def copy(src: Path, dst: Path) -> bool:
    """Copy src→dst. Return True if actually copied, False if skipped (already exists same size)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size == src.stat().st_size:
        return False
    shutil.copy2(src, dst)
    return True


def plan() -> list[tuple[Path, Path, str]]:
    """Return [(src, dst, caption_category)] mappings."""
    m = []

    # Ch 1: textbook covers
    books = DROPBOX / "카이로책"
    for f in sorted(books.glob("*.jpg")):
        m.append((f, IMAGES / "chapter1" / "references" / f.name, "textbook"))

    # Ch 2: ultrasound
    us = DROPBOX / "초음파영상"
    for f in sorted(us.glob("*.jpg")):
        m.append((f, IMAGES / "chapter2" / "ultrasound" / f.name, "ultrasound"))

    # Ch 5 Toggle Recoil: stances
    koa = DROPBOX / "Chiropractic 장재호  KOA 2015"
    for name in ("Fencer stance.jpg", "Toggle stance.jpg"):
        src = koa / name
        if src.exists():
            m.append((src, IMAGES / "chapter5" / "stances" / name, "stance"))

    # Equipment — chiropractic tables (shared, not chapter-specific)
    tables = DROPBOX / "카이로테이블"
    for f in sorted(list(tables.glob("*.jpg")) + list(tables.glob("*.JPG"))):
        m.append((f, IMAGES / "equipment" / "tables" / f.name, "table"))

    # Patient X-ray cases (shared)
    xrays = DROPBOX / "환자케이스 2015 01"
    for f in sorted(xrays.glob("*.jpg")):
        m.append((f, IMAGES / "clinical_cases" / "xrays" / f.name, "xray"))

    return m


def main():
    mapping = plan()
    copied = []
    skipped = 0
    manifest = {"textbook": [], "ultrasound": [], "stance": [], "table": [], "xray": []}

    for src, dst, category in mapping:
        if not src.exists():
            print(f"[MISSING] {src}")
            continue
        rel = str(dst.relative_to(APP_ROOT)).replace("\\", "/")
        if copy(src, dst):
            copied.append(rel)
        else:
            skipped += 1
        manifest[category].append({
            "src": str(src),
            "dst": rel,
            "name": src.name,
        })

    manifest_path = IMAGES / "legacy_manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"복사: {len(copied)}개, 스킵(이미 존재): {skipped}개")
    for cat, items in manifest.items():
        print(f"  {cat}: {len(items)}개")
    print(f"매니페스트: {manifest_path.relative_to(APP_ROOT)}")


if __name__ == "__main__":
    main()
