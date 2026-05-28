#!/bin/bash
# Asterope Remote Dev — VPS Setup Script
# Tested on Ubuntu 22.04 / Debian 12
# Run as root: bash setup.sh

set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────
ASTEROPE_DIR="/opt/asterope"
DATA_DIR="/var/asterope"
SERVICE_USER="asterope"
NODE_VERSION="20"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || error "This script must be run as root (use sudo)"
}

# ─────────────────────────────────────────────────────────────
# Detect VPS IP
# ─────────────────────────────────────────────────────────────
VPS_IP=$(curl -s --max-time 5 ifconfig.me || hostname -I | awk '{print $1}')
info "Detected VPS IP: ${VPS_IP}"

# ─────────────────────────────────────────────────────────────
# Prompt for password
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Set a dashboard password:${NC}"
read -s -p "  Password: " DASH_PASS
echo ""
read -s -p "  Confirm:  " DASH_PASS2
echo ""
[[ "$DASH_PASS" == "$DASH_PASS2" ]] || error "Passwords do not match"
[[ ${#DASH_PASS} -ge 8 ]]           || error "Password must be at least 8 characters"

# ─────────────────────────────────────────────────────────────
require_root

info "Starting Asterope setup..."

# ─────────────────────────────────────────────────────────────
# 1. System dependencies
# ─────────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq
apt-get install -y -qq curl wget git nginx ufw openssl jq ca-certificates gnupg lsb-release

# ─────────────────────────────────────────────────────────────
# 2. Node.js (for the dashboard backend)
# ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  info "Installing Node.js ${NODE_VERSION}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y -qq nodejs
fi
success "Node.js $(node -v) installed"

# ─────────────────────────────────────────────────────────────
# 3. Docker (required for isolated workspace containers)
# ─────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi
success "Docker $(docker --version | awk '{print $3}' | tr -d ',') installed"

# ─────────────────────────────────────────────────────────────
# 4. Create service user
# ─────────────────────────────────────────────────────────────
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Creating service user '${SERVICE_USER}'..."
  useradd -r -m -d /home/${SERVICE_USER} -s /bin/bash ${SERVICE_USER}
fi

# Add service user to docker group so it can manage containers
usermod -aG docker ${SERVICE_USER}

# ─────────────────────────────────────────────────────────────
# 5. Clone / update Asterope
# ─────────────────────────────────────────────────────────────
if [[ -d "${ASTEROPE_DIR}/.git" ]]; then
  info "Updating Asterope..."
  git -C "${ASTEROPE_DIR}" pull
else
  info "Cloning Asterope..."
  # If running from a local copy, copy instead of clone
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "${SCRIPT_DIR}/../server/index.js" ]]; then
    cp -r "${SCRIPT_DIR}/.." "${ASTEROPE_DIR}"
  else
    error "Could not find Asterope source. Run this script from within the cloned repository."
  fi
fi

chown -R ${SERVICE_USER}:${SERVICE_USER} "${ASTEROPE_DIR}"

# ─────────────────────────────────────────────────────────────
# 6. Data directory
# ─────────────────────────────────────────────────────────────
mkdir -p "${DATA_DIR}/workspaces"
chown -R ${SERVICE_USER}:${SERVICE_USER} "${DATA_DIR}"

# ─────────────────────────────────────────────────────────────
# 7. Install npm dependencies & build frontend
# ─────────────────────────────────────────────────────────────
info "Installing server dependencies..."
cd "${ASTEROPE_DIR}/server"
sudo -u ${SERVICE_USER} npm install --production

info "Installing client dependencies and building..."
cd "${ASTEROPE_DIR}/client"
sudo -u ${SERVICE_USER} npm install
sudo -u ${SERVICE_USER} npm run build

# ─────────────────────────────────────────────────────────────
# 7b. Build Docker images
# ─────────────────────────────────────────────────────────────
info "Building Asterope Docker images (this takes ~5-10 minutes)..."
cd "${ASTEROPE_DIR}"
bash scripts/build-images.sh
success "Docker images built"

# ─────────────────────────────────────────────────────────────
# 8. Generate .env
# ─────────────────────────────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 32)

cat > "${ASTEROPE_DIR}/server/.env" <<EOF
PORT=4000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
DASHBOARD_PASSWORD=${DASH_PASS}
DATA_DIR=${DATA_DIR}
STARTING_PORT=8100
VPS_HOST=${VPS_IP}
TOKEN_EXPIRY=24h
EOF

chown ${SERVICE_USER}:${SERVICE_USER} "${ASTEROPE_DIR}/server/.env"
chmod 600 "${ASTEROPE_DIR}/server/.env"

# ─────────────────────────────────────────────────────────────
# 9. systemd service
# ─────────────────────────────────────────────────────────────
info "Creating systemd service..."

cat > /etc/systemd/system/asterope.service <<EOF
[Unit]
Description=Asterope Remote Development Dashboard
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${ASTEROPE_DIR}/server
ExecStart=/usr/bin/node ${ASTEROPE_DIR}/server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=asterope
Environment=NODE_ENV=production
EnvironmentFile=${ASTEROPE_DIR}/server/.env

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable asterope
systemctl restart asterope

# ─────────────────────────────────────────────────────────────
# 10. Nginx
# ─────────────────────────────────────────────────────────────
info "Configuring nginx..."

cp "${ASTEROPE_DIR}/nginx/dashboard.conf" /etc/nginx/sites-available/asterope
ln -sf /etc/nginx/sites-available/asterope /etc/nginx/sites-enabled/asterope
rm -f /etc/nginx/sites-enabled/default

# Update server_name to the VPS IP
sed -i "s/server_name _;/server_name ${VPS_IP};/" /etc/nginx/sites-available/asterope

nginx -t && systemctl reload nginx
success "Nginx configured"

# ─────────────────────────────────────────────────────────────
# 11. Firewall
# ─────────────────────────────────────────────────────────────
info "Configuring firewall..."
ufw allow ssh
ufw allow http
ufw allow https
# Allow workspace ports (8100-8200)
ufw allow 8100:8200/tcp comment "Asterope workspaces"
ufw --force enable
success "Firewall configured"

# ─────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Asterope installed successfully!          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Dashboard: ${BLUE}http://${VPS_IP}${NC}"
echo -e "  Password:  (the one you just set)"
echo ""
echo -e "  Service:   ${YELLOW}systemctl status asterope${NC}"
echo -e "  Logs:      ${YELLOW}journalctl -u asterope -f${NC}"
echo ""
echo -e "  Data dir:  ${DATA_DIR}"
echo -e "  App dir:   ${ASTEROPE_DIR}"
echo ""
echo -e "${YELLOW}Tip:${NC} Add a domain + SSL with:"
echo -e "  certbot --nginx -d your-domain.com"
echo ""
