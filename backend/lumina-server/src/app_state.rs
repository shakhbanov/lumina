use crate::config::Config;
use crate::middleware::rate_limit::RateLimiter;
use crate::state::pubsub::PubSubManager;
use crate::state::redis_store::RedisStore;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

pub type WsSender = mpsc::Sender<axum::extract::ws::Message>;

/// Per-connection info stored server-side (local to this node).
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    pub participant_id: String,
    pub room_code: String,
    pub sender: WsSender,
}

/// Shared application state.
///
/// Architecture:
/// - `redis` — distributed room/participant state (shared across nodes)
/// - `connections` — local WS connections on THIS node only
/// - `room_connections` — local mapping of room -> sessions on THIS node
/// - `pubsub` — Redis `PubSub` for cross-node event distribution
/// - `rate_limiter` — per-IP token bucket (per-node, converges under LB)
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    /// Redis-backed distributed state
    pub redis: RedisStore,
    /// Redis `PubSub` for cross-node messaging
    pub pubsub: PubSubManager,
    /// `session_id` -> `ConnectionInfo` (THIS NODE ONLY)
    pub connections: Arc<DashMap<String, ConnectionInfo>>,
    /// `room_code` -> `Vec<session_id>` (THIS NODE ONLY)
    pub room_connections: Arc<DashMap<String, Vec<String>>>,
    /// Per-IP rate limiter
    pub rate_limiter: RateLimiter,
    /// Graceful shutdown signal
    pub shutdown: Arc<tokio::sync::Notify>,
}

impl AppState {
    pub fn new(
        config: Config,
        redis: RedisStore,
        pubsub: PubSubManager,
    ) -> Self {
        let rate_limiter = RateLimiter::new(
            config.rate_limit_per_sec * 2, // burst = 2x sustained
            config.rate_limit_per_sec,
        );

        Self {
            config,
            redis,
            pubsub,
            connections: Arc::new(DashMap::new()),
            room_connections: Arc::new(DashMap::new()),
            rate_limiter,
            shutdown: Arc::new(tokio::sync::Notify::new()),
        }
    }

    /// Broadcast a message to all LOCAL participants in a room except the sender.
    /// For cross-node broadcast, use `pubsub.publish()`.
    pub fn broadcast_to_room_local(
        &self,
        room_code: &str,
        message: &str,
        exclude_session: Option<&str>,
    ) {
        if let Some(session_ids) = self.room_connections.get(room_code) {
            for session_id in session_ids.iter() {
                if exclude_session.is_none_or(|ex| ex != session_id.as_str()) {
                    if let Some(conn) = self.connections.get(session_id) {
                        match conn.sender.try_send(axum::extract::ws::Message::Text(
                            message.into(),
                        )) {
                            Ok(()) => {
                                crate::metrics::WS_MESSAGES_SENT.inc();
                            }
                            Err(mpsc::error::TrySendError::Full(_)) => {
                                crate::metrics::WS_MESSAGES_DROPPED.inc();
                                tracing::warn!(
                                    session_id = %session_id,
                                    "WS send buffer full — dropping message (backpressure)"
                                );
                            }
                            Err(mpsc::error::TrySendError::Closed(_)) => {
                                // Connection already closed, will be cleaned up
                            }
                        }
                    }
                }
            }
        }
    }

