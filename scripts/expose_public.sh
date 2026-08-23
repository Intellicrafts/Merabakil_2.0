#!/usr/bin/env bash
# Expose the local Legal OS stack on the public internet (HTTPS) via Cloudflare Tunnel.
#
# All backend services stay on localhost; only port 3000 is public.
# Browser calls /svc/auth, /svc/marketplace, … proxied by Next.js to local ports.
#
# Usage:
#   make public          — full stack + tunnel (recommended, one command)
#   make public-tunnel   — tunnel only (stack already running via make native)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_ENV="$ROOT/frontend/.env.local"
PUBLIC_ENV="$ROOT/frontend/.env.public.example"
LOCAL_ENV_BACKUP="$ROOT/frontend/.env.local.bak"
TUNNEL_LOG="$ROOT/data/.public-tunnel.log"
PUBLIC_URL_FILE="$ROOT/data/.public-url"
FRONTEND_PORT="${PUBLIC_FRONTEND_PORT:-3000}"
FRONTEND_HOST="${PUBLIC_FRONTEND_HOST:-0.0.0.0}"
KEEP_PUBLIC_ENV="${KEEP_PUBLIC_ENV:-1}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    red "Missing required command: $1"
    exit 1
  }
}

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then return 0; fi
  mkdir -p "$HOME/.local/bin"
  if [[ -x "$HOME/.local/bin/cloudflared" ]]; then
    export PATH="$HOME/.local/bin:$PATH"
    return 0
  fi
  yellow "Downloading cloudflared …"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64) CF_ARCH="amd64" ;;
    aarch64|arm64) CF_ARCH="arm64" ;;
    *) red "Unsupported arch: $ARCH"; exit 1 ;;
  esac
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    -o "$HOME/.local/bin/cloudflared"
  chmod +x "$HOME/.local/bin/cloudflared"
  export PATH="$HOME/.local/bin:$PATH"
}

wait_http() {
  local url="$1" label="$2" tries="${3:-60}"
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      green "  $label ready"
      return 0
    fi
    sleep 2
  done
  red "  TIMEOUT: $label ($url)"
  return 1
}

apply_public_env() {
  cp "$PUBLIC_ENV" "$FRONTEND_ENV"
  bash "$ROOT/scripts/sync_frontend_google_env.sh"
  green "Applied public API proxy env → frontend/.env.local"
}

verify_proxy() {
  yellow "Verifying API proxy (/svc/auth → auth :8001) …"
  if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/svc/auth/health" >/dev/null; then
    green "  Proxy OK — remote devices will reach auth through the tunnel"
    return 0
  fi
  red "  Proxy FAILED — restart frontend after env change (make public does this automatically)"
  return 1
}

restart_frontend_public() {
  yellow "Restarting Next.js (public mode, $FRONTEND_HOST:$FRONTEND_PORT) …"
  for pid in $(pgrep -f "next dev" 2>/dev/null || true); do
    cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || echo "")
    [[ "$cwd" == "$ROOT/frontend"* ]] && kill "$pid" 2>/dev/null || true
  done
  sleep 2
  NODE_BIN="$HOME/.local/node/bin"
  export PATH="${NODE_BIN:+$NODE_BIN:}$PATH"
  need_cmd npm
  mkdir -p "$ROOT/data"
  (
    cd "$ROOT/frontend"
    nohup npm run dev -- --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT" \
      > "$ROOT/data/.frontend-public.log" 2>&1 &
    echo $! > "$ROOT/data/.frontend-public.pid"
  )
  wait_http "http://127.0.0.1:${FRONTEND_PORT}/login" "Frontend" 45
  verify_proxy
}

stop_tunnel() {
  if [[ -f "$ROOT/data/.public-tunnel.pid" ]]; then
    kill "$(cat "$ROOT/data/.public-tunnel.pid")" 2>/dev/null || true
    rm -f "$ROOT/data/.public-tunnel.pid"
  fi
  pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:${FRONTEND_PORT}" 2>/dev/null || true
}

restore_local_env() {
  if [[ -f "$LOCAL_ENV_BACKUP" ]]; then
    mv "$LOCAL_ENV_BACKUP" "$FRONTEND_ENV"
    green "Restored local frontend/.env.local"
  elif [[ -f "$ROOT/frontend/.env.local.example" ]]; then
    cp "$ROOT/frontend/.env.local.example" "$FRONTEND_ENV"
    green "Restored frontend/.env.local from .env.local.example"
  fi
}

tunnel_only() {
  need_cmd curl
  ensure_cloudflared
  wait_http "http://127.0.0.1:8001/health" "Auth" 10
  wait_http "http://127.0.0.1:${FRONTEND_PORT}/login" "Frontend" 10 || {
    red "Frontend not on :${FRONTEND_PORT}. Run: make public  (or make native + make public-tunnel)"
    exit 1
  }
  if [[ ! -f "$FRONTEND_ENV" ]] || ! grep -q '/svc/auth' "$FRONTEND_ENV" 2>/dev/null; then
    if [[ -f "$FRONTEND_ENV" && ! -f "$LOCAL_ENV_BACKUP" ]]; then
      cp "$FRONTEND_ENV" "$LOCAL_ENV_BACKUP"
    fi
    apply_public_env
    restart_frontend_public
  else
    verify_proxy || restart_frontend_public
  fi
  start_tunnel_foreground
}

start_tunnel_foreground() {
  stop_tunnel
  mkdir -p "$ROOT/data"
  : > "$TUNNEL_LOG"
  yellow "Starting Cloudflare Tunnel → http://127.0.0.1:${FRONTEND_PORT}"
  cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${FRONTEND_PORT}" 2>&1 | tee "$TUNNEL_LOG" &
  echo $! > "$ROOT/data/.public-tunnel.pid"
  PUBLIC_URL=""
  for ((i = 0; i < 60; i++)); do
    PUBLIC_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
    [[ -n "$PUBLIC_URL" ]] && break
    sleep 1
  done
  if [[ -z "$PUBLIC_URL" ]]; then
    red "Could not read tunnel URL — see $TUNNEL_LOG"
    exit 1
  fi
  echo "$PUBLIC_URL" > "$PUBLIC_URL_FILE"
  echo ""
  green "════════════════════════════════════════════════════════"
  green "  Global URL (all services via this one link):"
  echo ""
  echo "    $PUBLIC_URL"
  echo ""
  yellow "  Google OAuth: add this to Authorized JavaScript origins:"
  echo "    $PUBLIC_URL"
  echo "    (Google Cloud Console → Credentials → your Web client)"
  echo ""
  green "  Register/login/marketplace/research all use /svc/* proxy"
  green "  Login: admin@legalos.in / ChangeMe!2026"
  green "════════════════════════════════════════════════════════"
  echo ""
  yellow "Keep this terminal open. Ctrl+C stops the tunnel only."
  echo ""
  wait "$(cat "$ROOT/data/.public-tunnel.pid")"
}

cleanup() {
  stop_tunnel
  if [[ "${RESTORE_ENV_ON_EXIT:-0}" == "1" ]]; then
    restore_local_env
  fi
}

case "${1:-tunnel}" in
  tunnel) trap cleanup EXIT INT TERM; tunnel_only ;;
  restore) RESTORE_ENV_ON_EXIT=0; restore_local_env; stop_tunnel; green "Done." ;;
  verify)
    verify_proxy
    ;;
  *)
    echo "Usage: $0 [tunnel|restore|verify]"
    exit 1
    ;;
esac
