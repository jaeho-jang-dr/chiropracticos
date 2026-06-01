"""
PPTX -> PDF batch converter using Microsoft PowerPoint COM.
Skips files whose PDF already exists and is newer than the PPTX.
"""
import os
import sys
import time
from pathlib import Path

import win32com.client
from pywintypes import com_error

ROOT = Path(r"G:\내 드라이브\chiropracticos")
PPT_SAVE_AS_PDF = 32  # ppSaveAsPDF


def needs_convert(pptx: Path) -> Path | None:
    pdf = pptx.with_suffix(".pdf")
    if not pdf.exists():
        return pdf
    if pdf.stat().st_mtime < pptx.stat().st_mtime:
        return pdf
    return None


def convert_all():
    pptx_files = sorted(ROOT.rglob("*.pptx"))
    to_do = [(p, needs_convert(p)) for p in pptx_files]
    to_do = [(src, dst) for src, dst in to_do if dst is not None]

    if not to_do:
        print("모든 PDF가 최신입니다. 변환할 파일 없음.")
        return

    print(f"변환 대상: {len(to_do)}개 PPTX")

    powerpoint = win32com.client.Dispatch("PowerPoint.Application")
    # PowerPoint hates being fully invisible on some Office 365 versions,
    # so we keep it minimized instead.
    try:
        for i, (src, dst) in enumerate(to_do, start=1):
            print(f"[{i}/{len(to_do)}] {src.relative_to(ROOT)} -> {dst.name}")
            try:
                deck = powerpoint.Presentations.Open(
                    str(src), WithWindow=False, ReadOnly=True
                )
                deck.SaveAs(str(dst), PPT_SAVE_AS_PDF)
                deck.Close()
                # brief pause to avoid COM chattiness
                time.sleep(0.3)
            except com_error as e:
                print(f"  COM 오류: {e}")
            except Exception as e:
                print(f"  예외: {e}")
    finally:
        powerpoint.Quit()

    print("완료.")


if __name__ == "__main__":
    convert_all()
