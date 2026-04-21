# Lumina

Self-hosted, end-to-end-capable video meetings. Rust signalling server on top of Redis, React frontend, LiveKit as the SFU, coturn for TURN, nginx as the edge.

## Architecture

```
                   +-----------+
                   |  Browser  |
                   +-----+-----+
                         |
              HTTPS / WSS (lumina.su)
                         |
                   +-----v-----+
                   |   nginx   |  TLS, rate-limits, CSP
                   +--+---+--+-+
                      |   |  |
              /api /ws|   |  | /livekit/rtc
                      |   |  |
               +------+   |  +-----------------+
               |          |                    |
        +------v----+  +--v---+         +------v------+
        |  Backend  |  |LiveKit|        |  Frontend   |
        |  (axum)   |  |(SFU)  |        |(static SPA) |
        +-----+-----+  +-------+        +-------------+
              |
        +-----v-----+
        |   Redis   |
        +-----------+
```

- **Frontend** — React + TypeScript + Vite. `livekit-client` for media, a thin WS client for signalling. Progressive Web App with a service worker.
- **Backend** — Rust (`axum` 0.7), Redis-backed room/participant state, Redis Pub/Sub for cross-node fan-out. Mints LiveKit JWTs, signs TURN credentials, enforces per-IP rate limits.
- **LiveKit** — runs on the host (systemd service), port 7880 for signal, 7881 TCP fallback, 50000-60000 UDP for media, 3479 UDP / 5349 TLS for its built-in TURN.
- **coturn** — optional extra TURN on port 3478.
- **Redis** — in-docker, persistent volume.

## Security posture

This deployment takes a defensive stance. Short list of choices worth knowing:

- **JWT on every control path.** Room creation issues a one-shot `creator_token`; joining mints a `join_token` bound to a server-generated identity. The WebSocket upgrade requires `?room=&token=`; the client cannot pick its own participant ID.
- **Authoritative server.** Chat sender, reactions, signal messages all have their sender rewritten server-side from the authenticated identity. Clients cannot impersonate.
- **Scoped rate-limits.** nginx `limit_req` on `/api/`, `/ws`, `/livekit/rtc`, plus a token-bucket middleware in the backend and per-connection WebSocket throttling.
- **Restricted LiveKit surface.** nginx whitelists only `/livekit/rtc*`. The Twirp admin API (`/twirp/...`) is never proxied to the public internet.
- **Strict CSP.** `default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, `upgrade-insecure-requests`.
- **Chat URL allow-list.** The in-chat Markdown renderer only honours `http:`, `https:`, `mailto:`. No `javascript:`, no `data:`.
- **E2EE by URL fragment.** When a room is created, the browser generates a 256-bit key with `crypto.getRandomValues` and places it in the shareable URL's `#key=...` fragment. Fragments are never sent to the server, so the passphrase is genuinely end-to-end. If the link is shared without a fragment, E2EE is off — the UI reflects that rather than showing a misleading badge.
- **Secrets.** Required env vars `JWT_SECRET`, `TURN_SECRET`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` must be at least 32 bytes. The server panics on missing or short secrets — no silent fallback. `.env` and `/opt/lumina/livekit.yaml` are written with mode `0600`.

## Quick start

Prerequisites: a fresh Ubuntu 22.04+ box with a public IP and a DNS A record pointing at it.

```sh
git clone https://github.com/shakhbanov/lumina
cd lumina
sudo DOMAIN=meet.example.com EMAIL=you@example.com bash install.sh
```

The installer

1. Installs Docker, Node.js 22, certbot, LiveKit (pinned to a release tag), coturn.
2. Issues a Let's Encrypt certificate via standalone mode (port 80 must be free).
3. Generates `/root/lumina/.env` with 256-bit secrets (`openssl rand -hex 32`).
4. Writes `/opt/lumina/livekit.yaml` with generated API key/secret.
5. Opens firewall ports via `ufw`.
6. Starts the backend + frontend via `docker compose up -d`.
7. Registers a certbot renewal hook that reloads nginx and restarts livekit/coturn.

## Configuration

See `.env.example` for the full list. The most important knobs:

| Variable                 | Meaning                                                | Default          |
| ------------------------ | ------------------------------------------------------ | ---------------- |
| `DOMAIN`                 | public hostname                                        | `lumina.su`      |
| `JWT_SECRET`             | signing key for room tokens (>=32 bytes, required)     | —                |
| `TURN_SECRET`            | HMAC secret for time-limited TURN creds (>=32 bytes)   | —                |
| `LIVEKIT_API_KEY`        | LiveKit API key (from `/opt/lumina/livekit.yaml`)      | —                |
| `LIVEKIT_API_SECRET`     | LiveKit API secret (>=32 bytes)                        | —                |
| `CORS_ORIGIN`            | exact origin allowed to call `/api/*` and `/ws`        | `https://lumina.su` |
| `MAX_ROOMS`              | hard cap on simultaneous rooms                         | `10000`          |
| `MAX_PARTICIPANTS`       | cap on participants per room                           | `100`            |
| `ROOM_TTL_SECS`          | inactivity TTL before a room is garbage-collected      | `86400`          |
| `RATE_LIMIT_PER_SEC`     | per-IP sustained rate for the backend token bucket     | `100`            |

## Repository layout

```
backend/
  lumina-protocol/   # shared serde types (events, errors)
  lumina-server/     # axum server: routes, ws, redis store, livekit auth
  Dockerfile
frontend/
  src/               # React app (pages, components, hooks, lib)
  nginx.conf         # minimal nginx used inside the frontend container
  Dockerfile
deploy/
  nginx/lumina.conf  # host-side nginx config (TLS, rate-limits, CSP, /livekit whitelist)
  coturn/            # turnserver.conf + cert paths
  systemd/           # service units for livekit, backend, coturn
install.sh           # one-shot bootstrap
docker-compose.yaml  # redis + backend + frontend
```

## Operations

- Logs: `docker compose logs -f backend`, `journalctl -u livekit -f`, `tail -f /var/log/nginx/lumina.access.log`.
- Rebuild after a code change: `docker compose up -d --build`.
- Cert renewal: handled by certbot's timer; the post-renew hook reloads nginx and restarts livekit/coturn. Tail `/var/log/lumina-cert-renewal.log` to confirm.
- Rotating secrets: edit `/root/lumina/.env`, then `docker compose restart backend` and `systemctl restart livekit`. Sessions minted with the old `JWT_SECRET` will be rejected on next WS reconnect.

## Development

Backend:

```sh
cd backend
cargo run -p lumina-server
```

Frontend:

```sh
cd frontend
npm install
npm run dev
```

Type-check:

```sh
cd frontend && npx tsc --noEmit
cd backend  && cargo check
```

## License

See the repository for the current license terms.
