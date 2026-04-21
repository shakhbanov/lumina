use lumina_protocol::events::WsEvent;
use serde_json;

pub fn parse_event(text: &str) -> Result<WsEvent, String> {
    serde_json::from_str(text).map_err(|e| format!("Invalid message: {e}"))
}

pub fn serialize_event(event: &WsEvent) -> String {
    serde_json::to_string(event).unwrap_or_default()
}
