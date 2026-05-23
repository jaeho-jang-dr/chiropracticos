#!/usr/bin/env bash
# =============================================================================
# Chiropractic-kr 배포 자동화 스크립트
# =============================================================================
# Usage:
#   ./deploy.sh "commit message"
#   ./deploy.sh                       # uses default commit message
#   VERCEL_TOKEN=xxx ./deploy.sh ...  # override token
#
# What it does:
#   1. Bump ?v=YYYYMMDDX in all HTML asset references
#   2. git add + commit with provided message
#   3. git push origin main
#   4. vercel deploy --prod --force (purges edge cache)
#   5. vercel alias set chiropractic-kr.vercel.app
#   6. Verify all key URLs return 200
#   7. Print live URL
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")"

# ---- Load .env if exists (gitignored, holds secrets) ----
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

# ---- Config (from .env or env vars) ----
PROJECT_ALIAS="${VERCEL_PROJECT_ALIAS:-chiropractic-kr.vercel.app}"
VERCEL_SCOPE="${VERCEL_SCOPE:-perseus-projects-4bc3b911}"
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN in .env or env. Get from https://vercel.com/account/tokens}"
NPM_BIN="${NPM_BIN:-/c/Users/antigravity/AppData/Roaming/npm}"

COMMIT_MSG="${1:-deploy: routine update $(date +%Y-%m-%d)}"

# ---- 1. Bump asset version ----
TODAY=$(date +%Y%m%d)
# Find current version like 20260427b, increment letter (or start at 'a' for new day)
CURRENT_V=$(grep -ohE 'assets/[^"]+\?v=[0-9a-z]+' index.html 2>/dev/null | head -1 | sed 's/.*v=//' || echo "")
if [[ "$CURRENT_V" =~ ^${TODAY}([a-z])$ ]]; then
  LAST_LETTER="${BASH_REMATCH[1]}"
  if [[ "$LAST_LETTER" == "z" ]]; then
    # 27번째 same-day deploy: 2자리로 확장 (aa, ab, ...)
    NEW_V="${TODAY}aa"
  else
    NEXT_LETTER=$(echo "$LAST_LETTER" | tr 'a-y' 'b-z')
    NEW_V="${TODAY}${NEXT_LETTER}"
  fi
elif [[ "$CURRENT_V" =~ ^${TODAY}([a-z])([a-z])$ ]]; then
  # 2자리 rollover: aa→ab→...→az→ba→...
  L1="${BASH_REMATCH[1]}"
  L2="${BASH_REMATCH[2]}"
  if [[ "$L2" == "z" ]]; then
    if [[ "$L1" == "z" ]]; then
      NEW_V="${TODAY}aaa"  # 너무 많이 했음 — 3자리로
    else
      L1_NEXT=$(echo "$L1" | tr 'a-y' 'b-z')
      NEW_V="${TODAY}${L1_NEXT}a"
    fi
  else
    L2_NEXT=$(echo "$L2" | tr 'a-y' 'b-z')
    NEW_V="${TODAY}${L1}${L2_NEXT}"
  fi
else
  NEW_V="${TODAY}a"
fi
echo "📌 Cache version: ${CURRENT_V:-none} → $NEW_V"

for f in *.html; do
  python -c "
import re, sys
v = '$NEW_V'
fp = sys.argv[1]
with open(fp, 'r', encoding='utf-8') as f: s = f.read()
new = re.sub(r'(\"./assets/[^\"]+?\.(?:js|css))(?:\?v=[^\"&]*)?(\")', r'\1?v=' + v + r'\2', s)
if new != s:
    with open(fp, 'w', encoding='utf-8') as f: f.write(new)
" "$f"
done
echo "✓ All HTML asset references bumped to ?v=$NEW_V"

# ---- 2. Git commit + push ----
if git diff --quiet && git diff --cached --quiet; then
  echo "ℹ No changes to commit (asset bump may have been a no-op). Continuing to deploy step."
else
  git add -A
  git commit -m "$COMMIT_MSG

Cache bust: ?v=$NEW_V

🤖 Generated with deploy.sh"
fi

git push origin main 2>&1 | tail -3 || echo "⚠ git push failed (continuing — vercel deploys from local)"

# ---- 3. Vercel deploy --force ----
export PATH="$PATH:$NPM_BIN"
echo ""
echo "🚀 Deploying to Vercel (force purge)..."
DEPLOY_OUT=$(vercel deploy --prod --yes --force \
  --token "$VERCEL_TOKEN" \
  --scope "$VERCEL_SCOPE" 2>&1)
NEW_URL=$(echo "$DEPLOY_OUT" | grep -oE "https://chiropractic-[a-z0-9]+-perseus[^\"]+\.vercel\.app" | head -1)

if [[ -z "$NEW_URL" ]]; then
  echo "❌ Deploy failed:"
  echo "$DEPLOY_OUT" | tail -10
  exit 1
fi

echo "✓ New deployment: $NEW_URL"

# ---- 4. Assign alias ----
vercel alias set "$NEW_URL" "$PROJECT_ALIAS" \
  --token "$VERCEL_TOKEN" --scope "$VERCEL_SCOPE" 2>&1 | tail -2
echo "✓ Alias: https://$PROJECT_ALIAS"

# ---- 5. Verify ----
echo ""
echo "🔍 Verifying live URLs..."
fail=0
for path in / /login /signup /admin /guide /chapter04_gonstead; do
  code=$(curl -sLI -o /dev/null -w "%{http_code}" "https://$PROJECT_ALIAS$path")
  if [[ "$code" == "200" ]]; then
    echo "  ✓ $path → $code"
  else
    echo "  ✗ $path → $code"
    fail=1
  fi
done

if [[ $fail -eq 0 ]]; then
  echo ""
  echo "🎯 SUCCESS — https://$PROJECT_ALIAS  (cache v=$NEW_V)"
else
  echo ""
  echo "⚠ Some URLs failed. Check Vercel dashboard."
  exit 2
fi
