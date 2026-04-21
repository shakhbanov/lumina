use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LuminaError {
    RoomNotFound(String),
    RoomFull(String),
    NotAuthorized(String),
    InvalidMessage(String),
    RateLimited,
    InternalError(String),
}

impl fmt::Display for LuminaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RoomNotFound(code) => write!(f, "Room not found: {code}"),
            Self::RoomFull(code) => write!(f, "Room is full: {code}"),
            Self::NotAuthorized(msg) => write!(f, "Not authorized: {msg}"),
            Self::InvalidMessage(msg) => write!(f, "Invalid message: {msg}"),
            Self::RateLimited => write!(f, "Rate limited"),
            Self::InternalError(msg) => write!(f, "Internal error: {msg}"),
        }
    }
}

impl std::error::Error for LuminaError {}
