#!/usr/bin/env bash
# Stop all native stack processes (auth, search, research, frontend).
set -euo pipefail

pkill -f "backend/scripts/dev_auth_server.py" 2>/dev/null || true
pkill -f "backend/scripts/dev_search_server.py" 2>/dev/null || true
pkill -f "backend/scripts/dev_research_server.py" 2>/dev/null || true
pkill -f "backend/scripts/dev_stack.py" 2>/dev/null || true
# Note: do not kill run_native_stack.py here — it invokes this script on startup.

# Stop Next.js dev servers for this project only
for pid in $(pgrep -f "next dev" 2>/dev/null || true); do
  cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || echo "")
  if [[ "$cwd" == *"Bakilat2.0/frontend"* ]]; then
    kill "$pid" 2>/dev/null || true
  fi
done

sleep 2
echo "Native stack stopped."
