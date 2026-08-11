#!/usr/bin/env bash
# One-time Docker access setup for AI Legal OS (Ubuntu/Debian + Snap Docker).
set -euo pipefail

if ! command -v docker >/dev/null 2>&1 && ! command -v /snap/bin/docker >/dev/null 2>&1; then
  echo "Docker not found. Install with:"
  echo "  sudo snap install docker"
  echo "  # or: sudo apt update && sudo apt install -y docker.io docker-compose-v2"
  exit 1
fi

if snap list docker >/dev/null 2>&1; then
  echo "Snap Docker detected — ensuring daemon is running..."
  sudo snap start docker
fi

if ! getent group docker >/dev/null 2>&1; then
  echo "Creating docker group..."
  sudo groupadd docker || true
fi

echo "Adding $USER to docker group..."
sudo usermod -aG docker "$USER"

if [ -S /var/run/docker.sock ]; then
  echo "Fixing docker.sock permissions (root:docker, mode 660)..."
  sudo chown root:docker /var/run/docker.sock
  sudo chmod 660 /var/run/docker.sock
fi

echo ""
echo "Docker access configured. Run ONE of:"
echo "  newgrp docker          # activate group in current shell"
echo "  log out and log back in"
echo ""
echo "Verify: docker ps"
echo ""
echo "Then from project root:"
echo "  bash scripts/run_production_stack.sh"
echo "  # or: make up && make seed && make bulk-ingest"
