use dashmap::DashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Instant;

#[derive(Clone)]
pub struct RateLimiter {
    buckets: Arc<DashMap<IpAddr, TokenBucket>>,
    max_tokens: u32,
    refill_rate: u32, // tokens per second
}

struct TokenBucket {
    tokens: f64,
    last_refill: Instant,
}

impl RateLimiter {
    pub fn new(max_tokens: u32, refill_rate: u32) -> Self {
        Self {
            buckets: Arc::new(DashMap::new()),
            max_tokens,
            refill_rate,
        }
    }

    pub fn check(&self, ip: IpAddr) -> bool {
        let mut entry = self.buckets.entry(ip).or_insert_with(|| TokenBucket {
            tokens: f64::from(self.max_tokens),
            last_refill: Instant::now(),
        });

        let now = Instant::now();
        let elapsed = now.duration_since(entry.last_refill).as_secs_f64();
        entry.tokens = elapsed.mul_add(f64::from(self.refill_rate), entry.tokens)
            .min(f64::from(self.max_tokens));
        entry.last_refill = now;

        if entry.tokens >= 1.0 {
            entry.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Clean up stale entries (call periodically)
    pub fn cleanup(&self) {
        let cutoff = Instant::now().checked_sub(std::time::Duration::from_secs(300)).expect("300 seconds should not underflow");
        self.buckets.retain(|_, bucket| bucket.last_refill > cutoff);
    }
}
