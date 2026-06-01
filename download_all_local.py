"""
Download all pending artifacts to Drive folders.
- Ch 4-10 audio+video (21 items from successful submissions)
- Ch 2 FN reports (4) + Ch 3 Div v2 reports (4) with correct CLI syntax
"""
import subprocess, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

NLM = r"C:\Users\antigravity\AppData\Roaming\Python\Python313\Scripts\nlm.exe"

def run_dl(type_, nb, aid, out_path, no_progress=True):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cmd = [NLM, "download", type_, nb, "--id", aid, "-o", out_path]
    if no_progress and type_ != "report":
        cmd.append("--no-progress")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
        out = (r.stdout + r.stderr).strip().split("\n")[-1]
        if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
            size = os.path.getsize(out_path)
            print(f"[OK]   {os.path.basename(out_path):45s} {size//1024} KB")
            return True
        else:
            print(f"[FAIL] {os.path.basename(out_path):45s} {out[:80]}")
            return False
    except Exception as e:
        print(f"[ERR ] {os.path.basename(out_path):45s} {e}")
        return False

# ============================
# 1) Ch 2 FN Reports retry (correct syntax)
# ============================
print("=" * 60)
print("Ch 2 FN Reports — 재다운로드")
print("=" * 60)

FN_NB = "e4f43415-ed66-4621-a902-c4c450a6925d"
FN_DIR = r"G:\내 드라이브\chiropracticos\functional_neurology\v2"
fn_reports = [
    ("e422af9c-5945-48e3-b0dc-a18576cb688f", "08_report_part1.md"),
    ("e92ca7ae-8183-4bc7-8ea6-263a9982ee25", "09_report_part2.md"),
    ("e0b00af0-053d-440e-bdf2-58dac617c310", "10_report_part3.md"),
    ("ce469fe3-1f68-454b-839a-a86a4604de9a", "11_report_part4.md"),
]
for aid, fname in fn_reports:
    run_dl("report", FN_NB, aid, os.path.join(FN_DIR, fname))

# ============================
# 2) Ch 3 Div v2 Reports retry
# ============================
print("\n" + "=" * 60)
print("Ch 3 Div v2 Reports — 재다운로드")
print("=" * 60)

DIV_NB = "291e66c6-c8b5-4de0-9ef9-f3bab92ac4ff"
DIV_DIR = r"G:\내 드라이브\chiropracticos\diversified\v2"
div_reports = [
    ("b523bd76-d4b0-41ff-9138-9a763c42d397", "08_report_week1_v2.md"),
    ("f13672a0-9936-4eff-b8ce-148aa4c287e6", "09_report_week2_v2.md"),
    ("6f987086-c773-4e19-b55d-4adf02ec2132", "10_report_week3_v2.md"),
    ("707cb1ed-b69f-40fb-87ae-93cb2745a246", "11_report_week4_v2.md"),
]
for aid, fname in div_reports:
    run_dl("report", DIV_NB, aid, os.path.join(DIV_DIR, fname))

# ============================
# 3) Ch 4-10 Audio+Video from manifest
# ============================
print("\n" + "=" * 60)
print("Ch 4-10 Audio + Video — 다운로드 (21 artifacts)")
print("=" * 60)

# Parse manifest built from earlier batch results
with open(r"D:\Entertainments\DevEnvironment\chiropraticos\chapters4to12-av-results.json", encoding="utf-8") as f:
    results = json.load(f)

import re
CHAPTER_MAP = {
    4: ("gonstead",       "4e8b2040-ae5a-438c-90ad-a8acc7a542f2"),
    5: ("toggle_recoil",  "2b8b7956-cc5e-4591-a0c1-b0904f95d591"),
    6: ("thompson",       "b01b6979-fff3-432e-b62c-d351a389b853"),
    7: ("activator",      "b250bba3-2ff3-44e1-9bd0-3b0fb26aaabd"),
    8: ("cox",            "4c81bbd8-19e9-4727-9e48-eaf5a0a389b2"),
    9: ("logan",          "a8039cf8-6d09-49f4-b80b-9e5e78c0a968"),
    10:("sot",            "2b73a534-51e0-4404-8538-7b60bc4dc780"),
}

for row in results:
    label, status, detail = row
    if status != "SUBMITTED":
        continue
    m = re.match(r"ch(\d+)_(\w+?)_(podcast|video\d?|video|audio)$", label)
    if not m:
        continue
    ch_num = int(m.group(1))
    typ_kind = m.group(3)
    if ch_num not in CHAPTER_MAP:
        continue

    tech_slug, nb_id = CHAPTER_MAP[ch_num]
    tech_dir = os.path.join(r"G:\내 드라이브\chiropracticos", tech_slug)

    # Extract artifact_id
    am = re.search(r"artifact_id': '([^']+)'", detail)
    if not am:
        continue
    aid = am.group(1)

    if typ_kind == "podcast":
        run_dl("audio", nb_id, aid, os.path.join(tech_dir, f"01_podcast.m4a"))
    elif typ_kind in ("video1", "video"):
        suffix = typ_kind.replace("video", "") or "1"
        fname = f"02_video_part{suffix}.mp4" if typ_kind == "video1" else f"02_video.mp4"
        run_dl("video", nb_id, aid, os.path.join(tech_dir, fname))
    elif typ_kind == "video2":
        run_dl("video", nb_id, aid, os.path.join(tech_dir, "03_video_part2.mp4"))

print("\n=== 완료 ===")
