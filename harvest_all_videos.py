r"""
Unified video harvester + thumbnail generator.

For every chiropractic/spine video in Drive:
1. PPTX embedded videos → extract via unzip, name as `<PPT-stem>__<media-name>.mp4`
2. External standalone WMV/AVI in technique folders → pair with the companion PPT
   in the same folder if present, else use folder name. Name as
   `<PPT-stem or folder-tag>__<filename-stem>.mp4`
3. Dedup by SHA1(first 4MB) so the same physical video is converted once,
   but manifest records EVERY origin where it appeared.
4. Generate thumbnail (frame at ~3 seconds) for each MP4.

Output:
  archive/videos/harvest/        — all MP4s
  archive/videos/harvest_thumbs/ — JPG thumbnails
  archive/harvest_manifest.json  — {sha, dst, thumb, origins: [{ppt, filename, folder}], duration_s}
"""
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

DRIVE = Path(r"G:\내 드라이브")
APP = Path(r"G:\내 드라이브\chiropracticos")
ARCHIVE = APP / "archive"
HARVEST = ARCHIVE / "videos" / "harvest"
THUMBS = ARCHIVE / "videos" / "harvest_thumbs"

HARVEST.mkdir(parents=True, exist_ok=True)
THUMBS.mkdir(parents=True, exist_ok=True)

# Source folders + their companion PPT/PPTX (if known).
# Each entry: (folder, companion_ppt_name or None)
SOURCE_FOLDERS = [
    # Folder                                                                     companion PPT(s)
    (DRIVE / "Dropbox" / "Chiropractic 장재호  KOA 2015",
        ["Chiropractic (SMT)-장재호.pptx"]),
    (DRIVE / "Dropbox" / "Chiropractic 장재호",
        ["Chiropractic.ppt", "2006chiro광주발표.ppt", "Chiropractic (SMT)-장재호.pptx"]),
    (DRIVE / "Dropbox" / "chiropractic neurology 2",
        ["Chiropractic Neurology.pptx"]),
    (DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "장재호교수님발표" / "Chiropractic Technique",
        ["Chirotech.ppt", "Chiropractic.ppt"]),
    (DRIVE / "Dropbox" / "강의 Interventional Tech" / "Neurologic exam 최종",
        ["Neurologic Exam 2015.pptx"]),
    (DRIVE / "Dropbox" / "강의 Interventional Tech" / "부산일보-시민공개강좌",
        ["Chirotech.ppt"]),  # closest PPT match
    (DRIVE / "Dropbox" / "강의 Interventional Tech" / "PASMISS2006(Jae-Ho Jang)",
        ["2006chiro광주발표.ppt"]),
]

# PPTX files to unpack for embedded media
PPTX_TO_UNPACK = [
    APP / "archive" / "lectures" / "Chiropractic (SMT)-장재호.pptx",
    APP / "archive" / "lectures" / "Chiropractic Neurology.pptx",
    APP / "archive" / "lectures" / "Neurologic Exam 2015.pptx",
]

# Root-level videos (drive root has 01 Sensory Pain.MP4 etc.)
ROOT_VIDEOS_COMPANION = "Neurologic Exam 2015.pptx"

VIDEO_EXTS = {".avi", ".wmv", ".mp4", ".mov", ".mkv", ".mpg", ".mpeg"}


def slug(s: str, maxlen: int = 80) -> str:
    """Make a safe filename fragment, preserving Korean chars."""
    s = re.sub(r"[<>:\"/\\|?*]", "_", s)
    s = re.sub(r"\s+", "_", s.strip())
    return s[:maxlen].strip("_")


def sha_head(path: Path, nbytes: int = 4 * 1024 * 1024) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        h.update(f.read(nbytes))
    # include size to be safe
    h.update(str(path.stat().st_size).encode())
    return h.hexdigest()[:12]


def ffmpeg_to_mp4(src: Path, dst: Path) -> bool:
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


def ffmpeg_thumbnail(src: Path, dst: Path, at_sec: float = 3.0) -> bool:
    if dst.exists() and dst.stat().st_size > 0:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-nostdin", "-loglevel", "error",
        "-ss", str(at_sec),
        "-i", str(src),
        "-vframes", "1",
        "-vf", "scale=480:-2",
        "-q:v", "3",
        str(dst),
    ]
    r = subprocess.run(cmd)
    # Fallback: try at 0.5s if 3s was past end
    if r.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
        cmd2 = [
            "ffmpeg", "-y", "-nostdin", "-loglevel", "error",
            "-ss", "0.5",
            "-i", str(src),
            "-vframes", "1",
            "-vf", "scale=480:-2",
            "-q:v", "3",
            str(dst),
        ]
        r = subprocess.run(cmd2)
    return r.returncode == 0 and dst.exists() and dst.stat().st_size > 0


def probe_duration(path: Path) -> float:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=15,
        )
        return float(r.stdout.strip())
    except Exception:
        return 0.0


def pptx_stem(pptx_name: str) -> str:
    """`Chiropractic (SMT)-장재호.pptx` → `Chiropractic_SMT_장재호`."""
    s = Path(pptx_name).stem
    s = s.replace("(", "").replace(")", "").replace("-", "_")
    return slug(s, maxlen=60)


