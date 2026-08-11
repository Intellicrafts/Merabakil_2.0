#!/usr/bin/env bash
# Full production stack bootstrap (requires Docker access).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "Docker not accessible. Run once:"
  echo "  bash scripts/setup_docker.sh"
  echo "  newgrp docker   # or log out and back in"
  exit 1
fi

echo "==> Starting full stack..."
make up

echo ""
echo "==> Waiting for services (60s)..."
sleep 60

bash scripts/post_docker_setup.sh "$@"
