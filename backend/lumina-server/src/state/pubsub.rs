use dashmap::DashMap;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

/// Cross-node event distribution via Redis `PubSub`.
///
/// Each node subscribes to channels for rooms it has active connections in.
/// When broadcasting, the node publishes to the Redis channel;
/// all subscribed nodes (including self) deliver to their local WS connections.
///
/// Message format on channel `room:{code}`:
///   `{node_id}|{json_payload}`
///
/// Nodes ignore messages from themselves (prevents double-delivery).

#[derive(Clone)]
pub struct PubSubManager {
    /// For publishing
    publish_conn: ConnectionManager,
    /// `node_id` to filter self-messages
    node_id: String,
    /// Active subscriptions: `room_code` -> broadcast sender.
    /// Local WS tasks subscribe to the `broadcast::Receiver`.
    subscriptions: Arc<DashMap<String, broadcast::Sender<String>>>,
    /// Redis URL for creating subscriber connections
    redis_url: String,
}

impl PubSubManager {
    pub async fn new(
        redis_url: &str,
        node_id: String,
    ) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        let publish_conn = ConnectionManager::new(client).await?;

        Ok(Self {
            publish_conn,
            node_id,
            subscriptions: Arc::new(DashMap::new()),
            redis_url: redis_url.to_string(),
        })
    }

    /// Publish a message to a room channel.
    /// All nodes subscribed to this room will receive it.
    pub async fn publish(&self, room_code: &str, message: &str) {
        let mut conn = self.publish_conn.clone();
        let channel = format!("room:{room_code}");
        let payload = format!("{}|{message}", self.node_id);

        if let Err(e) = conn.publish::<_, _, ()>(channel, payload).await {
            error!(room = %room_code, error = %e, "Redis publish failed");
        }
    }

    /// Subscribe this node to a room channel.
    /// Returns a `broadcast::Receiver` that WS handler tasks can listen on.
    pub fn subscribe(&self, room_code: &str) -> broadcast::Receiver<String> {
        // If already subscribed, just return a new receiver
        if let Some(sender) = self.subscriptions.get(room_code) {
            return sender.subscribe();
        }

        // Create broadcast channel (capacity = messages in flight)
        let (tx, rx) = broadcast::channel::<String>(512);
        self.subscriptions.insert(room_code.to_string(), tx);

        // Spawn Redis subscriber task for this room
        let channel = format!("room:{room_code}");
        let node_id = self.node_id.clone();
        let redis_url = self.redis_url.clone();
        let subs = self.subscriptions.clone();
        let room_code_owned = room_code.to_string();

        tokio::spawn(async move {
            let client = match redis::Client::open(redis_url.as_str()) {
                Ok(c) => c,
                Err(e) => {
                    error!(error = %e, "Failed to create Redis PubSub client");
                    return;
                }
            };

            let mut pubsub = match client.get_async_pubsub().await {
                Ok(ps) => ps,
                Err(e) => {
                    error!(error = %e, "Failed to connect Redis PubSub");
                    return;
                }
            };

            if let Err(e) = pubsub.subscribe(&channel).await {
                error!(channel = %channel, error = %e, "Failed to subscribe");
                return;
            }

            info!(channel = %channel, "PubSub subscribed");

            loop {
                let Some(msg) = pubsub.on_message().next().await else {
                    break;
                };

                let payload: String = match msg.get_payload() {
                    Ok(p) => p,
                    Err(_) => continue,
                };

                // Parse: "node_id|json_message"
                if let Some(sep) = payload.find('|') {
                    let sender_node = &payload[..sep];
                    let json_msg = &payload[sep + 1..];

                    // Skip messages from self (we already delivered locally)
                    if sender_node == node_id {
                        continue;
                    }

                    // Broadcast to local subscribers
                    if let Some(sender) = subs.get(&room_code_owned) {
                        let _ = sender.send(json_msg.to_string());
                    } else {
                        // No more local subscribers, stop this listener
                        break;
                    }
                }
            }

            let _ = pubsub.unsubscribe(&channel).await;
            info!(channel = %channel, "PubSub unsubscribed");
        });

        rx
    }

    /// Unsubscribe from a room channel (when last local connection leaves).
    pub fn unsubscribe_if_empty(&self, room_code: &str) {
        // Remove the sender; the spawned task will exit on next iteration
        // when it can't find the sender in the map
        if let Some((_key, sender)) = self.subscriptions.remove(room_code) {
            drop(sender); // Dropping sender causes all receivers to get RecvError
        }
    }

    /// Check if we have active subscriptions for a room.
    #[must_use]
    #[allow(dead_code)]
    pub fn is_subscribed(&self, room_code: &str) -> bool {
        self.subscriptions.contains_key(room_code)
    }
}

// Import for Stream
use futures_util::StreamExt;
