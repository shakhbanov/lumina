use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::error;

/// Room data stored in Redis as a Hash.
/// Key: `room:{code}` — fields: `host_id`, `created_at`, `max_participants`.
///
/// Participant list stored as `room:{code}:participants` hash (`participant_id` -> JSON).
///
/// Room existence tracked in `rooms` sorted set (score = `created_at`).

/// Participant media/UI state.
#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct ParticipantState {
    pub is_muted: bool,
    pub is_camera_off: bool,
    pub is_hand_raised: bool,
    pub is_screen_sharing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisParticipant {
    pub id: String,
    pub name: String,
    pub state: ParticipantState,
    pub joined_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisRoom {
    pub code: String,
    pub host_id: String,
    pub created_at: u64,
    pub max_participants: usize,
}

#[derive(Clone)]
pub struct RedisStore {
    conn: ConnectionManager,
}

impl RedisStore {
    pub async fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let conn = ConnectionManager::new(client).await?;
        Ok(Self { conn })
    }

    // ── Room operations ──

    #[allow(clippy::cast_precision_loss)]
    pub async fn create_room(&self, room: &RedisRoom) -> Result<bool, redis::RedisError> {
        let mut conn = self.conn.clone();
        let key = format!("room:{}", room.code);

        // HSETNX to atomically create only if not exists
        let created: bool = redis::cmd("HSETNX")
            .arg(&key)
            .arg("host_id")
            .arg(&room.host_id)
            .query_async(&mut conn)
            .await?;

        if created {
            // Set remaining fields
            // Precision loss is acceptable for Redis sorted set scores (timestamps)
            let score = room.created_at as f64;
            redis::pipe()
                .hset(&key, "created_at", room.created_at)
                .hset(&key, "max_participants", room.max_participants)
                .zadd("rooms", &room.code, score)
                .query_async::<()>(&mut conn)
                .await?;
        }

        Ok(created)
    }

    pub async fn get_room(&self, code: &str) -> Result<Option<RedisRoom>, redis::RedisError> {
        let mut conn = self.conn.clone();
        let key = format!("room:{code}");

        let result: HashMap<String, String> = conn.hgetall(&key).await?;
        if result.is_empty() {
            return Ok(None);
        }

        Ok(Some(RedisRoom {
            code: code.to_string(),
            host_id: result.get("host_id").cloned().unwrap_or_default(),
            created_at: result
                .get("created_at")
                .and_then(|v| v.parse().ok())
                .unwrap_or(0),
            max_participants: result
                .get("max_participants")
                .and_then(|v| v.parse().ok())
                .unwrap_or(100),
        }))
    }

    pub async fn room_exists(&self, code: &str) -> Result<bool, redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.exists(format!("room:{code}")).await
    }

    pub async fn room_count(&self) -> Result<usize, redis::RedisError> {
        let mut conn = self.conn.clone();
        let count: usize = conn.zcard("rooms").await?;
        Ok(count)
    }

    pub async fn set_host(&self, code: &str, host_id: &str) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.hset(format!("room:{code}"), "host_id", host_id)
            .await
    }

    /// Atomically consume the one-shot creator token sentinel for a room.
    /// Returns `true` the first time it's called per room, `false` afterwards.
    pub async fn consume_creator_token(&self, code: &str) -> Result<bool, redis::RedisError> {
        let mut conn = self.conn.clone();
        // SET key value NX EX <ttl>  — set only if absent, with 24h expiry.
        let set: Option<String> = redis::cmd("SET")
            .arg(format!("room:{code}:creator_used"))
            .arg(1)
            .arg("NX")
            .arg("EX")
            .arg(86_400)
            .query_async(&mut conn)
            .await?;
        Ok(set.is_some())
    }

    /// Bind a LiveKit / signalling identity to a room so subsequent reconnects
    /// can reuse it. Returns `true` if this is a new bind, `false` if the same
    /// identity was already bound (re-auth is OK).
    pub async fn bind_identity(
        &self,
        code: &str,
        identity: &str,
    ) -> Result<bool, redis::RedisError> {
        let mut conn = self.conn.clone();
        let added: i64 = conn
            .sadd(format!("room:{code}:identities"), identity)
            .await?;
        Ok(added > 0)
    }

    pub async fn has_identity(
        &self,
        code: &str,
        identity: &str,
    ) -> Result<bool, redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.sismember(format!("room:{code}:identities"), identity)
            .await
    }

    /// Set a per-room E2EE key. SFU never sees it, but the signalling server
    /// hands it out to authenticated joiners so every participant can decrypt
    /// each other's media without the user copy-pasting a key.
    pub async fn set_e2ee_key(
        &self,
        code: &str,
        key: &str,
    ) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.hset(format!("room:{code}"), "e2ee_key", key).await
    }

    pub async fn get_e2ee_key(
        &self,
        code: &str,
    ) -> Result<Option<String>, redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.hget(format!("room:{code}"), "e2ee_key").await
    }

    pub async fn delete_room(&self, code: &str) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        redis::pipe()
            .del(format!("room:{code}"))
            .del(format!("room:{code}:participants"))
            .del(format!("room:{code}:identities"))
            .del(format!("room:{code}:creator_used"))
            .zrem("rooms", code)
            .query_async::<()>(&mut conn)
            .await?;
        Ok(())
    }

    // ── Participant operations ──

    pub async fn add_participant(
        &self,
        code: &str,
        participant: &RedisParticipant,
    ) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        let json = serde_json::to_string(participant).unwrap_or_default();
        conn.hset(
            format!("room:{code}:participants"),
            &participant.id,
            json,
        )
        .await
    }

    pub async fn remove_participant(
        &self,
        code: &str,
        participant_id: &str,
    ) -> Result<(), redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.hdel(format!("room:{code}:participants"), participant_id)
            .await
    }

    pub async fn get_participants(
        &self,
        code: &str,
    ) -> Result<Vec<RedisParticipant>, redis::RedisError> {
        let mut conn = self.conn.clone();
        let result: HashMap<String, String> =
            conn.hgetall(format!("room:{code}:participants")).await?;

        let mut participants = Vec::with_capacity(result.len());
        for (_id, json) in result {
            if let Ok(p) = serde_json::from_str::<RedisParticipant>(&json) {
                participants.push(p);
            }
        }
        Ok(participants)
    }

    pub async fn get_participant(
        &self,
        code: &str,
        participant_id: &str,
    ) -> Result<Option<RedisParticipant>, redis::RedisError> {
        let mut conn = self.conn.clone();
        let json: Option<String> = conn
            .hget(format!("room:{code}:participants"), participant_id)
            .await?;
        Ok(json.and_then(|j| serde_json::from_str(&j).ok()))
    }

    pub async fn update_participant(
        &self,
        code: &str,
        participant: &RedisParticipant,
    ) -> Result<(), redis::RedisError> {
        // Same as add — overwrites
        self.add_participant(code, participant).await
    }

    pub async fn participant_count(&self, code: &str) -> Result<usize, redis::RedisError> {
        let mut conn = self.conn.clone();
        let count: usize = conn.hlen(format!("room:{code}:participants")).await?;
        Ok(count)
    }

    pub async fn get_host_id(&self, code: &str) -> Result<Option<String>, redis::RedisError> {
        let mut conn = self.conn.clone();
        conn.hget(format!("room:{code}"), "host_id").await
    }

    // ── Cleanup ──

    #[allow(clippy::cast_precision_loss)]
    pub async fn cleanup_empty_rooms(&self, ttl: u64) -> Result<usize, redis::RedisError> {
        let mut conn = self.conn.clone();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        // Get all rooms created before cutoff (precision loss acceptable for timestamps)
        let cutoff = now.saturating_sub(ttl) as f64;
        let old_rooms: Vec<String> = conn.zrangebyscore("rooms", 0f64, cutoff).await?;

        let mut cleaned = 0;
        for code in &old_rooms {
            let count = self.participant_count(code).await.unwrap_or(1);
            if count == 0 {
                if let Err(e) = self.delete_room(code).await {
                    error!(room = %code, error = %e, "Failed to cleanup room");
                } else {
                    cleaned += 1;
                }
            }
        }
        Ok(cleaned)
    }

    // ── Health check ──

    pub async fn ping(&self) -> bool {
        let mut conn = self.conn.clone();
        redis::cmd("PING")
            .query_async::<String>(&mut conn)
            .await
            .is_ok()
    }
}
