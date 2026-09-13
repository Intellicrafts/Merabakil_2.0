#!/usr/bin/env bash
# Run Lighthouse on key public pages (requires: npm run build && npm run start, plus npx lighthouse).
set -euo pipefail

BASE="${1:-http://localhost:3000}"
PAGES=("/" "/register" "/mera-vakil" "/privacy")

echo "Lighthouse audit against ${BASE}"
for page in "${PAGES[@]}"; do
  echo "→ ${page}"
  npx lighthouse "${BASE}${page}" \
    --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless" \
    --output=json \
    --output-path="./lighthouse$(echo "$page" | tr '/' '-').json" \
    --quiet
done

echo "Done. Review lighthouse-*.json files in frontend/."
