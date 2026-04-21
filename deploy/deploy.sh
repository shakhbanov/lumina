#!/bin/bash
set -euo pipefail

# Lumina Deployment Script for lumina.su
# Run as root on the target server

LUMINA_DIR="/opt/lumina"
FRONTEND_DIR="/var/www/lumina"
LOG_DIR="/var/log/lumina"

echo "=== Lumina Deployment ==="

# 1. Create lumina user
if ! id -u lumina &>/dev/null; then
    useradd -r -s /bin/false lumina
    echo "[+] Created lumina user"
fi

# 2. Create directories
mkdir -p "$LUMINA_DIR/bin" "$LUMINA_DIR/sfu-sidecar" "$FRONTEND_DIR" "$LOG_DIR"
chown -R lumina:lumina "$LUMINA_DIR" "$LOG_DIR"

# 3. Install system dependencies
echo "[+] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx coturn redis-server

# 4. Build Rust backend
echo "[+] Building backend..."
cd "$(dirname "$0")/../backend"
cargo build --release
cp target/release/lumina-server "$LUMINA_DIR/bin/"

# 5. Build frontend
echo "[+] Building frontend..."
cd "$(dirname "$0")/../frontend"
npm ci
npm run build
cp -r dist/* "$FRONTEND_DIR/"

# 6. Setup SFU sidecar
echo "[+] Setting up SFU sidecar..."
cd "$(dirname "$0")/../sfu-sidecar"
npm ci
npm run build 2>/dev/null || true
cp -r . "$LUMINA_DIR/sfu-sidecar/"

# 7. Copy configs
echo "[+] Configuring services..."
SCRIPT_DIR="$(dirname "$0")"

# nginx
cp "$SCRIPT_DIR/nginx/lumina.conf" /etc/nginx/sites-available/lumina
ln -sf /etc/nginx/sites-available/lumina /etc/nginx/sites-enabled/lumina
rm -f /etc/nginx/sites-enabled/default

# coturn
cp "$SCRIPT_DIR/coturn/turnserver.conf" /etc/turnserver.conf

# systemd
cp "$SCRIPT_DIR/systemd/"*.service /etc/systemd/system/
systemctl daemon-reload

# env file
if [ ! -f "$LUMINA_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$LUMINA_DIR/.env"
    # Generate random TURN secret
    TURN_SECRET=$(openssl rand -hex 32)
    sed -i "s/your-secure-turn-secret-here/$TURN_SECRET/" "$LUMINA_DIR/.env"
    sed -i "s/REPLACE_WITH_TURN_SECRET/$TURN_SECRET/" /etc/turnserver.conf
    echo "[!] Generated TURN secret. Edit $LUMINA_DIR/.env for other settings."
fi

# 8. SSL certificate
echo "[+] Setting up TLS..."
if [ ! -f /etc/letsencrypt/live/lumina.su/fullchain.pem ]; then
    certbot certonly --nginx -d lumina.su --non-interactive --agree-tos --email admin@lumina.su
fi

# Auto-renewal hook
mkdir -p /etc/letsencrypt/renewal-hooks/post
cp "$SCRIPT_DIR/certbot/renew-hook.sh" /etc/letsencrypt/renewal-hooks/post/lumina.sh
chmod +x /etc/letsencrypt/renewal-hooks/post/lumina.sh

# 9. Detect server IP for coturn
SERVER_IP=$(curl -4 -s ifconfig.me || hostname -I | awk '{print $1}')
sed -i "s/REPLACE_WITH_SERVER_IP/$SERVER_IP/g" /etc/turnserver.conf
echo "[+] Server IP: $SERVER_IP"

# 10. Firewall
echo "[+] Configuring firewall..."
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw allow 3478/tcp 2>/dev/null || true
ufw allow 3478/udp 2>/dev/null || true
ufw allow 5349/tcp 2>/dev/null || true
ufw allow 49152:65535/udp 2>/dev/null || true

# 11. Start services
echo "[+] Starting services..."
systemctl enable --now redis-server
systemctl enable --now coturn
systemctl enable --now lumina-backend
# systemctl enable --now lumina-sfu  # Enable after Phase 2
systemctl restart nginx

echo ""
echo "=== Deployment Complete ==="
echo "  Site:   https://lumina.su"
echo "  API:    https://lumina.su/api/health"
echo "  Config: $LUMINA_DIR/.env"
echo "  Logs:   journalctl -u lumina-backend -f"
echo ""
