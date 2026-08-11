#!/usr/bin/env bash
# Verify all core services are healthy.
set -euo pipefail

check() {
  local name="$1" url="$2"
  if python3 -c "
import urllib.request, sys
try:
    r = urllib.request.urlopen('$url', timeout=5)
    sys.exit(0 if r.status == 200 else 1)
except Exception:
    sys.exit(1)
" 2>/dev/null; then
    echo "OK  $name — $url"
  else
    echo "FAIL $name — $url"
    return 1
  fi
}

fail=0
check "Auth"     "http://localhost:8001/health" || fail=1
check "Ingestion" "http://localhost:8002/health" || fail=1
check "Search"   "http://localhost:8003/health" || fail=1
check "Research" "http://localhost:8004/health" || fail=1
check "Frontend" "http://localhost:3000" || fail=1

if [ "$fail" -eq 0 ]; then
  echo ""
  echo "All services healthy."
else
  echo ""
  echo "Some services are down. Run: make up"
  exit 1
fi
