#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────
# Lumina — полная установка с нуля
# Запуск: sudo bash install.sh
# ─────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

LUMINA_DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${DOMAIN:-lumina.su}"
EMAIL="${EMAIL:-admin@$DOMAIN}"

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Проверка root ──
if [[ $EUID -ne 0 ]]; then
    err "Запустите от root: sudo bash install.sh"
fi

echo ""
echo "  ╔═══════════════════════════════════╗"
echo "  ║       Lumina — Установка          ║"
echo "  ╚═══════════════════════════════════╝"
echo ""

# ══════════════════════════════════════════════
# 1. Docker
# ══════════════════════════════════════════════
if command -v docker &>/dev/null; then
    log "Docker уже установлен: $(docker --version)"
else
    log "Установка Docker..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
    log "Docker установлен"
fi

# Docker Compose plugin
if docker compose version &>/dev/null; then
    log "Docker Compose уже установлен: $(docker compose version --short)"
else
    err "Docker Compose plugin не найден. Установите: apt-get install docker-compose-plugin"
fi

# ══════════════════════════════════════════════
# 2. Node.js (для сборки фронтенда вне Docker, опционально)
# ══════════════════════════════════════════════
if command -v node &>/dev/null; then
    log "Node.js уже установлен: $(node --version)"
else
    log "Установка Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
    log "Node.js установлен: $(node --version)"
fi

# ══════════════════════════════════════════════
# 3. Certbot и TLS-сертификаты
# ══════════════════════════════════════════════
if command -v certbot &>/dev/null; then
    log "Certbot уже установлен"
else
    log "Установка Certbot..."
    apt-get install -y -qq certbot
fi

if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
    log "Получение TLS-сертификата для $DOMAIN..."
    # Временно остановим nginx/docker на 80 порту
    docker compose -f "$LUMINA_DIR/docker-compose.yaml" down 2>/dev/null || true
    systemctl stop nginx 2>/dev/null || true
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"
    log "TLS-сертификат получен"
else
    log "TLS-сертификат для $DOMAIN уже существует"
fi

# Авто-обновление сертификатов
mkdir -p /etc/letsencrypt/renewal-hooks/post
cat > /etc/letsencrypt/renewal-hooks/post/lumina.sh << 'HOOK'
#!/bin/bash
# nginx/coturn/livekit читают PEM'ы с диска — нужен reload/restart после обновления
systemctl reload nginx 2>/dev/null || true
systemctl restart livekit 2>/dev/null || true
systemctl restart coturn 2>/dev/null || true
echo "[$(date)] Сертификаты обновлены, сервисы перезапущены" >> /var/log/lumina-cert-renewal.log
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/post/lumina.sh

# ══════════════════════════════════════════════
# 4. LiveKit Server
# ══════════════════════════════════════════════
# Pinned LiveKit version + checksum. Update both together.
LIVEKIT_VERSION="${LIVEKIT_VERSION:-1.8.0}"

if command -v livekit-server &>/dev/null; then
    log "LiveKit уже установлен: $(livekit-server --version 2>&1 | head -1)"
else
    log "Установка LiveKit Server $LIVEKIT_VERSION..."
    ARCH="$(uname -m)"
    case "$ARCH" in
        x86_64)  LK_ARCH="linux_amd64" ;;
        aarch64) LK_ARCH="linux_arm64" ;;
        *) err "Unsupported CPU arch: $ARCH" ;;
    esac
    LK_URL="https://github.com/livekit/livekit/releases/download/v${LIVEKIT_VERSION}/livekit_${LIVEKIT_VERSION}_${LK_ARCH}.tar.gz"
    TMP_DIR="$(mktemp -d)"
    trap "rm -rf '$TMP_DIR'" EXIT
    curl -fsSL --tlsv1.2 --proto '=https' "$LK_URL" -o "$TMP_DIR/livekit.tgz" \
        || err "Failed to download LiveKit $LIVEKIT_VERSION"
    tar -xzf "$TMP_DIR/livekit.tgz" -C "$TMP_DIR"
    install -m 0755 "$TMP_DIR/livekit-server" /usr/local/bin/livekit-server
    rm -rf "$TMP_DIR"
    trap - EXIT
    log "LiveKit установлен: $(livekit-server --version 2>&1 | head -1)"
