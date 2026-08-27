import { describe, it, expect } from 'vitest';
import { detectPinfu, detectIipeikou } from './pinfuIipeikou';
import { suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(
  melds: Meld[],
  pair: Tile[],
  winningTile: Tile,
  overrides: Partial<StandardWinningHand> = {},
): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair,
    winningTile,
    winCondition: 'tsumo',
    seatWind: 'south',
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

describe('detectPinfu', () => {
  it('awards 1 han for four sequences, a non-value pair, and a two-sided wait', () => {
    const winningTile = suited('man', 4); // run 4-5-6, won on the low end (held 5,6 -> waits 4 or 7)
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] },
      { type: 'sequence', tiles: [suited('pin', 1), suited('pin', 2), suited('pin', 3)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
    ];
    const pair = [suited('sou', 2), suited('sou', 2)];
    expect(detectPinfu(standardHand(melds, pair, winningTile))).toEqual({ name: 'Pinfu', han: 1 });
  });

  it('awards 1 han for a 1-2-3 run won on the 1 (held 2,3 -> waits 1 or 4, still two-sided)', () => {
    const winningTile = suited('man', 1);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [suited('pin', 1), suited('pin', 2), suited('pin', 3)] },
      { type: 'sequence', tiles: [suited('pin', 4), suited('pin', 5), suited('pin', 6)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
    ];
    const pair = [suited('sou', 2), suited('sou', 2)];
    expect(detectPinfu(standardHand(melds, pair, winningTile))).toEqual({ name: 'Pinfu', han: 1 });
  });

  it('awards 1 han for a 7-8-9 run won on the 9 (held 7,8 -> waits 6 or 9, still two-sided)', () => {
    const winningTile = suited('man', 9);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 7), suited('man', 8), winningTile] },
      { type: 'sequence', tiles: [suited('pin', 1), suited('pin', 2), suited('pin', 3)] },
      { type: 'sequence', tiles: [suited('pin', 4), suited('pin', 5), suited('pin', 6)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
    ];
    const pair = [suited('sou', 2), suited('sou', 2)];
    expect(detectPinfu(standardHand(melds, pair, winningTile))).toEqual({ name: 'Pinfu', han: 1 });
  });

  it('is absent when any meld is a triplet', () => {
    const winningTile = suited('man', 4);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] },
      { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] },
    ];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent when the pair is a value tile', () => {
    const winningTile = suited('man', 4);
    const melds: Meld[] = [{ type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] }];
    const pair = [wind('east'), wind('east')]; // round wind, and this hand's roundWind is 'east'
    expect(detectPinfu(standardHand(melds, pair, winningTile))).toBeNull();
  });

  it('is absent for a kanchan (closed gap) wait', () => {
    const winningTile = suited('man', 5); // run 4-5-6, won on the middle tile
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), winningTile, suited('man', 6)] }];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent for a penchan (edge) wait on 1-2-3 won on the 3', () => {
    const winningTile = suited('man', 3);
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 1), suited('man', 2), winningTile] }];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent for a penchan (edge) wait on 7-8-9 won on the 7', () => {
    const winningTile = suited('man', 7);
    const melds: Meld[] = [{ type: 'sequence', tiles: [winningTile, suited('man', 8), suited('man', 9)] }];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent for a chiitoitsu-shaped hand', () => {
    const hand = {
      shape: 'chiitoitsu' as const,
      allTiles: [],
      winningTile: suited('man', 4),
      winCondition: 'tsumo' as const,
      seatWind: 'south' as const,
      roundWind: 'east' as const,
      isRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      isHoutei: false,
      isRinshan: false,
      isChankan: false,
    };
    expect(detectPinfu(hand)).toBeNull();
  });
});

describe('detectIipeikou', () => {
  it('awards 1 han for two identical sequences', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
    ];
    expect(detectIipeikou(standardHand(melds, [suited('sou', 2), suited('sou', 2)], suited('man', 2)))).toEqual({
      name: 'Iipeikou',
      han: 1,
    });
  });

  it('is absent when all sequences are distinct', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
      { type: 'sequence', tiles: [suited('pin', 2), suited('pin', 3), suited('pin', 4)] },
    ];
    expect(detectIipeikou(standardHand(melds, [suited('sou', 2), suited('sou', 2)], suited('man', 2)))).toBeNull();
  });

  it('is absent when the matching melds are triplets, not sequences', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('man', 2), suited('man', 2), suited('man', 2)] },
    ];
    expect(detectIipeikou(standardHand(melds, [suited('sou', 2), suited('sou', 2)], suited('man', 2)))).toBeNull();
  });
});
