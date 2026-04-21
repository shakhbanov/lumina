use axum::{
    extract::{
        ws::{Message, WebSocket},
        ConnectInfo, Query, State, WebSocketUpgrade,
    },
    http::{HeaderMap, StatusCode},
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::net::SocketAddr;
use std::time::Instant;
use tokio::sync::mpsc;
use tracing::{info, warn};

use crate::app_state::{AppState, ConnectionInfo};
use crate::auth;
use crate::metrics;
use crate::ws::events::{parse_event, serialize_event};
use crate::ws::room_manager;
use lumina_protocol::events::{
    ErrorPayload, PeerJoinedPayload, PeerLeftPayload, RoomClosedPayload, WsEvent,
};

/// Max accepted Text/Binary frame size. LiveKit signalling is the heaviest
/// legitimate traffic; signal payloads are well under 64 KiB.
const MAX_FRAME_BYTES: usize = 64 * 1024;
/// Per-connection message budget: tokens per second.
const WS_RATE_PER_SEC: f64 = 20.0;
/// Burst capacity on top of the sustained rate.
const WS_RATE_BURST: f64 = 40.0;

#[derive(Deserialize)]
pub struct WsAuthQuery {
    pub token: String,
    pub room: String,
}

pub async fn ws_upgrade(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(q): Query<WsAuthQuery>,
) -> Result<axum::response::Response, StatusCode> {
    // --- Origin check (CSWSH defence) ---
    if let Some(origin) = headers
        .get(axum::http::header::ORIGIN)
        .and_then(|h| h.to_str().ok())
    {
        let allowed = state.config.cors_origin.as_str();
        if allowed != "*" && origin != allowed {
            warn!(origin = %origin, "Rejected WS upgrade: disallowed Origin");
            return Err(StatusCode::FORBIDDEN);
        }
    }

    // --- Token validation ---
    let room_code = q.room.to_lowercase();
    let identity = match auth::validate_join(&state.config.jwt_secret, &q.token, &room_code) {
        Some(id) => id,
        None => {
            warn!(ip = %addr.ip(), "Rejected WS upgrade: invalid join token");
            return Err(StatusCode::UNAUTHORIZED);
        }
    };

    if !state
        .redis
        .has_identity(&room_code, &identity)
        .await
        .unwrap_or(false)
    {
        // First time this identity connects — bind it.
        let _ = state.redis.bind_identity(&room_code, &identity).await;
    }

    Ok(ws
        .max_message_size(MAX_FRAME_BYTES)
        .max_frame_size(MAX_FRAME_BYTES)
        .on_upgrade(move |socket| handle_socket(socket, state, room_code, identity)))
}

struct MessageBucket {
    tokens: f64,
    last: Instant,
}

impl MessageBucket {
    fn new() -> Self {
        Self {
            tokens: WS_RATE_BURST,
            last: Instant::now(),
        }
    }

    fn check(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last).as_secs_f64();
        self.tokens = (self.tokens + elapsed * WS_RATE_PER_SEC).min(WS_RATE_BURST);
        self.last = now;
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

#[allow(clippy::cognitive_complexity)]
async fn handle_socket(
    socket: WebSocket,
    state: AppState,
    room_code: String,
    identity: String,
) {
    let session_id = uuid::Uuid::new_v4().to_string();
    let (mut ws_sink, mut ws_stream) = socket.split();

    metrics::WS_CONNECTIONS_TOTAL.inc();
    metrics::WS_CONNECTIONS_ACTIVE.inc();

    let capacity = state.config.ws_channel_capacity;
    let (tx, mut rx) = mpsc::channel::<Message>(capacity);

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Identity is pinned from the JWT — client never chooses it.
    let mut joined = false;
    let mut bucket = MessageBucket::new();

    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            Message::Text(text) => {
                if text.len() > MAX_FRAME_BYTES {
                    warn!(session_id = %session_id, len = text.len(), "Oversized WS frame");
                    break;
                }
                if !bucket.check() {
                    metrics::RATE_LIMITED_REQUESTS.inc();
                    continue;
                }
                metrics::WS_MESSAGES_RECEIVED.inc();

                match parse_event(&text) {
                    Ok(event) => {
                        let start = Instant::now();
                        handle_event(
                            &state,
                            &session_id,
                            &tx,
                            &room_code,
                            &identity,
                            &mut joined,
                            event,
                        )
                        .await;
                        metrics::EVENT_HANDLING_DURATION
                            .observe(start.elapsed().as_secs_f64());
                    }
                    Err(e) => {
                        let err = WsEvent::Error(ErrorPayload {
                            code: "invalid_message".into(),
                            message: e,
                        });
                        let _ = tx.try_send(Message::Text(serialize_event(&err).into()));
                    }
                }
            }
            Message::Ping(data) => {
                let _ = tx.try_send(Message::Pong(data));
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    if let Some((room_code, participant_id, new_host)) =
        state.remove_connection(&session_id).await
    {
        info!(
            session_id = %session_id,
            room_code = %room_code,
            participant_id = %participant_id,
            "Participant disconnected"
        );

        let leave_event = WsEvent::PeerLeft(PeerLeftPayload {
            room_code: room_code.clone(),
            participant_id,
        });
        state
            .broadcast_to_room(&room_code, &serialize_event(&leave_event), None)
            .await;

        if let Some(ref sentinel) = new_host {
            if sentinel == "__room_closed__" {
                let closed_event = WsEvent::RoomClosed(RoomClosedPayload {
                    room_code: room_code.clone(),
                    reason: "host_left".into(),
                });
                state
                    .broadcast_to_room(&room_code, &serialize_event(&closed_event), None)
                    .await;
            }
        }
    }

    send_task.abort();
}

fn ensure_scope(payload_room: &str, current_room: &str) -> bool {
    payload_room.eq_ignore_ascii_case(current_room)
}

#[allow(clippy::too_many_arguments, clippy::cognitive_complexity)]
async fn handle_event(
    state: &AppState,
    session_id: &str,
    tx: &mpsc::Sender<Message>,
    current_room: &str,
    current_identity: &str,
    joined: &mut bool,
    event: WsEvent,
) {
    // Every room-scoped event must target the authenticated room.
    let room_ok = match &event {
        WsEvent::Join(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::Signal(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::Chat(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::HandRaise(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::Reaction(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::Recording(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::ScreenShare(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::MuteParticipant(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::Permission(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::HostTransfer(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::CopilotSync(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::E2EKeyExchange(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::Leave(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::SfuTransport(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::SfuProduce(p) => ensure_scope(&p.room_code, current_room),
        WsEvent::SfuConsume(p) => ensure_scope(&p.room_code, current_room),
        _ => true,
    };
    if !room_ok {
        send_error(tx, "forbidden", "Event room does not match session");
        return;
    }

    // Non-Join events require a prior Join.
    if !*joined && !matches!(event, WsEvent::Join(_) | WsEvent::Leave(_)) {
        send_error(tx, "not_joined", "Must send meeting.join first");
        return;
    }

    match event {
        WsEvent::Join(payload) => {
            handle_join(state, session_id, tx, current_room, current_identity, payload, joined)
                .await;
        }
        WsEvent::Signal(mut payload) => {
            // Sender is always the authenticated identity.
            payload.sender_id = current_identity.to_string();
            let msg = serialize_event(&WsEvent::Signal(payload.clone()));
            state
                .send_to_participant(&payload.room_code, &payload.target_id, &msg)
                .await;
        }
        WsEvent::Chat(mut payload) => {
            payload.sender_id = current_identity.to_string();
            let name = state
                .redis
                .get_participant(&payload.room_code, current_identity)
                .await
                .ok()
                .flatten()
                .map(|p| p.name)
                .unwrap_or_default();
            if !name.is_empty() {
                payload.sender_name = name;
            }
            // Clamp content length defensively (protocol has no strict limit).
            if payload.content.len() > 4_000 {
                payload.content.truncate(4_000);
            }
            let msg = serialize_event(&WsEvent::Chat(payload.clone()));
            state.broadcast_to_room(&payload.room_code, &msg, None).await;
        }
        WsEvent::HandRaise(mut payload) => {
            payload.participant_id = current_identity.to_string();
            handle_hand_raise(state, &payload).await;
        }
        WsEvent::Reaction(mut payload) => {
            payload.participant_id = current_identity.to_string();
            let msg = serialize_event(&WsEvent::Reaction(payload.clone()));
            state.broadcast_to_room(&payload.room_code, &msg, None).await;
        }
        WsEvent::Recording(mut payload) => {
            payload.participant_id = current_identity.to_string();
            let msg = serialize_event(&WsEvent::Recording(payload.clone()));
            state.broadcast_to_room(&payload.room_code, &msg, None).await;
        }
        WsEvent::ScreenShare(mut payload) => {
            payload.participant_id = current_identity.to_string();
            handle_screen_share(state, &payload).await;
        }
        WsEvent::MuteParticipant(payload) => {
            handle_mute(state, Some(current_identity), &payload).await;
        }
        WsEvent::Permission(payload) => {
            if check_host(state, &payload.room_code, Some(current_identity)).await {
                let msg = serialize_event(&WsEvent::Permission(payload.clone()));
                state
                    .send_to_participant(&payload.room_code, &payload.target_id, &msg)
                    .await;
            }
        }
        WsEvent::HostTransfer(payload) => {
            if check_host(state, &payload.room_code, Some(current_identity)).await {
                let _ = state
                    .redis
                    .set_host(&payload.room_code, &payload.new_host_id)
                    .await;
                let msg = serialize_event(&WsEvent::HostTransfer(payload.clone()));
                state.broadcast_to_room(&payload.room_code, &msg, None).await;
            }
        }
        WsEvent::CopilotSync(mut payload) => {
            payload.sender_id = current_identity.to_string();
            let msg = serialize_event(&WsEvent::CopilotSync(payload.clone()));
            state
                .broadcast_to_room(&payload.room_code, &msg, Some(session_id))
                .await;
        }
        WsEvent::E2EKeyExchange(mut payload) => {
            payload.sender_id = current_identity.to_string();
            handle_e2e_key_exchange(state, session_id, &payload).await;
        }
        WsEvent::Leave(_) => {
            info!(participant_id = %current_identity, room_code = %current_room, "Participant leaving");
        }
        WsEvent::SfuTransport(_) | WsEvent::SfuProduce(_) | WsEvent::SfuConsume(_) => {
            send_error(tx, "not_implemented", "SFU mode not yet available");
        }
        _ => {}
    }
}

async fn handle_join(
    state: &AppState,
    session_id: &str,
    tx: &mpsc::Sender<Message>,
    current_room: &str,
    current_identity: &str,
    payload: lumina_protocol::events::JoinPayload,
    joined: &mut bool,
) {
    match room_manager::join_room(state, current_room, &payload.name, current_identity).await {
        Ok((participant_id, _is_new, participants)) => {
            let conn = ConnectionInfo {
                participant_id: participant_id.clone(),
                room_code: current_room.to_string(),
                sender: tx.clone(),
            };
            state.connections.insert(session_id.to_string(), conn);
            state
                .room_connections
                .entry(current_room.to_string())
                .or_default()
                .push(session_id.to_string());

            let mut pubsub_rx = state.pubsub.subscribe(current_room);
            let local_tx = tx.clone();
            tokio::spawn(async move {
                while let Ok(msg) = pubsub_rx.recv().await {
                    if local_tx.try_send(Message::Text(msg.into())).is_err() {
                        break;
                    }
                }
            });

            *joined = true;

            let is_host = state
                .redis
                .get_host_id(current_room)
                .await
                .unwrap_or(None)
                .as_deref()
                == Some(&participant_id);

            info!(
                session_id = %session_id,
                room_code = %current_room,
                participant_id = %participant_id,
                name = %payload.name,
                is_host = is_host,
                "Participant joined"
            );

            let joined_event = WsEvent::PeerJoined(PeerJoinedPayload {
                room_code: current_room.to_string(),
                participant_id,
                name: payload.name,
                avatar: payload.avatar,
                is_host,
                participants,
            });
            state
                .broadcast_to_room(current_room, &serialize_event(&joined_event), None)
                .await;
        }
        Err(e) => send_error(tx, "join_failed", &e),
    }
}

async fn handle_hand_raise(
    state: &AppState,
    payload: &lumina_protocol::events::HandRaisePayload,
) {
    if let Ok(Some(mut p)) = state
        .redis
        .get_participant(&payload.room_code, &payload.participant_id)
        .await
    {
        p.state.is_hand_raised = payload.raised;
        let _ = state
            .redis
            .update_participant(&payload.room_code, &p)
            .await;
    }
    let msg = serialize_event(&WsEvent::HandRaise(payload.clone()));
    state.broadcast_to_room(&payload.room_code, &msg, None).await;
}

async fn handle_screen_share(
    state: &AppState,
    payload: &lumina_protocol::events::ScreenSharePayload,
) {
    if let Ok(Some(mut p)) = state
        .redis
        .get_participant(&payload.room_code, &payload.participant_id)
        .await
    {
        p.state.is_screen_sharing = payload.active;
        let _ = state
            .redis
            .update_participant(&payload.room_code, &p)
            .await;
    }
    let msg = serialize_event(&WsEvent::ScreenShare(payload.clone()));
    state.broadcast_to_room(&payload.room_code, &msg, None).await;
}

async fn handle_mute(
    state: &AppState,
    current_participant_id: Option<&str>,
    payload: &lumina_protocol::events::MuteParticipantPayload,
) {
    if !check_host(state, &payload.room_code, current_participant_id).await {
        return;
    }
    if let Ok(Some(mut p)) = state
        .redis
        .get_participant(&payload.room_code, &payload.target_id)
        .await
    {
        p.state.is_muted = payload.muted;
        let _ = state
            .redis
            .update_participant(&payload.room_code, &p)
            .await;
    }
    let msg = serialize_event(&WsEvent::MuteParticipant(payload.clone()));
    state
        .send_to_participant(&payload.room_code, &payload.target_id, &msg)
        .await;
}

async fn handle_e2e_key_exchange(
    state: &AppState,
    session_id: &str,
    payload: &lumina_protocol::events::E2EKeyExchangePayload,
) {
    let msg = serialize_event(&WsEvent::E2EKeyExchange(payload.clone()));
    if let Some(target_id) = &payload.target_id {
        state
            .send_to_participant(&payload.room_code, target_id, &msg)
            .await;
    } else {
        state
            .broadcast_to_room(&payload.room_code, &msg, Some(session_id))
            .await;
    }
}

fn send_error(tx: &mpsc::Sender<Message>, code: &str, message: &str) {
    let err = WsEvent::Error(ErrorPayload {
        code: code.into(),
        message: message.into(),
    });
    let _ = tx.try_send(Message::Text(serialize_event(&err).into()));
}

async fn check_host(
    state: &AppState,
    room_code: &str,
    current_participant_id: Option<&str>,
) -> bool {
    let host = state.redis.get_host_id(room_code).await.unwrap_or(None);
    match (host, current_participant_id) {
        (Some(h), Some(pid)) => h == pid,
        _ => false,
    }
}
