/**
 * Lightweight in-memory fixed-window rate limiter for sensitive endpoints
 * (auth, payment submission, evidence upload, contact form, card download).
 *
 * NOTE: on serverless/multi-instance deployments each instance keeps its own
 * window. That still throttles abuse usefully; for strict global limits back
 * this with a shared store (e.g. Vercel KV / Upstash) — see docs/security.md.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically evict expired buckets so the map cannot grow unboundedly.
const SWEEP_INTERVAL = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
    };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}
