r"""Check Day 1 artifact status + download all completed files."""
import json
import subprocess
import sys
import io
import os
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

NLM = r"C:\Users\antigravity\AppData\Roaming\Python\Python313\Scripts\nlm.exe"
APP = Path(r"G:\내 드라이브\chiropracticos")

with open(r"D:\Entertainments\DevEnvironment\chiropraticos\day1-submissions-2026-04-23.json", encoding="utf-8") as f:
    subs = json.load(f)["submissions"]

# Build expected artifact_id set
expected_ids = {s["artifact_id"]: s for s in subs}

# Group by notebook
notebooks = {}
for s in subs:
    notebooks.setdefault(s["notebook_id"], []).append(s)

# Download path mapping — per chapter/artifact
def dst_path(sub: dict) -> Path:
    name = sub["name"]
    type_ = sub["type"]

    # Chapter dir map
    ch_map = {
        "ch11": "cbp",
        "ch12": "ak",
        "ch04": "gonstead",
        "ch05": "toggle_recoil",
        "ch06": "thompson",
    }
    prefix = name[:4]
    ch_dir = ch_map.get(prefix, prefix)
    base = APP / ch_dir

    if type_ == "audio":
        return base / "01_podcast.m4a"
    if type_ == "video":
        # distinguish video1/video2
        idx = 1 if name.endswith("video1") else 2
        return base / f"0{idx+1}_video_part{idx}.mp4"
    if type_ == "slide_deck":
        # part1-4 from name suffix "slides1"
        part_num = int(name[-1])
        return base / f"0{3+part_num}_slides_part{part_num}.pptx"
    return base / f"{name}.bin"


# Check each notebook's status
print("=== Day 1 제출물 상태 점검 ===\n")
completed = []
in_progress = []
errors = []

for nb_id, items in notebooks.items():
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    r = subprocess.run([NLM, "studio", "status", nb_id, "--json"],
                       capture_output=True, text=True, encoding="utf-8", env=env)
    if r.returncode != 0:
        print(f"[ERROR] {nb_id}: {r.stderr}")
        continue
    try:
        arts = json.loads(r.stdout)
    except Exception as e:
        print(f"[PARSE-ERR] {nb_id}: {e}")
        continue
    # Build artifact_id → status map
    art_map = {a["id"]: a for a in arts}
    for sub in items:
        aid = sub["artifact_id"]
        if aid in art_map:
            a = art_map[aid]
            st = a.get("status", "unknown")
            if st == "completed":
                completed.append((sub, a))
            elif st == "in_progress":
                in_progress.append(sub)
            else:
                errors.append((sub, st))
        else:
            errors.append((sub, "not-found"))

print(f"완료: {len(completed)} · 진행중: {len(in_progress)} · 오류: {len(errors)}\n")
for sub, _ in completed:
    print(f"  ✅ {sub['name']:30s} [{sub['type']}]")
for sub in in_progress:
    print(f"  ⏳ {sub['name']:30s} [{sub['type']}]")
for sub, st in errors:
    print(f"  ❌ {sub['name']:30s} [{st}]")

# Save status snapshot
snapshot = {
    "checked_at": "2026-04-24",
    "completed": [{"name": s["name"], "artifact_id": s["artifact_id"], "type": s["type"]}
                  for s, _ in completed],
    "in_progress": [{"name": s["name"], "artifact_id": s["artifact_id"], "type": s["type"]}
                    for s in in_progress],
    "errors": [{"name": s["name"], "artifact_id": s["artifact_id"], "type": s["type"], "status": st}
               for s, st in errors],
}
snap_path = Path(r"D:\Entertainments\DevEnvironment\chiropraticos\day1-status-2026-04-24.json")
snap_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n상태 스냅샷: {snap_path}")
