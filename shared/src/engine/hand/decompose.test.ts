import { describe, it, expect } from 'vitest';
import { decomposeMelds, decomposeStandardHand } from './decompose';
import { suited, wind, tileTypeKey } from '../tiles/tiles';

describe('decomposeMelds', () => {
  it('decomposes a single triplet', () => {
    const results = decomposeMelds([suited('man', 5), suited('man', 5), suited('man', 5)]);
    expect(results).toHaveLength(1);
    expect(results[0][0].type).toBe('triplet');
  });

  it('decomposes a single sequence', () => {
    const results = decomposeMelds([suited('man', 3), suited('man', 4), suited('man', 5)]);
    expect(results).toHaveLength(1);
    expect(results[0][0].type).toBe('sequence');
  });

  it('decomposes two non-overlapping sequences with only one valid reading', () => {
    const tiles = [
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('man', 7), suited('man', 8), suited('man', 9),
    ];
    const results = decomposeMelds(tiles);
    expect(results).toHaveLength(1);
    expect(results[0].every((m) => m.type === 'sequence')).toBe(true);
  });

  it('finds both readings of the classic 555666777 ambiguous shape (triplets vs. three sequences)', () => {
    const tiles = [
      suited('man', 5), suited('man', 5), suited('man', 5),
      suited('man', 6), suited('man', 6), suited('man', 6),
      suited('man', 7), suited('man', 7), suited('man', 7),
    ];
    const results = decomposeMelds(tiles);
    expect(results).toHaveLength(2);
    const asTriplets = results.some((r) => r.every((m) => m.type === 'triplet'));
    const asSequences = results.some((r) => r.every((m) => m.type === 'sequence'));
    expect(asTriplets).toBe(true);
    expect(asSequences).toBe(true);
  });

  // Regression: when a tile type is read as BOTH a triplet and a sequence-starter in the same
  // decomposition (needs 4 copies, which is legal), a naive "put the lowest tile in a triplet, or
  // in a sequence" branch reaches the identical decomposition down both branches and reports it
  // twice. 2222s + 3s4s has exactly one reading: 222s / 234s / 567s / 789s.
  it('does not double-count a reading that uses one tile type as both a triplet and a sequence', () => {
    const tiles = [
      suited('sou', 2), suited('sou', 2), suited('sou', 2), suited('sou', 2),
      suited('sou', 3), suited('sou', 4),
      suited('sou', 5), suited('sou', 6), suited('sou', 7),
      suited('sou', 7), suited('sou', 8), suited('sou', 9),
    ];
    const results = decomposeMelds(tiles);
    expect(results).toHaveLength(1);
    expect(results[0].filter((m) => m.type === 'triplet')).toHaveLength(1);
    expect(results[0].filter((m) => m.type === 'sequence')).toHaveLength(3);
  });

  it('returns no decomposition for an invalid group', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('pin', 3)];
    expect(decomposeMelds(tiles)).toEqual([]);
  });

  it('returns an empty array when tile count is not a multiple of three', () => {
    expect(decomposeMelds([suited('man', 1), suited('man', 2)])).toEqual([]);
  });

  it('returns a single empty decomposition for zero tiles', () => {
    expect(decomposeMelds([])).toEqual([[]]);
  });
});

describe('decomposeStandardHand', () => {
  it('decomposes a complete 14-tile hand into 4 melds + 1 pair', () => {
    const tiles = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('pin', 7), suited('pin', 8), suited('pin', 9),
      suited('sou', 2), suited('sou', 2), suited('sou', 2),
      wind('east'), wind('east'),
    ];
    const results = decomposeStandardHand(tiles);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.pair).toHaveLength(2);
      expect(r.melds).toHaveLength(4);
    }
  });

  it('returns an empty array for a hand with no valid decomposition', () => {
    const tiles = [
      suited('man', 1), suited('man', 2), suited('man', 4),
      suited('pin', 1), suited('pin', 2), suited('pin', 4),
      suited('sou', 1), suited('sou', 2), suited('sou', 4),
      wind('east'), wind('south'), wind('west'), wind('north'), wind('north'),
    ];
    expect(decomposeStandardHand(tiles)).toEqual([]);
  });

  it('finds two decompositions when the only valid pair leaves an ambiguous meld run', () => {
    const tiles = [
      suited('man', 5), suited('man', 5), suited('man', 5),
      suited('man', 6), suited('man', 6), suited('man', 6),
      suited('man', 7), suited('man', 7), suited('man', 7),
      suited('pin', 1), suited('pin', 1), suited('pin', 1),
      wind('east'), wind('east'),
    ];
    const results = decomposeStandardHand(tiles);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.pair[0].kind).toBe('honor');
    }
  });

  // Regression, full-hand form of the same double-count: 5555p is read as 555p + 555p6p7p, so the
  // pin5 type leads both a triplet and a sequence. Only one reading exists: 77m pair, then
  // 555m / 555p / 567p / 333s.
  it('does not double-count a 14-tile reading that uses a type as both triplet and sequence', () => {
    const tiles = [
      suited('man', 5), suited('man', 5), suited('man', 5),
      suited('man', 7), suited('man', 7),
      suited('pin', 5), suited('pin', 5), suited('pin', 5), suited('pin', 5),
      suited('pin', 6), suited('pin', 7),
      suited('sou', 3), suited('sou', 3), suited('sou', 3),
    ];
    const results = decomposeStandardHand(tiles);
    expect(results).toHaveLength(1);
    expect(results[0].pair.map((t) => tileTypeKey(t))).toEqual(['man7', 'man7']);
    expect(results[0].melds.map((m) => m.type).sort()).toEqual([
      'sequence', 'triplet', 'triplet', 'triplet',
    ]);
  });
});
