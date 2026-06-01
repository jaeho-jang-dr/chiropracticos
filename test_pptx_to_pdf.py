"""Test pptx->pdf via Microsoft PowerPoint COM automation."""
import os
import sys

import win32com.client

SRC = r"G:\내 드라이브\chiropracticos\diversified\04_slides_week1.pptx"
DST = r"G:\내 드라이브\chiropracticos\diversified\04_slides_week1.pdf"

powerpoint = win32com.client.Dispatch("PowerPoint.Application")
try:
    deck = powerpoint.Presentations.Open(SRC, WithWindow=False)
    # 32 = ppSaveAsPDF
    deck.SaveAs(DST, 32)
    deck.Close()
    print(f"OK: {os.path.getsize(DST)} bytes at {DST}")
finally:
    powerpoint.Quit()
