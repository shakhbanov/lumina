use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(clippy::struct_excessive_bools)]
pub struct Room {
    pub code: String,
    pub host_id: String,
    pub participants: HashMap<String, Participant>,
    pub created_at: u64,
    pub max_participants: usize,
}

impl Room {
    #[must_use]
    pub fn new(code: String, host_id: String) -> Self {
        Self {
            code,
            host_id,
            participants: HashMap::new(),
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            max_participants: 100,
        }
    }

    #[must_use]
    pub fn participant_count(&self) -> usize {
        self.participants.len()
    }

    #[must_use]
    pub fn is_full(&self) -> bool {
        self.participants.len() >= self.max_participants
    }

    pub fn transfer_host(&mut self) -> Option<String> {
        if self.participants.is_empty() {
            return None;
        }
        let new_host = self.participants.keys().next().cloned();
        if let Some(ref id) = new_host {
            self.host_id.clone_from(id);
        }
        new_host
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(clippy::struct_excessive_bools)]
pub struct Participant {
    pub id: String,
    pub name: String,
    pub is_muted: bool,
    pub is_camera_off: bool,
    pub is_hand_raised: bool,
    pub is_screen_sharing: bool,
    pub joined_at: u64,
}

impl Participant {
    #[must_use]
    pub fn new(name: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            is_muted: false,
            is_camera_off: false,
            is_hand_raised: false,
            is_screen_sharing: false,
            joined_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomInfo {
    pub code: String,
    pub participant_count: usize,
    pub is_full: bool,
    pub created_at: u64,
}

impl From<&Room> for RoomInfo {
    fn from(room: &Room) -> Self {
        Self {
            code: room.code.clone(),
            participant_count: room.participant_count(),
            is_full: room.is_full(),
            created_at: room.created_at,
        }
    }
}
