#![allow(dead_code)]

mod app_state;
mod auth;
mod config;
mod livekit;
mod metrics;
mod middleware;
mod routes;
mod security;
mod sfu;
mod state;
mod turn;
mod ws;

use axum::{
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tokio::signal;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use app_state::AppState;
use config::Config;
use state::pubsub::PubSubManager;
use state::redis_store::RedisStore;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = dotenvy::dotenv();

    // Initialize tracing with structured JSON in production
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lumina_server=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let listen_addr = config.listen_addr();
    let cors_origin = config.cors_origin.clone();
    let node_id = config.node_id.clone();

    info!(node_id = %node_id, "Starting Lumina server");

    // ── Initialize Redis ──
    let redis = RedisStore::new(&config.redis_url).await?;

    if !redis.ping().await {
        return Err(format!("Redis is not reachable at {}", config.redis_url).into());
    }
    info!("Redis connected at {}", config.redis_url);

    // ── Initialize PubSub ──
    let pubsub = PubSubManager::new(&config.redis_url, node_id.clone()).await?;
    info!("PubSub manager initialized");

    // ── Build AppState ──
    let state = AppState::new(config, redis, pubsub);

    // ── Background tasks ──

    // Periodic cleanup of stale rooms + rate limiter entries
    let cleanup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;

            let ttl = cleanup_state.config.room_ttl_secs;
            match cleanup_state.redis.cleanup_empty_rooms(ttl).await {
                Ok(n) if n > 0 => info!(cleaned = n, "Cleaned stale rooms"),
                Err(e) => tracing::error!(error = %e, "Room cleanup failed"),
                _ => {}
            }

            cleanup_state.rate_limiter.cleanup();
        }
    });

    // ── Build CORS ──
    let cors = if cors_origin == "*" {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        let origin = cors_origin
            .parse::<axum::http::HeaderValue>()
            .unwrap_or_else(|_| {
                "https://lumina.su"
                    .parse()
                    .unwrap_or_else(|_| axum::http::HeaderValue::from_static("https://lumina.su"))
            });
        CorsLayer::new()
            .allow_origin(origin)
            .allow_methods(Any)
            .allow_headers(Any)
    };

    // ── Build Router ──
    // API routes (behind per-IP rate limiting).
    let api = Router::new()
        .route("/api/health", get(routes::health::health_check))
        .route("/api/ready", get(routes::health::readiness_check))
        .route("/api/metrics", get(routes::health::metrics_endpoint))
        .route("/api/rooms", post(routes::room::create_room))
        .route("/api/rooms/:code", get(routes::room::get_room))
        .route("/api/rooms/:code/join", post(routes::room::join_room_public))
        .route("/api/rooms/:code/token", post(routes::room::get_livekit_token))
        .route(
            "/api/turn-credentials",
            get(routes::turn::get_turn_credentials),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.rate_limiter.clone(),
            middleware::rate_limit::rate_limit_middleware,
        ));

    let app = Router::new()
        .merge(api)
        .route("/ws", get(ws::handler::ws_upgrade))
        .layer(axum_middleware::from_fn(
            security::headers::security_headers,
        ))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state.clone());

    // ── Start server with graceful shutdown ──
    let addr: SocketAddr = listen_addr.parse()?;
    info!("Lumina server listening on {addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal(state.clone()))
    .await?;

    info!("Server shut down gracefully");
    Ok(())
}

/// Wait for SIGINT or SIGTERM, then notify all tasks.
async fn shutdown_signal(state: AppState) {
    let ctrl_c = async {
        if let Err(e) = signal::ctrl_c().await {
            tracing::error!(error = %e, "Failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) = signal::unix::signal(signal::unix::SignalKind::terminate()) {
            sig.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => info!("Received SIGINT"),
        () = terminate => info!("Received SIGTERM"),
    }

    info!("Initiating graceful shutdown...");
    state.shutdown.notify_waiters();

    // Give existing connections time to drain
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
}
