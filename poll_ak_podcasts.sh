#!/bin/bash
set -u
NOTEBOOK=416ef164-398d-46f0-8d11-45558467bd7f
EP1=5c1642e1; EP2=2c8e4d6b; EP3=2073fa93; EP4=4d22e1d5
for i in $(seq 1 30); do
  PYTHONIOENCODING=utf-8 PYTHONUTF8=1 nlm studio status $NOTEBOOK -j > nlm_status.json 2>/dev/null || true
  READY=$(python -c "
import json
ids = {\"5c1642e1\",\"2c8e4d6b\",\"2073fa93\",\"4d22e1d5\"}
try:
    data = json.load(open(\"nlm_status.json\", encoding=\"utf-8\"))
    n = sum(1 for a in data if a.get(\"type\")==\"audio\" and a.get(\"id\",\"\")[:8] in ids and a.get(\"audio_url\"))
    print(n)
except Exception:
    print(0)
" 2>/dev/null)
  TS=$(date +%H:%M:%S)
  echo "[$TS] poll #$i — $READY/4 audio_urls ready"
  if [ "$READY" = "4" ]; then echo "[DONE] all 4 ready"; exit 0; fi
  sleep 60
done
echo "[TIMEOUT] still waiting after 30 polls (~30 min)"
exit 1

