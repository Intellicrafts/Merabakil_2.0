#!/usr/bin/env bash
# Docker Compose wrapper — uses sudo when the current user lacks docker.sock access.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if docker info >/dev/null 2>&1; then
  exec docker compose -f infrastructure/docker-compose.yml --env-file .env "$@"
fi

echo "Docker permission denied — retrying with sudo (one-time password may be required)..." >&2
exec sudo docker compose -f infrastructure/docker-compose.yml --env-file .env "$@"