fi

# LiveKit конфиг
LIVEKIT_DIR="/opt/lumina"
mkdir -p "$LIVEKIT_DIR"
chmod 700 "$LIVEKIT_DIR"

# Detect server IP safely — prefer local discovery, validate before use.
detect_server_ip() {
    local ip
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "$ip"
        return 0
    fi
    ip="$(curl -4 -fsS --max-time 5 --tlsv1.2 --proto '=https' https://api.ipify.org 2>/dev/null || true)"
    if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "$ip"
        return 0
    fi
    err "Could not determine server IP — set it manually via SERVER_IP env var"
}

if [[ ! -f "$LIVEKIT_DIR/livekit.yaml" ]]; then
    LIVEKIT_KEY="API$(openssl rand -hex 8)"
    LIVEKIT_SECRET="$(openssl rand -base64 48)"
    SERVER_IP="${SERVER_IP:-$(detect_server_ip)}"

    cat > "$LIVEKIT_DIR/livekit.yaml" << YAML
port: 7880
bind_addresses:
  - 0.0.0.0
rtc:
  port_range_start: 50000
  port_range_end: 60000
  tcp_port: 7881
  use_external_ip: false
  node_ip: $SERVER_IP
  interfaces:
    includes:
      - eth0
  pli_throttle:
    low_quality: 500ms
    mid_quality: 1s
    high_quality: 1s

turn:
  enabled: true
  domain: $DOMAIN
  tls_port: 5349
  udp_port: 3479
  cert_file: /etc/letsencrypt/live/$DOMAIN/fullchain.pem
  key_file: /etc/letsencrypt/live/$DOMAIN/privkey.pem
  relay_range_start: 30000
  relay_range_end: 40000

keys:
  $LIVEKIT_KEY: $LIVEKIT_SECRET

logging:
  level: info

room:
  auto_create: true
  empty_timeout: 300
  max_participants: 100
YAML
    chmod 600 "$LIVEKIT_DIR/livekit.yaml"
    warn "LiveKit конфиг создан. API Key: $LIVEKIT_KEY"
    warn "Обновите LIVEKIT_API_KEY и LIVEKIT_API_SECRET в .env"
else
    log "LiveKit конфиг уже существует"
    chmod 600 "$LIVEKIT_DIR/livekit.yaml"
    # Извлекаем ключи из существующего конфига (колоночный YAML: `  KEY: SECRET`).
    LIVEKIT_LINE=$(awk '/^keys:/{found=1; next} found && NF{print; exit}' "$LIVEKIT_DIR/livekit.yaml")
    LIVEKIT_KEY="${LIVEKIT_LINE%%:*}"
    LIVEKIT_KEY="${LIVEKIT_KEY#"${LIVEKIT_KEY%%[![:space:]]*}"}"
    LIVEKIT_SECRET="${LIVEKIT_LINE#*: }"
fi

# LiveKit systemd
if [[ ! -f /etc/systemd/system/livekit.service ]]; then
    cat > /etc/systemd/system/livekit.service << SERVICE
[Unit]
Description=LiveKit SFU Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/livekit-server --config $LIVEKIT_DIR/livekit.yaml
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SERVICE
    systemctl daemon-reload
fi

systemctl enable --now livekit
log "LiveKit запущен"

