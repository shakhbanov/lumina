use std::sync::LazyLock;

use prometheus::{
    register_histogram, register_int_counter, register_int_gauge,
    Histogram, IntCounter, IntGauge,
};

// ── Connections ──
pub static WS_CONNECTIONS_ACTIVE: LazyLock<IntGauge> = LazyLock::new(|| {
    register_int_gauge!("lumina_ws_connections_active", "Active WebSocket connections")
        .expect("metric")
});

pub static WS_CONNECTIONS_TOTAL: LazyLock<IntCounter> = LazyLock::new(|| {
    register_int_counter!("lumina_ws_connections_total", "Total WebSocket connections opened")
        .expect("metric")
});

// ── Rooms ──
pub static ROOMS_ACTIVE: LazyLock<IntGauge> = LazyLock::new(|| {
    register_int_gauge!("lumina_rooms_active", "Active rooms")
        .expect("metric")
});

pub static ROOMS_CREATED_TOTAL: LazyLock<IntCounter> = LazyLock::new(|| {
    register_int_counter!("lumina_rooms_created_total", "Total rooms created")
        .expect("metric")
});

// ── Messages ──
pub static WS_MESSAGES_RECEIVED: LazyLock<IntCounter> = LazyLock::new(|| {
    register_int_counter!("lumina_ws_messages_received_total", "Total WS messages received")
        .expect("metric")
});

pub static WS_MESSAGES_SENT: LazyLock<IntCounter> = LazyLock::new(|| {
    register_int_counter!("lumina_ws_messages_sent_total", "Total WS messages sent")
        .expect("metric")
});

pub static WS_MESSAGES_DROPPED: LazyLock<IntCounter> = LazyLock::new(|| {
    register_int_counter!("lumina_ws_messages_dropped_total", "WS messages dropped due to backpressure")
        .expect("metric")
});

// ── Latency ──
pub static EVENT_HANDLING_DURATION: LazyLock<Histogram> = LazyLock::new(|| {
    register_histogram!(
        "lumina_event_handling_duration_seconds",
        "Event handling latency",
        vec![0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
    )
    .expect("metric")
});

// ── Rate limiting ──
#[allow(dead_code)]
pub static RATE_LIMITED_REQUESTS: LazyLock<IntCounter> = LazyLock::new(|| {
    register_int_counter!("lumina_rate_limited_total", "Requests rejected by rate limiter")
        .expect("metric")
});

// ── Redis ──
#[allow(dead_code)]
pub static REDIS_OPERATION_DURATION: LazyLock<Histogram> = LazyLock::new(|| {
    register_histogram!(
        "lumina_redis_duration_seconds",
        "Redis operation latency",
        vec![0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]
    )
    .expect("metric")
});

#[allow(dead_code)]
pub static REDIS_ERRORS: LazyLock<IntCounter> = LazyLock::new(|| {
    register_int_counter!("lumina_redis_errors_total", "Redis operation errors")
        .expect("metric")
});

/// Export metrics in Prometheus text format.
pub fn gather_metrics() -> String {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    if encoder.encode(&metric_families, &mut buffer).is_err() {
        return String::new();
    }
    String::from_utf8(buffer).unwrap_or_default()
}
