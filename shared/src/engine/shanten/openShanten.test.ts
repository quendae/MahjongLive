import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { standardShantenWithFixedMelds, structuralShanten } from './shanten';

const m = (rank: 1|2|3|4|5|6|7|8|9) => suited('man', rank);
const p = (rank: 1|2|3|4|5|6|7|8|9) => suited('pin', rank);
const s = (rank: 1|2|3|4|5|6|7|8|9) => suited('sou', rank);

function tiles(...values: Tile[]): Tile[] {
  return values;
}

describe('fixed-meld shanten', () => {
  it('recognises tenpai with one fixed meld', () => {
    // Fixed meld + 123m 456p 789s 55m, waiting on 5m pair completion from 10 concealed tiles.
    const hand = tiles(m(1), m(2), m(3), p(4), p(5), p(6), s(7), s(8), s(9), m(5));
    expect(standardShantenWithFixedMelds(hand, 1)).toBe(0);
    expect(structuralShanten(hand, 1)).toBe(0);
  });

  it('handles two and three fixed melds', () => {
    const twoFixed = tiles(m(1), m(2), m(3), p(4), p(5), p(6), s(9));
    expect(structuralShanten(twoFixed, 2)).toBe(0);

    const threeFixed = tiles(m(1), m(2), m(3), dragon('red'));
    expect(structuralShanten(threeFixed, 3)).toBe(0);
  });

  it('handles four fixed melds as a pair-only concealed remainder', () => {
    expect(structuralShanten([wind('east')], 4)).toBe(0);
  });

  it('keeps special closed shapes available only before calls', () => {
    const chiitoiTenpai = tiles(
      m(1), m(1), m(2), m(2), p(3), p(3), p(4), p(4), s(5), s(5),
      s(6), s(6), wind('east'),
    );
    expect(structuralShanten(chiitoiTenpai, 0)).toBe(0);
  });

  it('rejects impossible concealed sizes for the fixed meld count', () => {
    expect(() => structuralShanten([m(1), m(2)], 1)).toThrow(/10 concealed tiles/);
    expect(() => structuralShanten(Array.from({ length: 13 }, () => m(1)), 5)).toThrow(/between 0 and 4/);
  });
});
