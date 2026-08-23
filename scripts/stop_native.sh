#!/usr/bin/env bash
# Stop all native stack processes (auth, search, research, marketplace, frontend).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pkill -f "backend/scripts/dev_auth_server.py" 2>/dev/null || true
pkill -f "backend/scripts/dev_search_server.py" 2>/dev/null || true
pkill -f "backend/scripts/dev_research_server.py" 2>/dev/null || true
pkill -f "backend/scripts/dev_marketplace_server.py" 2>/dev/null || true
pkill -f "backend/scripts/dev_stack.py" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
if [[ "${SKIP_PUBLIC_ORCHESTRATOR:-}" != "1" ]]; then
  pkill -f "backend/scripts/run_public_stack.py" 2>/dev/null || true
fi

# Stop Next.js dev/production servers for this project only
for pid in $(pgrep -f "next dev" 2>/dev/null || true); do
  cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || echo "")
  if [[ "$cwd" == "$ROOT/frontend"* ]]; then
    kill "$pid" 2>/dev/null || true
  fi
done
for pid in $(pgrep -f "next start" 2>/dev/null || true); do
  cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || echo "")
  if [[ "$cwd" == "$ROOT/frontend"* ]]; then
    kill "$pid" 2>/dev/null || true
  fi
done

sleep 2
echo "Native stack stopped."
