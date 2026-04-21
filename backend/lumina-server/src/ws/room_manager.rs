use crate::app_state::AppState;
use crate::metrics;
use crate::state::redis_store::{ParticipantState, RedisParticipant, RedisRoom};
use lumina_protocol::events::ParticipantInfo;

/// Handle a participant joining a room (`Redis`-backed).
///
/// The `identity` argument is the authenticated participant ID from the JWT —
/// the server always uses it verbatim. On reconnect, if the participant still
/// exists we keep their state; otherwise we re-create with the same ID so
/// LiveKit identities continue to match.
/// Returns `(participant_id, is_new_room, participant_list)`.
pub async fn join_room(
    state: &AppState,
    room_code: &str,
    name: &str,
    identity: &str,
) -> Result<(String, bool, Vec<ParticipantInfo>), String> {
    let room_code = room_code.to_lowercase();

    let room_count = state.redis.room_count().await.unwrap_or(0);
    if room_count >= state.config.max_rooms {
        return Err("Maximum room limit reached".into());
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let new_room = RedisRoom {
        code: room_code.clone(),
        host_id: String::new(),
        created_at: now,
        max_participants: state.config.max_participants_per_room,
    };

    let is_new = state
        .redis
        .create_room(&new_room)
        .await
        .map_err(|e| format!("Redis error: {e}"))?;

    if is_new {
        metrics::ROOMS_CREATED_TOTAL.inc();
        metrics::ROOMS_ACTIVE.inc();
    }

    // Reject unknown identities — the JWT must have bound one already.
    if !state
        .redis
        .has_identity(&room_code, identity)
        .await
        .unwrap_or(false)
    {
        return Err("Unknown identity for this room".into());
    }

    let existing = state
        .redis
        .get_participant(&room_code, identity)
        .await
        .unwrap_or(None);

    if existing.is_none() {
        let count = state
            .redis
            .participant_count(&room_code)
            .await
            .unwrap_or(0);
        if count >= state.config.max_participants_per_room {
            return Err("Room is full".into());
        }

        let participant = RedisParticipant {
            id: identity.to_string(),
            name: name.to_string(),
            state: ParticipantState::default(),
            joined_at: now,
        };

        state
            .redis
            .add_participant(&room_code, &participant)
            .await
            .map_err(|e| format!("Redis error: {e}"))?;

        let new_count = state
            .redis
            .participant_count(&room_code)
            .await
            .unwrap_or(0);
        if new_count <= 1 || is_new {
            let _ = state.redis.set_host(&room_code, identity).await;
        }
    }

    let all_participants = state
        .redis
        .get_participants(&room_code)
        .await
        .unwrap_or_default();

    let host_id = state
        .redis
        .get_host_id(&room_code)
        .await
        .unwrap_or(None)
        .unwrap_or_default();

    let participants: Vec<ParticipantInfo> = all_participants
        .iter()
        .map(|p| ParticipantInfo {
            id: p.id.clone(),
            name: p.name.clone(),
            avatar: None,
            is_host: host_id == p.id,
            is_muted: p.state.is_muted,
            is_camera_off: p.state.is_camera_off,
        })
        .collect();

    Ok((identity.to_string(), is_new, participants))
}
