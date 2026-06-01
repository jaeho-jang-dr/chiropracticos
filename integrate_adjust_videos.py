r"""
Phase 3 — Extract ALL adjustment videos:
  A) Embedded media from Chiropractic (SMT)-장재호.pptx (8 AVI adjust demos)
  B) Standalone WMVs from 정형통증학회 2010/장재호교수님발표/Chiropractic Technique/ (~33 files)
  C) Any remaining clinical WMVs from other folders (dedup by size+name)

Convert all AVIs/WMVs → MP4 and place into archive/videos/adjust/
Write manifest for archive.html.
"""
import hashlib
import json
import os
import shutil
import subprocess
import zipfile
from pathlib import Path

DRIVE = Path(r"G:\내 드라이브")
APP = Path(r"G:\내 드라이브\chiropracticos")
ARCHIVE = APP / "archive"
ADJUST_MP4 = ARCHIVE / "videos" / "adjust"
EMBEDDED_RAW = ARCHIVE / "videos" / "_embedded_raw"

ADJUST_MP4.mkdir(parents=True, exist_ok=True)
EMBEDDED_RAW.mkdir(parents=True, exist_ok=True)


def ffmpeg_convert(src: Path, dst: Path) -> bool:
    if dst.exists() and dst.stat().st_size > 0 and dst.stat().st_mtime >= src.stat().st_mtime:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-nostdin", "-loglevel", "error",
        "-i", str(src),
        "-c:v", "libx264", "-crf", "23", "-preset", "medium",
        "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart",
        "-pix_fmt", "yuv420p",
        str(dst),
    ]
    r = subprocess.run(cmd)
    return r.returncode == 0


def file_hash(path: Path, bytes_limit: int = 4 * 1024 * 1024) -> str:
    """Hash first 4MB — enough to distinguish duplicate videos vs different content."""
    h = hashlib.sha1()
    with path.open("rb") as f:
        h.update(f.read(bytes_limit))
    return h.hexdigest()[:12]


def slug(s: str) -> str:
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch.lower())
        elif ch in " -_":
            out.append("_")
    return "".join(out).strip("_")


# ----- Phase A: Extract embedded media from SMT PPTX -----
def extract_smt_embedded() -> list[dict]:
    pptx = APP / "archive" / "lectures" / "Chiropractic (SMT)-장재호.pptx"
    results = []
    if not pptx.exists():
        print(f"[MISS] {pptx}")
        return results
    target_dir = EMBEDDED_RAW / "smt"
    target_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(pptx) as z:
        for name in z.namelist():
            if name.startswith("ppt/media/") and name.lower().endswith((".avi", ".wmv", ".mp4", ".mov")):
                basename = Path(name).name
                raw_path = target_dir / basename
                if not raw_path.exists() or raw_path.stat().st_size != z.getinfo(name).file_size:
                    with z.open(name) as src, raw_path.open("wb") as dst:
                        shutil.copyfileobj(src, dst)
                # MP4 output — prefix with smt_ so they're distinguishable
                mp4_name = "smt_" + Path(basename).stem.lower() + ".mp4"
                mp4_path = ADJUST_MP4 / mp4_name
                converted = ffmpeg_convert(raw_path, mp4_path)
                results.append({
                    "origin": f"Chiropractic (SMT)-장재호.pptx / {basename}",
                    "dst": str(mp4_path.relative_to(APP)).replace("\\", "/"),
                    "name": mp4_name,
                    "converted": converted,
                })
                print(f"  {'[CONV]' if converted else '[SKIP]':6s} {mp4_name}")
    return results


# ----- Phase B: Convert WMVs from 정형통증학회 2010 -----
def convert_2010_technique() -> list[dict]:
    src_dir = DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "장재호교수님발표" / "Chiropractic Technique"
    results = []
    if not src_dir.exists():
        print(f"[MISS] {src_dir}")
        return results
    for src in sorted(src_dir.glob("*.wmv")):
        mp4_name = "koa2010_" + slug(src.stem) + ".mp4"
        mp4_path = ADJUST_MP4 / mp4_name
        try:
            converted = ffmpeg_convert(src, mp4_path)
        except Exception as e:
            print(f"  [ERR] {src.name}: {e}")
            continue
        results.append({
            "origin": f"정형통증학회 2010 / {src.name}",
            "dst": str(mp4_path.relative_to(APP)).replace("\\", "/"),
            "name": mp4_name,
            "converted": converted,
        })
        print(f"  {'[CONV]' if converted else '[SKIP]':6s} {mp4_name}")
    return results


# ----- Phase C: Any stragglers in other clinical folders (dedup) -----
OTHER_SOURCES = [
    DRIVE / "Dropbox" / "chiropractic neurology 2",                    # 5 WMV
    DRIVE / "Dropbox" / "강의 Interventional Tech" / "PASMISS2006(Jae-Ho Jang)",  # surgical related — may skip
    DRIVE / "Dropbox" / "Chiropractic 장재호",                       # older duplicates
]


def convert_stragglers(already_names: set[str]) -> list[dict]:
    """Convert WMVs not already covered. Dedup by size+name combo."""
    results = []
    seen_sig = set()  # (filename, size)
    # Pre-seed seen with already-converted AVI originals so we don't re-convert same content
    koa_dir = DRIVE / "Dropbox" / "Chiropractic 장재호  KOA 2015"
    for f in koa_dir.glob("*.avi"):
        seen_sig.add((f.name.lower(), f.stat().st_size))
    tech_dir = DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "장재호교수님발표" / "Chiropractic Technique"
    for f in tech_dir.glob("*.wmv"):
        seen_sig.add((f.name.lower(), f.stat().st_size))

    for src_dir in OTHER_SOURCES:
        if not src_dir.exists():
            continue
        for src in sorted(src_dir.glob("*.wmv")):
            sig = (src.name.lower(), src.stat().st_size)
            if sig in seen_sig:
                continue
            seen_sig.add(sig)
            folder_tag = slug(src_dir.name)[:15]
            mp4_name = f"{folder_tag}_{slug(src.stem)}.mp4"
            mp4_path = ADJUST_MP4 / mp4_name
            try:
                converted = ffmpeg_convert(src, mp4_path)
            except Exception as e:
                print(f"  [ERR] {src.name}: {e}")
                continue
            results.append({
                "origin": f"{src_dir.name} / {src.name}",
                "dst": str(mp4_path.relative_to(APP)).replace("\\", "/"),
                "name": mp4_name,
                "converted": converted,
            })
            print(f"  {'[CONV]' if converted else '[SKIP]':6s} {mp4_name}  ←  {src_dir.name}/{src.name}")
    return results


def main():
    print("=== Phase A: SMT PPTX에 embed된 adjust 동영상 추출 ===")
    smt = extract_smt_embedded()
    print(f"  → {len(smt)}개\n")

    print("=== Phase B: 정형통증학회 2010 Chiropractic Technique WMV 변환 ===")
    koa2010 = convert_2010_technique()
    print(f"  → {len(koa2010)}개\n")

    print("=== Phase C: 기타 폴더에서 중복 제외 변환 ===")
    known = set(i["name"] for i in smt + koa2010)
    other = convert_stragglers(known)
    print(f"  → {len(other)}개\n")

    manifest = {
        "smt_embedded": smt,
        "koa2010_wmv": koa2010,
        "other_wmv": other,
        "total": len(smt) + len(koa2010) + len(other),
    }
    manifest_path = ARCHIVE / "adjust_videos_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"총 {manifest['total']}개 adjust 영상 통합 · 매니페스트: {manifest_path.relative_to(APP)}")


if __name__ == "__main__":
    main()
