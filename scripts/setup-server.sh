#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MeraBakil — VM bootstrap (Ubuntu 22.04 — GCE or any cloud)
# Run once on a fresh instance as root (or with sudo).
#
#   curl -fsSL https://raw.githubusercontent.com/Intellicrafts/Merabakil_2.0/main/scripts/setup-server.sh | sudo bash
#
# What this does:
#   1. Installs Docker + Docker Compose plugin
#   2. Installs Certbot (Let's Encrypt SSL — for when domain is ready)
#   3. Installs git and openssl
#   4. Creates /opt/merabakil deploy directory
#   5. Prints next steps
# ---------------------------------------------------------------------------
set -euo pipefail

DEPLOY_DIR="/opt/merabakil"
DEPLOY_USER="${SUDO_USER:-ubuntu}"

echo "==> Updating system packages..."
apt-get update -y
apt-get upgrade -y

echo "==> Installing dependencies (git, openssl, curl)..."
apt-get install -y ca-certificates curl gnupg lsb-release git openssl

echo "==> Installing Docker..."
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

echo "==> Installing Certbot (for Let's Encrypt when domain is ready)..."
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
echo "  Bootstrap complete! See DEPLOY.md in the repo for full steps."
echo "  Quick summary:"
echo ""
echo "  1. Log out and back in (activates docker group)"
echo ""
echo "  2. Clone the repo:"
echo "     git clone https://github.com/Intellicrafts/Merabakil_2.0.git $DEPLOY_DIR/repo"
echo ""
echo "  3. Create your .env:"
echo "     cp $DEPLOY_DIR/repo/infrastructure/env.gcp.example $DEPLOY_DIR/.env"
echo "     nano $DEPLOY_DIR/.env   # fill in all <CHANGE ME> values"
echo "     ln -s $DEPLOY_DIR/.env $DEPLOY_DIR/repo/infrastructure/.env"
echo ""
echo "  4. Run the deploy script:"
echo "     $DEPLOY_DIR/repo/scripts/deploy.sh"
echo ""
echo "  Full guide: $DEPLOY_DIR/repo/DEPLOY.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
