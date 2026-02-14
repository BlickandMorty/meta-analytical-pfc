import { describe, it, expect } from 'vitest';
import { cn, assertUnreachable, generateUUID } from '@/lib/utils';

describe('cn', () => {
  it('merges tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });
});

describe('generateUUID', () => {
  it('returns a valid UUID v4 string', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('returns unique values', () => {
    const a = generateUUID();
    const b = generateUUID();
    expect(a).not.toBe(b);
  });
});

describe('assertUnreachable', () => {
  it('throws with default message', () => {
    expect(() => assertUnreachable('oops' as never)).toThrow(
      'Unexpected value: "oops"',
    );
  });

  it('throws with custom message', () => {
    expect(() => assertUnreachable(42 as never, 'bad variant')).toThrow(
      'bad variant',
    );
  });
});