def extract_pptx_embedded() -> list[dict]:
    """Yield candidate entries from PPTX internals."""
    entries = []
    for pptx in PPTX_TO_UNPACK:
        if not pptx.exists():
            continue
        ptag = pptx_stem(pptx.name)
        with zipfile.ZipFile(pptx) as z:
            for info in z.infolist():
                ext = Path(info.filename).suffix.lower()
                if info.filename.startswith("ppt/media/") and ext in VIDEO_EXTS:
                    media_name = Path(info.filename).name
                    # Extract to temp path
                    raw = ARCHIVE / "videos" / "_embedded_raw" / ptag / media_name
                    raw.parent.mkdir(parents=True, exist_ok=True)
                    if not raw.exists() or raw.stat().st_size != info.file_size:
                        with z.open(info.filename) as src, raw.open("wb") as dst:
                            shutil.copyfileobj(src, dst)
                    entries.append({
                        "raw": raw,
                        "origin": {
                            "ppt": pptx.name,
                            "filename": media_name,
                            "folder": "EMBEDDED",
                            "source_type": "pptx-embedded",
                        },
                        "base_name": f"{ptag}__{Path(media_name).stem}",
                    })
    return entries


def collect_external_videos() -> list[dict]:
    """Scan SOURCE_FOLDERS + drive root for standalone video files."""
    entries = []
    # Drive root
    for f in sorted(DRIVE.glob("*.MP4")) + sorted(DRIVE.glob("*.mp4")) + sorted(DRIVE.glob("*.wmv")) + sorted(DRIVE.glob("*.avi")):
        # Accept only known clinical basenames to avoid noise
        name_lower = f.name.lower()
        if any(k in name_lower for k in (
            "sensory pain", "weber", "motor", "reflex", "cnf test", "loc", "posturegait", "supine exam",
            "동영상_", "황용태",
        )):
            ptag = pptx_stem(ROOT_VIDEOS_COMPANION)
            entries.append({
                "raw": f,
                "origin": {
                    "ppt": ROOT_VIDEOS_COMPANION,
                    "filename": f.name,
                    "folder": "G_root",
                    "source_type": "drive-root",
                },
                "base_name": f"{ptag}__{slug(f.stem)}",
            })

    # Explicit folders
    for folder, ppts in SOURCE_FOLDERS:
        if not folder.exists():
            continue
        # Pick the first available PPT in the folder itself, else the listed companions
        present_in_folder = [p for p in folder.glob("*.ppt")] + [p for p in folder.glob("*.pptx")]
        if present_in_folder:
            ptag = pptx_stem(present_in_folder[0].name)
            ppt_name = present_in_folder[0].name
        else:
            ptag = pptx_stem(ppts[0]) if ppts else slug(folder.name)
            ppt_name = ppts[0] if ppts else ""
        for f in folder.iterdir():
            if f.is_file() and f.suffix.lower() in VIDEO_EXTS:
                entries.append({
                    "raw": f,
                    "origin": {
                        "ppt": ppt_name,
                        "filename": f.name,
                        "folder": str(folder.relative_to(DRIVE)).replace("\\", "/"),
                        "source_type": "external-standalone",
                    },
                    "base_name": f"{ptag}__{slug(f.stem)}",
                })
    return entries


def main():
    print("=== Scanning PPTX embedded media ===")
    embedded = extract_pptx_embedded()
    print(f"  {len(embedded)} embedded videos found in PPTXs")

    print("=== Scanning external video files ===")
    external = collect_external_videos()
    print(f"  {len(external)} external video files found")

    all_entries = embedded + external
    print(f"=== Total candidates: {len(all_entries)} ===\n")

    # Dedup by SHA; keep all origins
    by_sha: dict[str, dict] = {}
    for e in all_entries:
        raw = e["raw"]
        if not raw.exists():
            continue
        try:
            sig = sha_head(raw)
        except Exception as ex:
            print(f"  [HASH-ERR] {raw}: {ex}")
            continue
        if sig not in by_sha:
            by_sha[sig] = {
                "sha": sig,
                "raw": raw,
                "base_name": e["base_name"],
                "origins": [e["origin"]],
            }
        else:
            by_sha[sig]["origins"].append(e["origin"])

    print(f"=== Unique videos after dedup: {len(by_sha)} ===")

    manifest = []
    for i, (sig, info) in enumerate(sorted(by_sha.items()), start=1):
        mp4 = HARVEST / f"{info['base_name']}.mp4"
        thumb = THUMBS / f"{info['base_name']}.jpg"
        # Handle collision: if two different SHAs share a base_name (rare), add short sha
        if mp4.exists():
            # Verify it matches; if not, uniqueify
            pass
        existing_other = [p for p in HARVEST.glob(f"{info['base_name']}*") if p.stem != info['base_name']]
        # If name collides with different sha, add suffix
        if (HARVEST / f"{info['base_name']}.mp4").exists() and info["raw"].stat().st_size != (HARVEST / f"{info['base_name']}.mp4").stat().st_size:
            mp4 = HARVEST / f"{info['base_name']}_{sig[:6]}.mp4"
            thumb = THUMBS / f"{info['base_name']}_{sig[:6]}.jpg"

        print(f"[{i}/{len(by_sha)}] {mp4.name}")
        try:
            converted = ffmpeg_to_mp4(info["raw"], mp4)
        except Exception as ex:
            print(f"  convert error: {ex}")
            continue
        if not mp4.exists():
            continue
        thumb_made = ffmpeg_thumbnail(mp4, thumb)
        duration = probe_duration(mp4)

        manifest.append({
            "sha": sig,
            "mp4": str(mp4.relative_to(APP)).replace("\\", "/"),
            "thumb": str(thumb.relative_to(APP)).replace("\\", "/") if thumb.exists() else None,
            "duration_s": round(duration, 2),
            "base_name": info["base_name"],
            "origins": info["origins"],
        })

    manifest_path = ARCHIVE / "harvest_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n총 {len(manifest)} 영상 · 매니페스트: {manifest_path.relative_to(APP)}")


if __name__ == "__main__":
    main()
