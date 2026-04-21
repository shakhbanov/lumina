use axum::{
    extract::{ConnectInfo, State},
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use dashmap::DashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::Instant;

use crate::metrics;

/// Token-bucket rate limiter integrated as Axum middleware.
#[derive(Clone)]
pub struct RateLimiter {
    buckets: Arc<DashMap<IpAddr, TokenBucket>>,
    max_tokens: u32,
    refill_rate: u32,
}

struct TokenBucket {
    tokens: f64,
    last_refill: Instant,
}

impl RateLimiter {
    #[must_use]
    pub fn new(max_tokens: u32, refill_rate: u32) -> Self {
        Self {
            buckets: Arc::new(DashMap::new()),
            max_tokens,
            refill_rate,
        }
    }

    #[must_use]
    pub fn check(&self, ip: IpAddr) -> bool {
        let mut entry = self.buckets.entry(ip).or_insert_with(|| TokenBucket {
            tokens: f64::from(self.max_tokens),
            last_refill: Instant::now(),
        });

        let now = Instant::now();
        let elapsed = now.duration_since(entry.last_refill).as_secs_f64();
        entry.tokens = elapsed
            .mul_add(f64::from(self.refill_rate), entry.tokens)
            .min(f64::from(self.max_tokens));
        entry.last_refill = now;

        if entry.tokens >= 1.0 {
            entry.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Remove stale entries (no activity for 5 min)
    pub fn cleanup(&self) {
        let cutoff = Instant::now()
            .checked_sub(std::time::Duration::from_secs(300))
            .expect("300 seconds should not underflow");
        self.buckets.retain(|_, bucket| bucket.last_refill > cutoff);
    }
}

/// Axum middleware function for rate limiting. Expects `RateLimiter` as state.
pub async fn rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    if !limiter.check(addr.ip()) {
        metrics::RATE_LIMITED_REQUESTS.inc();
        return (
            StatusCode::TOO_MANY_REQUESTS,
            "Rate limit exceeded",
        )
            .into_response();
    }
    next.run(request).await
}
