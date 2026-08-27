import { describe, it, expect } from 'vitest';
import { meldContainingTile, isConcealedMeld, isYakuhaiTile } from './context';
import { suited, wind, dragon } from '../tiles/tiles';
import { Meld } from '../hand/decompose';
import type { StandardWinningHand, WinningHandBase } from './context';

function baseContext(overrides: Partial<WinningHandBase> = {}): WinningHandBase {
  return {
    allTiles: [],
    winningTile: suited('man', 5),
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
}

describe('meldContainingTile', () => {
  it('finds the meld holding a specific tile instance', () => {
    // The exact winningTile instance must be one of a meld's tiles by reference, as a real
    // decomposition would produce (decomposeStandardHand shares references with its input) — so
    // it's built into the sequence literal here rather than assigned after construction.
    const winningTile = suited('man', 5);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] },
      { type: 'sequence', tiles: [suited('man', 4), winningTile, suited('man', 6)] },
    ];
    expect(meldContainingTile(melds, winningTile)).toBe(melds[1]);
  });

  it('returns undefined when no meld contains the tile', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] },
    ];
    expect(meldContainingTile(melds, suited('sou', 9))).toBeUndefined();
  });
});

describe('isConcealedMeld', () => {
  it('treats a triplet not touching the winning tile as concealed', () => {
    const winningTile = suited('man', 6);
    const triplet: Meld = { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] };
    const hand: StandardWinningHand = {
      ...baseContext({ winningTile, winCondition: 'ron' }),
      shape: 'standard',
      melds: [triplet],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(triplet, hand)).toBe(true);
  });

  it('treats a triplet completed by Ron on the winning tile as NOT concealed (shanpon exception)', () => {
    const winningTile = suited('pin', 1);
    const triplet: Meld = { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), winningTile] };
    const hand: StandardWinningHand = {
      ...baseContext({ winningTile, winCondition: 'ron' }),
      shape: 'standard',
      melds: [triplet],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(triplet, hand)).toBe(false);
  });

  it('treats a triplet completed by Tsumo on the winning tile as still concealed', () => {
    const winningTile = suited('pin', 1);
    const triplet: Meld = { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), winningTile] };
    const hand: StandardWinningHand = {
      ...baseContext({ winningTile, winCondition: 'tsumo' }),
      shape: 'standard',
      melds: [triplet],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(triplet, hand)).toBe(true);
  });

  it('never counts a sequence as a concealed-triplet contributor', () => {
    const sequence: Meld = { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] };
    const hand: StandardWinningHand = {
      ...baseContext(),
      shape: 'standard',
      melds: [sequence],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(sequence, hand)).toBe(false);
  });
});

describe('isYakuhaiTile', () => {
  it('treats any dragon as a yakuhai tile', () => {
    expect(isYakuhaiTile(dragon('white'), baseContext())).toBe(true);
  });

  it('treats the seat wind as a yakuhai tile', () => {
    expect(isYakuhaiTile(wind('south'), baseContext({ seatWind: 'south', roundWind: 'east' }))).toBe(true);
  });

  it('treats the round wind as a yakuhai tile', () => {
    expect(isYakuhaiTile(wind('east'), baseContext({ seatWind: 'south', roundWind: 'east' }))).toBe(true);
  });

  it('rejects a non-seat, non-round wind', () => {
    expect(isYakuhaiTile(wind('north'), baseContext({ seatWind: 'south', roundWind: 'east' }))).toBe(false);
  });

  it('rejects suited tiles', () => {
    expect(isYakuhaiTile(suited('man', 1), baseContext())).toBe(false);
  });
});
