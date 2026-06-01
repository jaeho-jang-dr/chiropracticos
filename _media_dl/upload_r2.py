"""Upload Ch13 NotebookLM videos + slide decks to R2.
Run from repo root after artifacts are downloaded into this dir.
Files present in this dir are uploaded by extension."""
import os, sys
from pathlib import Path

try:
    import boto3
except ImportError:
    os.system(f'"{sys.executable}" -m pip install boto3')
    import boto3

# .env는 sibling app repo에 있음
env = {}
env_path = Path(r"D:/Entertainments/DevEnvironment/chiropraticos-app/.env")
for line in env_path.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

s3 = boto3.client(
    "s3",
    endpoint_url=env["R2_ENDPOINT"],
    aws_access_key_id=env["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
)
bucket = env.get("R2_BUCKET", "chiropracticos-media")
src_dir = Path(__file__).parent

# 로컬파일명 -> R2 key (재생성분 동일 키 덮어쓰기)
MAP = {
    "02_video_part1_theory.mp4":     ("soft_tissue/videos_v1/02_video_part1_theory.mp4", "video/mp4"),
    "03_video_part2_clinical.mp4":   ("soft_tissue/videos_v1/03_video_part2_clinical.mp4", "video/mp4"),
    "01_part1_basics.pdf":           ("soft_tissue/slides_v1/01_part1_basics.pdf", "application/pdf"),
    "02_part2_affdefeff.pdf":        ("soft_tissue/slides_v1/02_part2_affdefeff.pdf", "application/pdf"),
    "03_part3_techniques.pdf":       ("soft_tissue/slides_v1/03_part3_techniques.pdf", "application/pdf"),
    "04_part4_clinical.pdf":         ("soft_tissue/slides_v1/04_part4_clinical.pdf", "application/pdf"),
    "01_episode1_history.m4a":       ("soft_tissue/podcasts_v3/01_episode1_history.m4a", "audio/mp4"),
    "03_episode3_treatment.m4a":     ("soft_tissue/podcasts_v3/03_episode3_treatment.m4a", "audio/mp4"),
    "04_episode4_critical.m4a":      ("soft_tissue/podcasts_v3/04_episode4_critical.m4a", "audio/mp4"),
}

done = []
for fname, (key, ctype) in MAP.items():
    src = src_dir / fname
    if not src.exists():
        print(f"  skip (not downloaded yet): {fname}")
        continue
    mb = src.stat().st_size / 1024 / 1024
    print(f"Uploading {fname} ({mb:.1f} MB) -> {key}")
    s3.upload_file(str(src), bucket, key,
                   ExtraArgs={"ContentType": ctype, "CacheControl": "public, max-age=31536000, immutable"})
    done.append(key)
    print("  OK")

print("\nuploaded:", done)
print("public base:", env.get("R2_PUBLIC_URL") or env.get("R2_PUBLIC_BASE"))
