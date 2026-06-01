r"""Check Day 2 status + download completed, report slide_deck quota state."""
import json
import os
import subprocess
import sys
import io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

NLM = r"C:\Users\antigravity\AppData\Roaming\Python\Python313\Scripts\nlm.exe"
APP = Path(r"G:\내 드라이브\chiropracticos")
env = os.environ.copy()
env["PYTHONIOENCODING"] = "utf-8"

with open(r"D:\Entertainments\DevEnvironment\chiropraticos\day2-submissions-2026-04-24.json", encoding="utf-8") as f:
    d = json.load(f)

all_subs = d["slide_decks_succeeded_today"] + d["reports_all_succeeded"]

# Group by notebook
notebooks = {}
for s in all_subs:
    notebooks.setdefault(s["notebook_id"], []).append(s)

CH_MAP = {
    "4e8b2040-ae5a-438c-90ad-a8acc7a542f2": ("gonstead", "Ch 4 Gonstead"),
    "2b8b7956-cc5e-4591-a0c1-b0904f95d591": ("toggle_recoil", "Ch 5 Toggle"),
    "b01b6979-fff3-432e-b62c-d351a389b853": ("thompson", "Ch 6 Thompson"),
    "b250bba3-2ff3-44e1-9bd0-3b0fb26aaabd": ("activator", "Ch 7 Activator"),
    "4c81bbd8-19e9-4727-9e48-eaf5a0a389b2": ("cox", "Ch 8 Cox"),
    "a8039cf8-6d09-49f4-b80b-9e5e78c0a968": ("logan", "Ch 9 Logan"),
    "2b73a534-51e0-4404-8538-7b60bc4dc780": ("sot", "Ch 10 SOT"),
    "37eea36e-8142-45af-b223-108d078ebd09": ("cbp", "Ch 11 CBP"),
    "416ef164-398d-46f0-8d11-45558467bd7f": ("ak", "Ch 12 AK"),
}


def dst_path(sub):
    nb = sub["notebook_id"]
    slug, _ = CH_MAP[nb]
    base = APP / slug
    name = sub["name"]

    # slide_deck (Activator P1-3)
    if "slides" in name:
        part = int(name[-1])
        return base / f"0{3+part}_slides_part{part}.pptx"

    # report
    if "report" in name:
        if "w" in name and name[-2] == "w":
            w = int(name[-1])
            return base / f"0{7+w}_report_week{w}.md"
        else:
            return base / "report_extra.md"
    return base / (name + ".bin")


print("=== Day 2 제출물 상태 ===\n")
completed = []
in_progress = []
errors = []

for nb_id, items in notebooks.items():
    r = subprocess.run([NLM, "studio", "status", nb_id, "--json"],
                       capture_output=True, text=True, encoding="utf-8", env=env)
    if r.returncode != 0:
        print(f"[ERR] {nb_id}: {r.stderr[:200]}")
        continue
    try:
        arts = json.loads(r.stdout)
    except:
        continue
    art_map = {a["id"]: a for a in arts}
    for sub in items:
        aid = sub["artifact_id"]
        if aid in art_map:
            st = art_map[aid].get("status", "?")
            if st == "completed":
                completed.append(sub)
            elif st == "in_progress":
                in_progress.append(sub)
            else:
                errors.append((sub, st))

print(f"완료: {len(completed)} · 진행중: {len(in_progress)} · 오류: {len(errors)}\n")

# Download completed
downloaded = 0
skipped = 0
failed_dl = 0

for sub in completed:
    dst = dst_path(sub)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size > 1000:
        skipped += 1
        continue

    type_cmd = {"audio": "audio", "video": "video",
                "slide_deck": "slide-deck", "report": "report"}
    # Infer type from name
    if "slides" in sub["name"]:
        t_cmd = "slide-deck"
        extra = ["--format", "pptx"]
    elif "report" in sub["name"]:
        t_cmd = "report"
        extra = []
    else:
        t_cmd = "audio"
        extra = []

    base_flags = ["--output", str(dst)]
    if t_cmd != "report":
        base_flags.append("--no-progress")
    cmd = [NLM, "download", t_cmd, sub["notebook_id"],
           "--id", sub["artifact_id"]] + base_flags + extra
    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding="utf-8", env=env, timeout=300)
    if r.returncode == 0 and dst.exists() and dst.stat().st_size > 0:
        sz = dst.stat().st_size
        print(f"  ✅ {sub['name']:35s} {sz:>12,} B")
        downloaded += 1
    else:
        print(f"  ❌ {sub['name']:35s} {(r.stderr or r.stdout)[:150]}")
        failed_dl += 1

print(f"\n다운로드: 신규 {downloaded} / 기존 {skipped} / 실패 {failed_dl}")
if in_progress:
    print(f"\n진행중 ({len(in_progress)}건):")
    for s in in_progress:
        print(f"  ⏳ {s['name']}")
