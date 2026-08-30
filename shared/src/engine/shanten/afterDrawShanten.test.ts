import { describe, expect, it } from 'vitest';
import { structuralShanten, structuralShantenAfterDraw } from './shanten';
import { suited } from '../tiles/tiles';
import type { SuitRank, Tile } from '../tiles/types';

const m = (rank: SuitRank) => suited('man', rank);
const p = (rank: SuitRank) => suited('pin', rank);
const s = (rank: SuitRank) => suited('sou', rank);

function tiles(...groups: Tile[][]): Tile[] {
  return groups.flat();
}

const seq = (factory: (rank: SuitRank) => Tile, a: SuitRank, b: SuitRank, c: SuitRank) => [
  factory(a), factory(b), factory(c),
];

describe('structuralShantenAfterDraw', () => {
  it('returns -1 when a closed tenpai hand draws its winning tile', () => {
    const tenpai = tiles(
      seq(m, 1, 2, 3),
      seq(p, 1, 2, 3),
      seq(s, 1, 2, 3),
      seq(s, 4, 5, 6),
      [p(7)],
    );
    expect(structuralShanten(tenpai)).toBe(0);
    expect(structuralShantenAfterDraw([...tenpai, p(7)])).toBe(-1);
  });

  it('recognizes a draw that improves one-shanten to tenpai', () => {
    const oneShanten = tiles(
      seq(m, 1, 2, 3),
      seq(p, 1, 2, 3),
      seq(s, 1, 2, 3),
      [s(4), s(5)],
      [p(7), p(8)],
    );
    expect(structuralShanten(oneShanten)).toBe(1);
    expect(structuralShantenAfterDraw([...oneShanten, p(7)])).toBe(0);
  });

  it('works with a fixed open meld removed from the concealed remainder', () => {
    const tenpai = tiles(
      seq(m, 1, 2, 3),
      seq(p, 1, 2, 3),
      seq(s, 4, 5, 6),
      [p(7)],
    );
    expect(tenpai).toHaveLength(10);
    expect(structuralShanten(tenpai, 1)).toBe(0);
    expect(structuralShantenAfterDraw([...tenpai, p(7)], 1)).toBe(-1);
  });
});
