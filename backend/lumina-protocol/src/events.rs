use serde::{Deserialize, Serialize};
use serde_json::Value;

/// All WebSocket event types exchanged between client and server.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsEvent {
    // === Room lifecycle ===
    #[serde(rename = "meeting.join")]
    Join(JoinPayload),

    #[serde(rename = "meeting.leave")]
    Leave(LeavePayload),

    #[serde(rename = "meeting.peer_joined")]
    PeerJoined(PeerJoinedPayload),

    #[serde(rename = "meeting.peer_left")]
    PeerLeft(PeerLeftPayload),

    #[serde(rename = "meeting.room_closed")]
    RoomClosed(RoomClosedPayload),

    // === WebRTC signaling ===
    #[serde(rename = "meeting.signal")]
    Signal(SignalPayload),

    // === Host controls ===
    #[serde(rename = "meeting.host_transfer")]
    HostTransfer(HostTransferPayload),

    #[serde(rename = "meeting.mute_participant")]
    MuteParticipant(MuteParticipantPayload),

    #[serde(rename = "meeting.permission")]
    Permission(PermissionPayload),

    // === Communication ===
    #[serde(rename = "meeting.chat")]
    Chat(ChatPayload),

    #[serde(rename = "meeting.hand_raise")]
    HandRaise(HandRaisePayload),

    #[serde(rename = "meeting.reaction")]
    Reaction(ReactionPayload),

    // === Media ===
    #[serde(rename = "meeting.recording")]
    Recording(RecordingPayload),

    #[serde(rename = "meeting.screen_share")]
    ScreenShare(ScreenSharePayload),

    // === AI / Transcription ===
    #[serde(rename = "meeting.copilot_sync")]
    CopilotSync(CopilotSyncPayload),

    // === E2E encryption ===
    #[serde(rename = "meeting.e2e_key_exchange")]
    E2EKeyExchange(E2EKeyExchangePayload),

    // === SFU control ===
    #[serde(rename = "meeting.sfu_transport")]
    SfuTransport(SfuTransportPayload),

    #[serde(rename = "meeting.sfu_produce")]
    SfuProduce(SfuProducePayload),

    #[serde(rename = "meeting.sfu_consume")]
    SfuConsume(SfuConsumePayload),

    // === Error ===
    #[serde(rename = "error")]
    Error(ErrorPayload),
}

// --- Payload types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinPayload {
    pub room_code: String,
    pub name: String,
    #[serde(default)]
    pub avatar: Option<String>,
    /// When set, the server will try to reclaim the existing participant
    /// instead of creating a new one (used on WebSocket reconnect).
    #[serde(default)]
    pub participant_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeavePayload {
    pub room_code: String,
    pub participant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerJoinedPayload {
    pub room_code: String,
    pub participant_id: String,
    pub name: String,
    #[serde(default)]
    pub avatar: Option<String>,
    pub is_host: bool,
    pub participants: Vec<ParticipantInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantInfo {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub avatar: Option<String>,
    pub is_host: bool,
    pub is_muted: bool,
    pub is_camera_off: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerLeftPayload {
    pub room_code: String,
    pub participant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomClosedPayload {
    pub room_code: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalPayload {
    pub room_code: String,
    pub target_id: String,
    pub sender_id: String,
    #[serde(rename = "signalType")]
    pub signal_type: SignalType,
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SignalType {
    Offer,
    Answer,
    Candidate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostTransferPayload {
    pub room_code: String,
    pub new_host_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MuteParticipantPayload {
    pub room_code: String,
    pub target_id: String,
    pub muted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionPayload {
    pub room_code: String,
    pub target_id: String,
    pub permission: String,
    pub granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatPayload {
    pub room_code: String,
    pub sender_id: String,
    pub sender_name: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandRaisePayload {
    pub room_code: String,
    pub participant_id: String,
    pub raised: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactionPayload {
    pub room_code: String,
    pub participant_id: String,
    pub emoji: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingPayload {
    pub room_code: String,
    pub participant_id: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenSharePayload {
    pub room_code: String,
    pub participant_id: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopilotSyncPayload {
    pub room_code: String,
    pub sender_id: String,
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2EKeyExchangePayload {
    pub room_code: String,
    pub sender_id: String,
    #[serde(default)]
    pub target_id: Option<String>,
    pub action: E2EAction,
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum E2EAction {
    PublishBundle,
    SessionKey,
    RequestBundle,
    KeyRotation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SfuTransportPayload {
    pub room_code: String,
    pub participant_id: String,
    pub direction: String,
    #[serde(default)]
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SfuProducePayload {
    pub room_code: String,
    pub participant_id: String,
    pub kind: String,
    pub rtp_parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SfuConsumePayload {
    pub room_code: String,
    pub participant_id: String,
    pub producer_id: String,
    pub rtp_capabilities: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}
