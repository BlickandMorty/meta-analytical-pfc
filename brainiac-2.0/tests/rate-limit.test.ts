import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows requests under the limit', () => {
    const result = checkRateLimit('test-ip', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('tracks remaining count', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('test-ip', 5, 60_000);
    }
    const result = checkRateLimit('test-ip', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('blocks after exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-ip', 5, 60_000);
    }
    const result = checkRateLimit('test-ip', 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBeGreaterThan(0);
  });

  it('isolates different keys', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('ip-a', 5, 60_000);
    }
    // Different key should still be allowed
    const result = checkRateLimit('ip-b', 5, 60_000);
    expect(result.allowed).toBe(true);
  });

  it('resets after window expires', () => {
    // Use a very short window
    for (let i = 0; i < 3; i++) {
      checkRateLimit('test-ip', 3, 1); // 1ms window
    }
    // Wait for window to expire
    const now = Date.now();
    while (Date.now() - now < 5) { /* busy wait 5ms */ }

    const result = checkRateLimit('test-ip', 3, 1);
    expect(result.allowed).toBe(true);
  });

  it('resetRateLimits clears all state', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-ip', 5, 60_000);
    }
    resetRateLimits();
    const result = checkRateLimit('test-ip', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
