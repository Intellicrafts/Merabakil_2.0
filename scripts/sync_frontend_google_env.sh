#!/usr/bin/env bash
# Copy GOOGLE_OAUTH_CLIENT_ID from root .env into frontend/.env.local as NEXT_PUBLIC_GOOGLE_CLIENT_ID
# when missing or empty (public mode overwrites .env.local and used to clear this value).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROOT_ENV="$ROOT/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

read_env_var() {
  local file="$1" key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r"' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

if [[ ! -f "$ROOT_ENV" ]]; then
  exit 0
fi

google_id="$(read_env_var "$ROOT_ENV" GOOGLE_OAUTH_CLIENT_ID)"
if [[ -z "$google_id" ]]; then
  exit 0
fi

if [[ ! -f "$FRONTEND_ENV" ]]; then
  exit 0
fi

current="$(read_env_var "$FRONTEND_ENV" NEXT_PUBLIC_GOOGLE_CLIENT_ID)"
if [[ -n "$current" && "$current" != "your-client-id.apps.googleusercontent.com" ]]; then
  exit 0
fi

if grep -q '^NEXT_PUBLIC_GOOGLE_CLIENT_ID=' "$FRONTEND_ENV"; then
  sed -i "s|^NEXT_PUBLIC_GOOGLE_CLIENT_ID=.*|NEXT_PUBLIC_GOOGLE_CLIENT_ID=${google_id}|" "$FRONTEND_ENV"
else
  printf '\nNEXT_PUBLIC_GOOGLE_CLIENT_ID=%s\n' "$google_id" >> "$FRONTEND_ENV"
fi
