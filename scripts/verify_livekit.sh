#!/usr/bin/env bash
# Smoke-check LiveKit env vars and token minting for appointment-room calls.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

read_env_var() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r"' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

if [[ ! -f "$ENV_FILE" ]]; then
  red "Missing $ENV_FILE — copy from .env.example and add LIVEKIT_* values."
  exit 1
fi

missing=0
for key in LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET; do
  val="$(read_env_var "$key")"
  if [[ -z "$val" ]]; then
    red "  $key is empty"
    missing=1
  else
    green "  $key set"
  fi
done

if [[ "$missing" -eq 1 ]]; then
  yellow "See scripts/livekit-setup.md for configuration steps."
  exit 1
fi

yellow "Checking marketplace health (port 8010) …"
if curl -fsS -o /dev/null "http://127.0.0.1:8010/health" 2>/dev/null; then
  green "  Marketplace is up"
else
  yellow "  Marketplace not reachable — start stack: make native"
fi

yellow "Minting test token …"
export LIVEKIT_URL="$(read_env_var LIVEKIT_URL)"
export LIVEKIT_API_KEY="$(read_env_var LIVEKIT_API_KEY)"
export LIVEKIT_API_SECRET="$(read_env_var LIVEKIT_API_SECRET)"
export ROOT="$ROOT"

python3 - <<'PY'
import os
import sys

sys.path.insert(0, os.path.join(os.environ["ROOT"], "backend", "services", "lawyer-marketplace"))

from app.application.livekit_tokens import mint_room_token, livekit_configured

if not livekit_configured():
    print("livekit_configured() returned False", file=sys.stderr)
    sys.exit(1)

minted = mint_room_token(room="apt-verify", identity="verify-user", name="Verify", role="citizen")
if not minted:
    print("mint_room_token returned None", file=sys.stderr)
    sys.exit(1)

token, url = minted
if not token or not url.startswith("wss://"):
    print(f"Unexpected mint result: url={url!r}", file=sys.stderr)
    sys.exit(1)

print(f"OK — token minted for {url} ({len(token)} chars)")
PY

green "LiveKit configuration looks good."
