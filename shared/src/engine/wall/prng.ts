export type RNG = () => number;

/**
 * Mulberry32 — small, fast, deterministic PRNG. Used for wall shuffling so
 * games can be seeded and replayed for tests/debugging.
 */
export function createRNG(seed: number): RNG {
  let state = seed >>> 0;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
