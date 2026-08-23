#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MeraBakil — deploy / redeploy script
# Run from any directory. Must be run as the deploy user (not root).
#
#   /opt/merabakil/repo/scripts/deploy.sh
#
# What this does:
#   1. Pulls latest code from git
#   2. Generates a self-signed SSL cert if one doesn't exist
#   3. Starts (or restarts) the full Docker Compose stack
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="/opt/merabakil"
COMPOSE="docker compose -f $REPO_DIR/infrastructure/docker-compose.prod.yml -f $REPO_DIR/infrastructure/docker-compose.selfsigned.yml --env-file $REPO_DIR/infrastructure/.env"

# ── Find .env — accept it in-repo or at /opt/merabakil/.env ──────────────
REPO_ENV="$REPO_DIR/infrastructure/.env"
LEGACY_ENV="$DEPLOY_DIR/.env"

if [ -f "$REPO_ENV" ]; then
    : # already in place — nothing to do
elif [ -f "$LEGACY_ENV" ]; then
    echo "==> Symlinking $LEGACY_ENV → $REPO_ENV"
    ln -s "$LEGACY_ENV" "$REPO_ENV"
else
    echo "ERROR: No .env found."
    echo "  Place your production .env at: $REPO_ENV"
    echo "  Template: $REPO_DIR/infrastructure/env.gcp.example"
    exit 1
fi

# ── Pull latest code ──────────────────────────────────────────────────────
echo "==> Pulling latest code..."
cd "$REPO_DIR"
git pull --ff-only

# ── Self-signed SSL cert ───────────────────────────────────────────────────
CERT="/etc/ssl/certs/merabakil.crt"
KEY="/etc/ssl/private/merabakil.key"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    echo "==> Generating self-signed SSL certificate..."
    sudo openssl req -x509 -nodes -newkey rsa:4096 \
        -keyout /tmp/merabakil.key \
        -out /tmp/merabakil.crt \
        -days 365 \
        -subj "/CN=$(curl -sf http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H 'Metadata-Flavor: Google' 2>/dev/null || hostname -I | awk '{print $1}')"
    sudo mv /tmp/merabakil.key "$KEY"
    sudo mv /tmp/merabakil.crt "$CERT"
    echo "==> SSL cert generated."
fi

# ── Start / restart stack ─────────────────────────────────────────────────
echo "==> Starting Docker Compose stack..."
$COMPOSE up -d --build

# Restart nginx so it re-resolves container IPs after any container rebuilds
echo "==> Reloading nginx..."
$COMPOSE restart nginx

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy complete!"
echo ""
VM_IP=$(curl -sf http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H 'Metadata-Flavor: Google' 2>/dev/null || hostname -I | awk '{print $1}')
echo "  App is live at: https://$VM_IP"
echo "  (Accept the browser security warning for self-signed cert)"
echo ""
echo "  Check container status:  docker compose -f $REPO_DIR/infrastructure/docker-compose.prod.yml ps"
echo "  View logs:               docker compose -f $REPO_DIR/infrastructure/docker-compose.prod.yml logs -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
