import { describe, it, expect } from 'vitest';
import { createRNG } from './prng';

describe('createRNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRNG(42);
    const b = createRNG(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces a different first value for a different seed', () => {
    const a = createRNG(1);
    const b = createRNG(2);
    expect(a()).not.toBe(b());
  });

  it('produces values in the [0, 1) range', () => {
    const rng = createRNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