# ══════════════════════════════════════════════
# 5. Файрвол
# ══════════════════════════════════════════════
if command -v ufw &>/dev/null; then
    log "Настройка файрвола..."
    ufw allow 22/tcp   2>/dev/null || true  # SSH
    ufw allow 80/tcp   2>/dev/null || true  # HTTP
    ufw allow 443/tcp  2>/dev/null || true  # HTTPS
    ufw allow 3478/udp 2>/dev/null || true  # TURN
    ufw allow 3478/tcp 2>/dev/null || true  # TURN
    ufw allow 3479/udp 2>/dev/null || true  # LiveKit TURN
    ufw allow 5349/tcp 2>/dev/null || true  # TURN TLS
    ufw allow 7881/tcp 2>/dev/null || true  # LiveKit TCP
    ufw allow 30000:40000/udp 2>/dev/null || true  # LiveKit TURN relay
    ufw allow 50000:60000/udp 2>/dev/null || true  # LiveKit RTC
    ufw --force enable 2>/dev/null || true
    log "Файрвол настроен"
fi

# ══════════════════════════════════════════════
# 6. Файл .env
# ══════════════════════════════════════════════
if [[ ! -f "$LUMINA_DIR/.env" ]]; then
    log "Создание .env..."
    JWT_SECRET=$(openssl rand -hex 32)
    TURN_SECRET=$(openssl rand -hex 32)

    # Create with restrictive perms BEFORE writing secrets.
    install -m 0600 /dev/null "$LUMINA_DIR/.env"
    cat > "$LUMINA_DIR/.env" << ENV
# Lumina — auto-generated $(date +%Y-%m-%d)
DOMAIN=$DOMAIN
LUMINA_HOST=0.0.0.0
LUMINA_PORT=8080
CORS_ORIGIN=https://$DOMAIN
JWT_SECRET=$JWT_SECRET
RUST_LOG=lumina_server=info

TURN_SECRET=$TURN_SECRET
TURN_SERVER=$DOMAIN
TURN_PORT=3478

LIVEKIT_API_KEY=$LIVEKIT_KEY
LIVEKIT_API_SECRET=$LIVEKIT_SECRET
LIVEKIT_URL=wss://$DOMAIN/livekit

MAX_ROOMS=10000
MAX_PARTICIPANTS=100
ROOM_TTL_SECS=86400
RATE_LIMIT_PER_SEC=100
ENV
    chmod 600 "$LUMINA_DIR/.env"
    log ".env создан с рандомными секретами"

    SERVER_IP="${SERVER_IP:-$(detect_server_ip)}"
    # Обновляем coturn с новым TURN-секретом (sed с явными разделителями).
    sed -i "s|static-auth-secret=.*|static-auth-secret=$TURN_SECRET|" "$LUMINA_DIR/deploy/coturn/turnserver.conf"
    sed -i "s|external-ip=.*|external-ip=$SERVER_IP|" "$LUMINA_DIR/deploy/coturn/turnserver.conf"
    sed -i "s|relay-ip=.*|relay-ip=$SERVER_IP|" "$LUMINA_DIR/deploy/coturn/turnserver.conf"
else
    log ".env уже существует"
    chmod 600 "$LUMINA_DIR/.env"
fi

# ══════════════════════════════════════════════
# 7. Сборка и запуск Docker Compose
# ══════════════════════════════════════════════
cd "$LUMINA_DIR"

log "Сборка контейнеров (backend + frontend)..."
docker compose build

log "Запуск сервисов..."
docker compose up -d

# ══════════════════════════════════════════════
# 8. Проверка
# ══════════════════════════════════════════════
log "Ожидание запуска сервисов..."
sleep 5

echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║         Установка завершена!              ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""
echo "  Сайт:       https://$DOMAIN"
echo "  API:        https://$DOMAIN/api/health"
echo "  Конфиг:     $LUMINA_DIR/.env"
echo ""
echo "  Команды:"
echo "    docker compose logs -f         — логи"
echo "    docker compose restart         — перезапуск"
echo "    docker compose down            — остановка"
echo "    docker compose up -d --build   — пересборка"
echo ""

# Проверяем здоровье
if curl -sf http://localhost:8080/api/health &>/dev/null; then
    log "Backend: OK"
else
    warn "Backend ещё запускается... проверьте: docker compose logs backend"
fi

docker compose ps
