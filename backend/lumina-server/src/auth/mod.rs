use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

/// JWT claims for room access tokens.
///
/// Two flavours:
/// - `kind = "create"` — issued by `POST /api/rooms`. Proves the caller created
///   the room. Required to mint a participant token for the first (host) join.
/// - `kind = "join"`   — issued by `POST /api/rooms/:code/token`. Bound to a
///   specific `identity`. Required on WebSocket connect; the server uses it as
///   the only source of truth for `participant_id`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoomClaims {
    pub kind: String,
    /// Room code
    pub room: String,
    /// Participant identity (empty for `kind="create"`)
    #[serde(default)]
    pub identity: String,
    /// Issued at (unix timestamp)
    pub iat: u64,
    /// Expiry (unix timestamp)
    pub exp: u64,
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn encode_claims(secret: &str, claims: &RoomClaims) -> String {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("JWT encode failed")
}

pub fn create_room_creator_token(secret: &str, room_code: &str) -> String {
    let now = now_secs();
    encode_claims(
        secret,
        &RoomClaims {
            kind: "create".into(),
            room: room_code.to_string(),
            identity: String::new(),
            iat: now,
            exp: now + 86_400,
        },
    )
}

pub fn create_join_token(secret: &str, room_code: &str, identity: &str) -> String {
    let now = now_secs();
    encode_claims(
        secret,
        &RoomClaims {
            kind: "join".into(),
            room: room_code.to_string(),
            identity: identity.to_string(),
            iat: now,
            exp: now + 86_400,
        },
    )
}

pub fn validate_token(secret: &str, token: &str) -> Option<RoomClaims> {
    let mut validation = Validation::default();
    validation.validate_exp = true;
    validation.leeway = 5;

    decode::<RoomClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .ok()
    .map(|data| data.claims)
}

pub fn validate_creator(secret: &str, token: &str, room_code: &str) -> bool {
    matches!(
        validate_token(secret, token),
        Some(c) if c.kind == "create" && c.room == room_code
    )
}

pub fn validate_join(secret: &str, token: &str, room_code: &str) -> Option<String> {
    validate_token(secret, token).and_then(|c| {
        if c.kind == "join" && c.room == room_code && !c.identity.is_empty() {
            Some(c.identity)
        } else {
            None
        }
    })
}
