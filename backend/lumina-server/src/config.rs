use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    // Server
    pub host: String,
    pub port: u16,
    pub node_id: String,

    // Redis
    pub redis_url: String,

    // TURN
    pub turn_secret: String,
    pub turn_server: String,
    pub turn_port: u16,

    // CORS
    pub cors_origin: String,

    // Limits
    pub max_rooms: usize,
    pub max_participants_per_room: usize,
    pub room_ttl_secs: u64,
    pub rate_limit_per_sec: u32,

    // Auth
    pub jwt_secret: String,

    // LiveKit
    pub livekit_api_key: String,
    pub livekit_api_secret: String,
    pub livekit_url: String,

    // Backpressure: bounded channel capacity per WS connection
    pub ws_channel_capacity: usize,
}

/// Minimum acceptable entropy (in bytes) for secret material.
/// 32 bytes = 256 bits, which is also what `openssl rand -hex 32` produces.
const MIN_SECRET_LEN: usize = 32;

fn require_env(name: &str) -> String {
    match env::var(name) {
        Ok(v) if !v.trim().is_empty() => v,
        _ => panic!("Required environment variable {name} is not set"),
    }
}

fn require_secret(name: &str) -> String {
    let value = require_env(name);
    if value.len() < MIN_SECRET_LEN {
        panic!(
            "Environment variable {name} is too short ({} < {MIN_SECRET_LEN} bytes). \
             Generate with: openssl rand -hex 32",
            value.len()
        );
    }
    value
}

impl Config {
    pub fn from_env() -> Self {
        let node_id = env::var("NODE_ID").unwrap_or_else(|_| {
            uuid::Uuid::new_v4().to_string()[..8].to_string()
        });

        Self {
            host: env::var("LUMINA_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("LUMINA_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
            node_id,
            redis_url: env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".into()),
            turn_secret: require_secret("TURN_SECRET"),
            turn_server: env::var("TURN_SERVER").unwrap_or_else(|_| "lumina.su".into()),
            turn_port: env::var("TURN_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3478),
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "https://lumina.su".into()),
            max_rooms: env::var("MAX_ROOMS")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(10_000),
            max_participants_per_room: env::var("MAX_PARTICIPANTS")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(100),
            room_ttl_secs: env::var("ROOM_TTL_SECS")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(86_400),
            rate_limit_per_sec: env::var("RATE_LIMIT_PER_SEC")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(100),
            jwt_secret: require_secret("JWT_SECRET"),
            livekit_api_key: require_env("LIVEKIT_API_KEY"),
            livekit_api_secret: require_secret("LIVEKIT_API_SECRET"),
            livekit_url: env::var("LIVEKIT_URL")
                .unwrap_or_else(|_| "wss://lumina.su/livekit".into()),
            ws_channel_capacity: env::var("WS_CHANNEL_CAPACITY")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(256),
        }
    }

    pub fn listen_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
