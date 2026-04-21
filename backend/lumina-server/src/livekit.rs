use jsonwebtoken::{encode, EncodingKey, Header};
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[allow(clippy::struct_excessive_bools)]
struct VideoGrant {
    #[serde(rename = "roomJoin")]
    room_join: bool,
    room: String,
    #[serde(rename = "canPublish")]
    can_publish: bool,
    #[serde(rename = "canSubscribe")]
    can_subscribe: bool,
    #[serde(rename = "canPublishData")]
    can_publish_data: bool,
}

#[derive(Debug, Serialize)]
struct LiveKitClaims {
    iss: String,
    sub: String,
    name: String,
    exp: u64,
    nbf: u64,
    iat: u64,
    jti: String,
    video: VideoGrant,
}

/// Generate a `LiveKit` access token for a participant to join a room.
pub fn create_livekit_token(
    api_key: &str,
    api_secret: &str,
    room_name: &str,
    participant_identity: &str,
    participant_name: &str,
) -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let claims = LiveKitClaims {
        iss: api_key.to_string(),
        sub: participant_identity.to_string(),
        name: participant_name.to_string(),
        exp: now + 86_400, // 24 hours
        nbf: now,
        iat: now,
        jti: uuid::Uuid::new_v4().to_string(),
        video: VideoGrant {
            room_join: true,
            room: room_name.to_string(),
            can_publish: true,
            can_subscribe: true,
            can_publish_data: true,
        },
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(api_secret.as_bytes()),
    )
    .map_err(|e| format!("Failed to create LiveKit token: {e}"))
}
