import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, getSessionKey } from './idempotency.utils';

describe('generateIdempotencyKey', () => {
  it('returns a non-empty string', () => {
    const key = generateIdempotencyKey('abc-defg-hij', 1700000000000);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('returns the same key for the same inputs', () => {
    const key1 = generateIdempotencyKey('abc-defg-hij', 1700000000000);
    const key2 = generateIdempotencyKey('abc-defg-hij', 1700000000000);
    expect(key1).toBe(key2);
  });

  it('returns different keys for different meeting IDs', () => {
    const key1 = generateIdempotencyKey('abc-defg-hij', 1700000000000);
    const key2 = generateIdempotencyKey('xyz-wxyz-abc', 1700000000000);
    expect(key1).not.toBe(key2);
  });
});

describe('getSessionKey', () => {
  it('includes the meeting ID', () => {
    const key = getSessionKey('abc-defg-hij');
    expect(key).toContain('abc-defg-hij');
  });

  it('starts with the chirpy prefix', () => {
    const key = getSessionKey('test-meeting');
    expect(key.startsWith('chirpy-session-')).toBe(true);
  });
});
