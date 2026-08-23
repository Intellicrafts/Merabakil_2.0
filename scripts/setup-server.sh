#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MeraBakil — EC2 server bootstrap
# Run once on a fresh Ubuntu 22.04 instance as root (or with sudo).
#
#   curl -fsSL https://raw.githubusercontent.com/Intellicrafts/Merabakil_2.0/main/scripts/setup-server.sh | sudo bash
#
# What this does:
#   1. Installs Docker + Docker Compose plugin
#   2. Installs Certbot (Let's Encrypt SSL)
#   3. Creates /opt/merabakil deploy directory
#   4. Prints next steps
# ---------------------------------------------------------------------------
set -euo pipefail

DEPLOY_DIR="/opt/merabakil"
DEPLOY_USER="${SUDO_USER:-ubuntu}"

echo "==> Updating system packages..."
apt-get update -y
apt-get upgrade -y

echo "==> Installing Docker..."
apt-get install -y ca-certificates curl gnupg lsb-release

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"
echo "==> Docker $(docker --version) installed."

echo "==> Installing Certbot..."
snap install core 2>/dev/null || true
snap refresh core 2>/dev/null || true
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot
echo "==> Certbot $(certbot --version) installed."

echo "==> Creating deploy directory $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
chown "$DEPLOY_USER":"$DEPLOY_USER" "$DEPLOY_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Server bootstrap complete! Next steps:"
echo ""
echo "  1. Upload your .env file to $DEPLOY_DIR/.env"
echo "     scp infrastructure/.env.production <user>@<ip>:$DEPLOY_DIR/.env"
echo ""
echo "  2. Clone the repo (or rsync):"
echo "     git clone https://github.com/Intellicrafts/Merabakil_2.0.git $DEPLOY_DIR/repo"
echo ""
echo "  3. Point merabakil.in A record to this server's IP, then run:"
echo "     certbot certonly --standalone -d merabakil.in -d www.merabakil.in"
echo ""
echo "  4. Start the stack:"
echo "     cd $DEPLOY_DIR/repo"
echo "     docker compose -f infrastructure/docker-compose.prod.yml --env-file $DEPLOY_DIR/.env up -d --build"
echo ""
echo "  5. Seed the database (first deploy only):"
echo "     docker compose -f infrastructure/docker-compose.prod.yml exec auth python -m app.seed"
echo ""
echo "  NOTE: Log out and back in for docker group membership to take effect."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
