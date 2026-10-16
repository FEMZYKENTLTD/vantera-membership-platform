import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

describe('per-key rate limiting', () => {
  it('allows within the bucket and rejects beyond it', () => {
    const key = `test-${Math.random()}`;
    const t0 = 1_000_000;
    expect(checkRateLimit(key, 3, 60_000, t0).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, t0 + 1).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, t0 + 2).ok).toBe(true);
    const fourth = checkRateLimit(key, 3, 60_000, t0 + 3);
    expect(fourth.ok).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const key = `test-${Math.random()}`;
    const t0 = 2_000_000;
    expect(checkRateLimit(key, 1, 1000, t0).ok).toBe(true);
    expect(checkRateLimit(key, 1, 1000, t0 + 10).ok).toBe(false);
    expect(checkRateLimit(key, 1, 1000, t0 + 1001).ok).toBe(true);
  });

  it('isolates buckets per key', () => {
    const t0 = 3_000_000;
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(checkRateLimit(a, 1, 60_000, t0).ok).toBe(true);
    expect(checkRateLimit(a, 1, 60_000, t0 + 1).ok).toBe(false);
    expect(checkRateLimit(b, 1, 60_000, t0 + 1).ok).toBe(true);
  });
});