    /// Send a message to a specific participant on THIS node.
    /// Returns false if participant not found locally.
    pub fn send_to_participant_local(
        &self,
        room_code: &str,
        participant_id: &str,
        message: &str,
    ) -> bool {
        if let Some(session_ids) = self.room_connections.get(room_code) {
            for session_id in session_ids.iter() {
                if let Some(conn) = self.connections.get(session_id) {
                    if conn.participant_id == participant_id {
                        match conn.sender.try_send(axum::extract::ws::Message::Text(
                            message.into(),
                        )) {
                            Ok(()) => {
                                crate::metrics::WS_MESSAGES_SENT.inc();
                            }
                            Err(mpsc::error::TrySendError::Full(_)) => {
                                crate::metrics::WS_MESSAGES_DROPPED.inc();
                            }
                            Err(_) => {}
                        }
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Broadcast to room via Redis `PubSub` (all nodes including self).
    pub async fn broadcast_to_room(
        &self,
        room_code: &str,
        message: &str,
        exclude_session: Option<&str>,
    ) {
        // Deliver locally first (lower latency for same-node)
        self.broadcast_to_room_local(room_code, message, exclude_session);
        // Publish to Redis for other nodes
        self.pubsub.publish(room_code, message).await;
    }

    /// Send to participant — try local first, fall back to `PubSub`.
    pub async fn send_to_participant(
        &self,
        room_code: &str,
        participant_id: &str,
        message: &str,
    ) {
        if !self.send_to_participant_local(room_code, participant_id, message) {
            // Participant not on this node — publish to Redis `PubSub`.
            // Other nodes will check if they have this participant.
            self.pubsub.publish(room_code, message).await;
        }
    }

    /// Generate a unique room code (~60 bits of entropy).
    #[must_use]
    pub fn generate_room_code(&self) -> String {
        use rand::Rng;
        let chars: &[u8] = b"abcdefghijkmnpqrstuvwxyz23456789";
        (0..12)
            .map(|_| {
                let idx = rand::thread_rng().gen_range(0..chars.len());
                *chars.get(idx).expect("idx is within range") as char
            })
            .collect()
    }

    /// Remove a local connection and clean up room membership.
    /// Returns `(room_code, participant_id, new_host_id)` if applicable.
    pub async fn remove_connection(
        &self,
        session_id: &str,
    ) -> Option<(String, String, Option<String>)> {
        let conn = self.connections.remove(session_id)?;
        let room_code = conn.1.room_code.clone();
        let participant_id = conn.1.participant_id.clone();

        // Remove from local room_connections
        let local_empty = if let Some(mut sessions) = self.room_connections.get_mut(&room_code) {
            sessions.retain(|s| s != session_id);
            sessions.is_empty()
        } else {
            false
        };

        // Only remove participant from Redis if no other session has reclaimed
        // this participant_id (happens on WS reconnect).
        let reclaimed = self.connections.iter().any(|entry| {
            entry.value().participant_id == participant_id && entry.value().room_code == room_code
        });
        if reclaimed {
            // Another WS session has already taken over — do NOT remove from Redis
            // and do NOT send PeerLeft.
            if local_empty {
                self.room_connections.remove(&room_code);
                self.pubsub.unsubscribe_if_empty(&room_code);
            }
            crate::metrics::WS_CONNECTIONS_ACTIVE.dec();
            return None;
        }

        let _ = self.redis.remove_participant(&room_code, &participant_id).await;

        // Check if room is now empty and handle host transfer
        let participant_count = self.redis.participant_count(&room_code).await.unwrap_or(0);
        let mut new_host = None;

        if participant_count == 0 {
            // Room empty — clean up
            let _ = self.redis.delete_room(&room_code).await;
            crate::metrics::ROOMS_ACTIVE.dec();
        } else {
            // Check if departed was host
            let current_host = self.redis.get_host_id(&room_code).await.unwrap_or(None);
            if current_host.as_deref() == Some(&participant_id) {
                // Host left — close the room for everyone
                new_host = Some("__room_closed__".to_string());
                // Remove all remaining participants from Redis
                let remaining = self.redis.get_participants(&room_code).await.unwrap_or_default();
                for p in &remaining {
                    let _ = self.redis.remove_participant(&room_code, &p.id).await;
                }
                let _ = self.redis.delete_room(&room_code).await;
                crate::metrics::ROOMS_ACTIVE.dec();
            }
        }

        // If no more local connections for this room, unsubscribe from PubSub
        if local_empty {
            self.room_connections.remove(&room_code);
            self.pubsub.unsubscribe_if_empty(&room_code);
        }

        crate::metrics::WS_CONNECTIONS_ACTIVE.dec();

        Some((room_code, participant_id, new_host))
    }
}
