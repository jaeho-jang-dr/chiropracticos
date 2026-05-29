"""Upload Ch 13 Soft Tissue v3 4-part podcasts to R2."""
import os
import sys
from pathlib import Path

try:
    import boto3
except ImportError:
    os.system(f'"{sys.executable}" -m pip install boto3')
    import boto3

# Load .env
env = {}
env_path = Path(__file__).parent.parent / ".env"
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

files = [
    "01_episode1_history.m4a",
    "02_episode2_assessment.m4a",
    "03_episode3_treatment.m4a",
    "04_episode4_critical.m4a",
]

for fname in files:
    src = src_dir / fname
    key = f"soft_tissue/podcasts_v3/{fname}"
    size_mb = src.stat().st_size / 1024 / 1024
    print(f"Uploading {fname} ({size_mb:.1f} MB) -> {key}")
    s3.upload_file(
        str(src),
        bucket,
        key,
        ExtraArgs={"ContentType": "audio/mp4", "CacheControl": "public, max-age=31536000, immutable"},
    )
    print(f"  OK")

print("\nAll 4 episodes uploaded.")
print(f"Public URL pattern: {env.get('R2_PUBLIC_URL', '(check .env)')}/soft_tissue/podcasts_v3/<file>")
