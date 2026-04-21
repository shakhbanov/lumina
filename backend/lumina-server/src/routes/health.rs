use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};

use crate::app_state::AppState;
use crate::metrics;

/// Liveness probe — always returns OK if server is running.
pub async fn health_check(State(state): State<AppState>) -> Json<Value> {
    let rooms = state.redis.room_count().await.unwrap_or(0);
    let connections = state.connections.len();

    Json(json!({
        "status": "ok",
        "node_id": state.config.node_id,
        "rooms": rooms,
        "connections": connections,
    }))
}

/// Readiness probe — checks Redis connectivity.
pub async fn readiness_check(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    if state.redis.ping().await {
        Ok(Json(json!({ "status": "ready" })))
    } else {
        Err(StatusCode::SERVICE_UNAVAILABLE)
    }
}

/// Prometheus metrics endpoint.
pub async fn metrics_endpoint() -> String {
    metrics::gather_metrics()
}
