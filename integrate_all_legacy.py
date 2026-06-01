r"""
Phase 2 — Comprehensive legacy asset integration.

Copies/converts the user's pre-existing chiropractic materials from Google Drive
into the app archive, organized for the web app.

Destination layout under G:\내 드라이브\chiropracticos\archive\:
  archive/lectures/               — PPT/PPTX/DOC/HWP/PDF (+ converted PDFs for inline view)
  archive/videos/neurologic_exam/ — 8 MP4 (already converted)
  archive/videos/techniques/      — converted MP4 from KOA 2015 AVI
  archive/videos/lectures/        — converted MP4 from 2010 Chiropractic Technique WMV

Generates archive/manifest.json listing everything copied.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

DRIVE = Path(r"G:\내 드라이브")
APP = Path(r"G:\내 드라이브\chiropracticos")
ARCHIVE = APP / "archive"

LECTURES_DIR = ARCHIVE / "lectures"
VIDEOS_NEURO = ARCHIVE / "videos" / "neurologic_exam"
VIDEOS_TECH = ARCHIVE / "videos" / "techniques"
VIDEOS_LECTURE = ARCHIVE / "videos" / "lectures"

for d in (LECTURES_DIR, VIDEOS_NEURO, VIDEOS_TECH, VIDEOS_LECTURE):
    d.mkdir(parents=True, exist_ok=True)


def safe_copy(src: Path, dst: Path) -> bool:
    if not src.exists():
        return False
    if dst.exists() and dst.stat().st_size == src.stat().st_size:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


# ---- Phase A: Copy MP4 neurologic exams from Drive root ----
def copy_mp4_neuro() -> list[dict]:
    items = []
    for f in sorted(DRIVE.glob("0*.MP4")) + sorted(DRIVE.glob("0*.mp4")):
        # e.g. "01 Sensory Pain.MP4"
        dst = VIDEOS_NEURO / f.name
        copied = safe_copy(f, dst)
        items.append({"src": str(f), "dst": str(dst.relative_to(APP)).replace("\\", "/"),
                      "name": f.name, "copied": copied})
    return items


# ---- Phase B: Collect all lecture documents ----
LECTURE_SRC_PATTERNS = [
    # direct files
    DRIVE / "Neurologic Exam 2015.pptx",
    DRIVE / "Dropbox" / "chiropractic neurology 2" / "Chiropractic Neurology.pptx",
    DRIVE / "Dropbox" / "chiropractic neurology 2" / "Neurologic examination.docx",
    DRIVE / "Dropbox" / "Chiropractic 장재호" / "Chiropractic (SMT)-장재호.pptx",
    DRIVE / "Dropbox" / "Chiropractic 장재호" / "Chiropractic.ppt",
    DRIVE / "Dropbox" / "Chiropractic 장재호" / "2006chiro광주발표.ppt",
    DRIVE / "Dropbox" / "Chiropractic 장재호  KOA 2015" / "Chiropractic (SMT)-장재호.pptx",
    DRIVE / "Dropbox" / "Spine Intervention" / "Chiropractic Neurology.pptx",
    DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "장재호교수님발표" / "Chirosymposium.ppt",
    DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "장재호교수님발표" / "도수치료.hwp",
    DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "장재호교수님발표" / "Chiropractic Technique" / "Chirotech.ppt",
    DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "장재호교수님발표" / "Chiropractic Technique" / "Chiropractic.ppt",
    DRIVE / "Dropbox" / "Spine Intervention" / "정형통증학회 강의 2010" / "Caucal Block" / "도수치료-교과서.hwp",
]


def collect_lectures() -> list[dict]:
    items = []
    seen = set()
    for src in LECTURE_SRC_PATTERNS:
        if not src.exists():
            continue
        # dedupe by filename (some filenames appear in multiple folders)
        key = src.name
        if key in seen:
            continue
        seen.add(key)
        dst = LECTURES_DIR / src.name
        copied = safe_copy(src, dst)
        items.append({"src": str(src), "dst": str(dst.relative_to(APP)).replace("\\", "/"),
                      "name": src.name, "copied": copied})
    return items


# ---- Phase C: Convert PPT/PPTX lectures to PDF via PowerPoint ----
def convert_office_to_pdf(office_paths: list[Path]) -> list[dict]:
    import win32com.client
    from pywintypes import com_error
    powerpoint = win32com.client.Dispatch("PowerPoint.Application")
    items = []
    try:
        for src in office_paths:
            if src.suffix.lower() not in (".ppt", ".pptx"):
                continue
            pdf = src.with_suffix(".pdf")
            if pdf.exists() and pdf.stat().st_mtime >= src.stat().st_mtime:
                items.append({"src": str(src), "pdf": str(pdf.relative_to(APP)).replace("\\", "/"),
                              "converted": False})
                continue
            try:
                deck = powerpoint.Presentations.Open(str(src), WithWindow=False, ReadOnly=True)
                deck.SaveAs(str(pdf), 32)  # ppSaveAsPDF
                deck.Close()
                items.append({"src": str(src), "pdf": str(pdf.relative_to(APP)).replace("\\", "/"),
                              "converted": True})
                print(f"  PDF: {pdf.name}")
            except com_error as e:
                items.append({"src": str(src), "pdf": None, "error": str(e)})
                print(f"  COM오류 {src.name}: {e}")
    finally:
        powerpoint.Quit()
    return items


# ---- Phase D: Convert AVI/WMV technique demos to MP4 ----
def ffmpeg_convert(src: Path, dst: Path) -> bool:
    """H.264 + AAC, web-friendly. Idempotent."""
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


# Specific AVI/WMV sources worth converting (skip duplicates / redundant)
TECH_AVI_SOURCES = {
    # KOA 2015 — technique demonstrations
    "Activator Tech.avi": VIDEOS_TECH / "activator_tech.mp4",
    "AP Thoracic.avi": VIDEOS_TECH / "ap_thoracic.mp4",
    "Bilateral Hyphothenar push.avi": VIDEOS_TECH / "bilateral_hypothenar_push.mp4",
    "CBP Tech head.avi": VIDEOS_TECH / "cbp_tech_head.mp4",
    "CBP Tech Trunk.avi": VIDEOS_TECH / "cbp_tech_trunk.mp4",
    "Diversified Nelson pull 6.avi": VIDEOS_TECH / "diversified_nelson_pull.mp4",
    "Gonstead sitting.avi": VIDEOS_TECH / "gonstead_sitting.mp4",
    "Hypothenar Ilium push.avi": VIDEOS_TECH / "hypothenar_ilium_push.mp4",
    "Hypothenar sacral apex push.avi": VIDEOS_TECH / "hypothenar_sacral_apex_push.mp4",
    "Index Atlas push prone rt.avi": VIDEOS_TECH / "index_atlas_push_prone_rt.mp4",
    "Index Atlas push sup lt.avi": VIDEOS_TECH / "index_atlas_push_sup_lt.mp4",
    "Index Atlas push sup rt.avi": VIDEOS_TECH / "index_atlas_push_sup_rt.mp4",
    "Index pillar push sup rt.avi": VIDEOS_TECH / "index_pillar_push_sup_rt.mp4",
    "Leander Tech.avi": VIDEOS_TECH / "leander_tech.mp4",
    "Nimmo Tech.avi": VIDEOS_TECH / "nimmo_tech.mp4",
    "Spinous push and pull.avi": VIDEOS_TECH / "spinous_push_and_pull.mp4",
    "Thompson Tech.avi": VIDEOS_TECH / "thompson_tech.mp4",
    "Thumb movement.avi": VIDEOS_TECH / "thumb_movement.mp4",
}


def convert_tech_videos() -> list[dict]:
    koa = DRIVE / "Dropbox" / "Chiropractic 장재호  KOA 2015"
    items = []
    for fname, dst in TECH_AVI_SOURCES.items():
        src = koa / fname
        if not src.exists():
            continue
        try:
            converted = ffmpeg_convert(src, dst)
        except Exception as e:
            converted = False
            print(f"  FFmpeg 오류 {fname}: {e}")
        items.append({"src": str(src),
                      "dst": str(dst.relative_to(APP)).replace("\\", "/"),
                      "name": dst.name, "converted": converted})
        if converted:
            print(f"  MP4: {dst.name}")
    return items


def main():
    print("=== Phase A: MP4 신경학 검사 복사 ===")
    neuro = copy_mp4_neuro()
    print(f"  {sum(1 for i in neuro if i['copied'])} 복사, {sum(1 for i in neuro if not i['copied'])} 스킵")

    print("\n=== Phase B: 강의 문서 수집 ===")
    lectures = collect_lectures()
    print(f"  {sum(1 for i in lectures if i['copied'])} 복사, {sum(1 for i in lectures if not i['copied'])} 스킵")

    print("\n=== Phase C: PPT→PDF 변환 ===")
    pdf_items = convert_office_to_pdf([LECTURES_DIR / i["name"] for i in lectures])

    print("\n=== Phase D: AVI→MP4 변환 (기술 시연) ===")
    tech_videos = convert_tech_videos()
    print(f"  {sum(1 for i in tech_videos if i['converted'])} 변환, {sum(1 for i in tech_videos if not i['converted'])} 스킵")

    manifest = {
        "neurologic_exam_mp4": neuro,
        "lectures": lectures,
        "lecture_pdfs": pdf_items,
        "technique_videos": tech_videos,
    }
    manifest_path = ARCHIVE / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n매니페스트: {manifest_path.relative_to(APP)}")


if __name__ == "__main__":
    main()
