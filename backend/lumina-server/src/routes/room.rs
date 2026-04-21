use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::OnceLock;

use crate::app_state::AppState;
use crate::auth;
use crate::livekit;

static ROOM_CODE_RE: OnceLock<Regex> = OnceLock::new();

fn room_code_regex() -> &'static Regex {
    ROOM_CODE_RE.get_or_init(|| Regex::new(r"^[a-z0-9]{8,16}$").expect("valid regex"))
}

fn validate_room_code(code: &str) -> Result<String, (StatusCode, Json<Value>)> {
    let code = code.to_lowercase();
    if room_code_regex().is_match(&code) {
        Ok(code)
    } else {
        Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid room code"})),
        ))
    }
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(str::trim)
}

#[derive(Deserialize)]
pub struct CreateRoomRequest {
    #[serde(default)]
    pub max_participants: Option<usize>,
}

#[derive(Serialize)]
pub struct CreateRoomResponse {
    pub code: String,
    pub join_url: String,
    /// Creator token — present this to `POST /api/rooms/:code/token` once
    /// to mint the first (host) participant token.
    pub creator_token: String,
}

pub async fn create_room(
    State(state): State<AppState>,
    Json(req): Json<CreateRoomRequest>,
) -> Result<Json<CreateRoomResponse>, (StatusCode, Json<Value>)> {
    let room_count = state.redis.room_count().await.unwrap_or(0);
    if room_count >= state.config.max_rooms {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "Maximum room limit reached"})),
        ));
    }

    let code = state.generate_room_code();
    let creator_token = auth::create_room_creator_token(&state.config.jwt_secret, &code);

    let room = crate::state::redis_store::RedisRoom {
        code: code.clone(),
        host_id: String::new(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        max_participants: req
            .max_participants
            .unwrap_or(state.config.max_participants_per_room)
            .min(state.config.max_participants_per_room),
    };

    if let Err(e) = state.redis.create_room(&room).await {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Failed to create room: {e}")})),
        ));
    }

    crate::metrics::ROOMS_CREATED_TOTAL.inc();
    crate::metrics::ROOMS_ACTIVE.inc();

    Ok(Json(CreateRoomResponse {
        join_url: format!("/room/{code}"),
        creator_token,
        code,
    }))
}

#[derive(Serialize)]
pub struct RoomInfoResponse {
    pub code: String,
    pub participant_count: usize,
    pub is_full: bool,
    pub created_at: u64,
}

/// Public room-info endpoint. Returns only aggregate counts — participant
/// names are disclosed only to authenticated joiners.
pub async fn get_room(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<RoomInfoResponse>, (StatusCode, Json<Value>)> {
    let code = validate_room_code(&code)?;

    match state.redis.get_room(&code).await {
        Ok(Some(room)) => {
            let count = state.redis.participant_count(&code).await.unwrap_or(0);
            Ok(Json(RoomInfoResponse {
                code: room.code,
                participant_count: count,
                is_full: count >= room.max_participants,
                created_at: room.created_at,
            }))
        }
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Room not found"})),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Redis error: {e}")})),
        )),
    }
}

#[derive(Deserialize)]
pub struct TokenRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct TokenResponse {
    /// LiveKit JWT — embeds server-generated `identity`.
    pub livekit_token: String,
    /// Lumina signalling JWT — must be sent on WS connect as `?token=...`.
    pub join_token: String,
    /// Server-generated participant identity.
    pub identity: String,
    pub url: String,
}

/// Mint a participant token for a room.
///
/// Caller must present either:
/// - a `creator_token` (returned from `POST /api/rooms`) — only accepted once
///   per room; produces the host participant, or
/// - a valid `join_token` on a room the caller previously joined (for
///   LiveKit re-auth on reconnect).
#[derive(Deserialize)]
pub struct JoinRoomRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct JoinRoomResponse {
    pub livekit_token: String,
    pub join_token: String,
    pub identity: String,
    pub url: String,
}

/// Public join endpoint — mints a plain participant token for anyone with a
/// room code. Never yields host rights (those are minted only via
/// `creator_token` on `/api/rooms/:code/token`). Rate-limited by nginx + the
/// axum middleware.
pub async fn join_room_public(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Json(req): Json<JoinRoomRequest>,
) -> Result<Json<JoinRoomResponse>, (StatusCode, Json<Value>)> {
    let code = validate_room_code(&code)?;

    if !state.redis.room_exists(&code).await.unwrap_or(false) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Room not found"})),
        ));
    }

    let name = req.name.trim();
    if name.is_empty() || name.len() > 64 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid name"})),
        ));
    }

    let count = state.redis.participant_count(&code).await.unwrap_or(0);
    if count >= state.config.max_participants_per_room {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Room is full"})),
        ));
    }

    let identity = uuid::Uuid::new_v4().to_string();
    let _ = state.redis.bind_identity(&code, &identity).await;

    let livekit_token = livekit::create_livekit_token(
        &state.config.livekit_api_key,
        &state.config.livekit_api_secret,
        &code,
        &identity,
        name,
    )
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e})),
        )
    })?;

    let join_token = auth::create_join_token(&state.config.jwt_secret, &code, &identity);

    Ok(Json(JoinRoomResponse {
        livekit_token,
        join_token,
        identity,
        url: state.config.livekit_url.clone(),
    }))
}

pub async fn get_livekit_token(
    State(state): State<AppState>,
    Path(code): Path<String>,
    headers: HeaderMap,
    Json(req): Json<TokenRequest>,
) -> Result<Json<TokenResponse>, (StatusCode, Json<Value>)> {
    let code = validate_room_code(&code)?;

    if !state.redis.room_exists(&code).await.unwrap_or(false) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Room not found"})),
        ));
    }

    let name = req.name.trim();
    if name.is_empty() || name.len() > 64 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Invalid name"})),
        ));
    }

    let token = bearer_token(&headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "Missing bearer token"})),
    ))?;

    let claims = auth::validate_token(&state.config.jwt_secret, token).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(json!({"error": "Invalid token"})),
    ))?;

    if claims.room != code {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({"error": "Token does not match this room"})),
        ));
    }

    let identity = match claims.kind.as_str() {
        "create" => {
            // Creator token is single-use: consume it by atomic SETNX sentinel.
            if !state
                .redis
                .consume_creator_token(&code)
                .await
                .unwrap_or(false)
            {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Creator token already consumed"})),
                ));
            }
            uuid::Uuid::new_v4().to_string()
        }
        "join" => {
            // Re-auth: reuse previously assigned identity.
            if claims.identity.is_empty() {
                return Err((
                    StatusCode::FORBIDDEN,
                    Json(json!({"error": "Token missing identity"})),
                ));
            }
            claims.identity.clone()
        }
        _ => {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({"error": "Unsupported token kind"})),
            ));
        }
    };

    let livekit_token = livekit::create_livekit_token(
        &state.config.livekit_api_key,
        &state.config.livekit_api_secret,
        &code,
        &identity,
        name,
    )
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e})),
        )
    })?;

    let join_token = auth::create_join_token(&state.config.jwt_secret, &code, &identity);

    Ok(Json(TokenResponse {
        livekit_token,
        join_token,
        identity,
        url: state.config.livekit_url.clone(),
    }))
}
