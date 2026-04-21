use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::Serialize;
use serde_json::{json, Value};
use sha1::Sha1;

use crate::app_state::AppState;
use crate::auth;

type HmacSha1 = Hmac<Sha1>;

#[derive(Serialize)]
pub struct TurnCredentials {
    pub username: String,
    pub credential: String,
    pub urls: Vec<String>,
    pub ttl: u64,
}

pub async fn get_turn_credentials(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<TurnCredentials>, (StatusCode, Json<Value>)> {
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(str::trim)
        .ok_or((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Missing bearer token"})),
        ))?;

    // Any valid room JWT (create or join) is enough — we don't scope TURN to a
    // single room, but we do require that the caller has proven room context.
    if auth::validate_token(&state.config.jwt_secret, token).is_none() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "Invalid token"})),
        ));
    }

    let ttl: u64 = 86_400;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        + ttl;

    let username = format!("{}:{}", timestamp, uuid::Uuid::new_v4());

    let mut mac = HmacSha1::new_from_slice(state.config.turn_secret.as_bytes()).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "TURN secret misconfigured"})),
        )
    })?;
    mac.update(username.as_bytes());
    let credential = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

    let turn_host = &state.config.turn_server;
    let turn_port = state.config.turn_port;

    Ok(Json(TurnCredentials {
        username,
        credential,
        urls: vec![
            format!("stun:{turn_host}:{turn_port}"),
            format!("turn:{turn_host}:{turn_port}?transport=udp"),
            format!("turn:{turn_host}:{turn_port}?transport=tcp"),
            format!("turns:{turn_host}:5349?transport=tcp"),
        ],
        ttl,
    }))
}
