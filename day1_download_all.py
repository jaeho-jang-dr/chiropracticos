r"""Download all 18 Day 1 artifacts to proper chapter folders."""
import json
import os
import subprocess
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

NLM = r"C:\Users\antigravity\AppData\Roaming\Python\Python313\Scripts\nlm.exe"
APP = Path(r"G:\내 드라이브\chiropracticos")

with open(r"D:\Entertainments\DevEnvironment\chiropraticos\day1-submissions-2026-04-23.json", encoding="utf-8") as f:
    subs = json.load(f)["submissions"]

# Chapter dir map (prefix → folder)
CH_MAP = {
    "ch11": "cbp",
    "ch12": "ak",
    "ch04": "gonstead",
    "ch05": "toggle_recoil",
    "ch06": "thompson",
}


def dst_path(sub: dict) -> Path:
    name = sub["name"]
    t = sub["type"]
    ch_dir = CH_MAP[name[:4]]
    base = APP / ch_dir

    if t == "audio":
        return base / "01_podcast.m4a"
    if t == "video":
        idx = 1 if name.endswith("video1") else 2
        return base / f"0{idx+1}_video_part{idx}.mp4"
    if t == "slide_deck":
        part = int(name[-1])
        return base / f"0{3+part}_slides_part{part}.pptx"
    return base / f"{name}.bin"


env = os.environ.copy()
env["PYTHONIOENCODING"] = "utf-8"


def download(sub: dict) -> tuple[str, bool, str]:
    dst = dst_path(sub)
    dst.parent.mkdir(parents=True, exist_ok=True)

    # Skip if already exists with decent size
    if dst.exists() and dst.stat().st_size > 10000:
        return (sub["name"], True, f"exists ({dst.stat().st_size:,} B)")

    # Map our internal type to CLI subcommand name
    type_cmd = {"audio": "audio", "video": "video", "slide_deck": "slide-deck"}[sub["type"]]
    # slide-deck pptx
    extra = []
    if sub["type"] == "slide_deck":
        extra = ["--format", "pptx"]

    cmd = [NLM, "download", type_cmd, sub["notebook_id"],
           "--id", sub["artifact_id"],
           "--output", str(dst), "--no-progress"] + extra

    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding="utf-8", env=env, timeout=600)
    if r.returncode == 0 and dst.exists() and dst.stat().st_size > 0:
        return (sub["name"], True, f"{dst.stat().st_size:,} B")
    else:
        return (sub["name"], False, (r.stderr or r.stdout)[:200])


print(f"=== Day 1 다운로드 ({len(subs)}건) ===\n")
success = 0
fail = 0
for sub in subs:
    name, ok, msg = download(sub)
    marker = "✅" if ok else "❌"
    print(f"  {marker} {name:30s}  {msg}")
    if ok:
        success += 1
    else:
        fail += 1

print(f"\n성공 {success} / 실패 {fail}")
