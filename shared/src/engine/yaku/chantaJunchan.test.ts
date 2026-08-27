import { describe, it, expect } from 'vitest';
import { detectChanta, detectJunchan } from './chantaJunchan';
import { suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type { StandardWinningHand, ChiitoitsuWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[], pair: Tile[]): StandardWinningHand {
  // allTiles is derived from melds+pair (not hardcoded) because detectJunchan reads allTiles
  // directly to check for honors — a fixture that doesn't reflect the melds would let that check
  // silently pass for the wrong reason.
  const allTiles = [...melds.flatMap((m) => m.tiles), ...pair];
  return {
    shape: 'standard',
    allTiles,
    melds,
    pair,
    winningTile: suited('man', 1),
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

function chiitoitsuHand(allTiles: Tile[]): ChiitoitsuWinningHand {
  return {
    shape: 'chiitoitsu',
    allTiles,
    winningTile: allTiles[0],
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

describe('detectChanta', () => {
  it('awards 2 han when every meld and the pair contain a terminal or honor', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'triplet', tiles: [wind('east'), wind('east'), wind('east')] },
    ];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectChanta(standardHand(melds, pair))).toEqual({ name: 'Chanta', han: 2 });
  });

  it('is absent when one meld has no terminal or honor', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectChanta(standardHand(melds, pair))).toBeNull();
  });

  it('is absent when the pair has no terminal or honor', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] }];
    const pair = [suited('pin', 5), suited('pin', 5)];
    expect(detectChanta(standardHand(melds, pair))).toBeNull();
  });

  it('is absent for a chiitoitsu-shaped hand (Chiitoitsu is scored on its own, never stacked with Chanta)', () => {
    // These pairs all contain a terminal or honor, so the hand structurally "looks like" it
    // should satisfy Chanta's rule — but Chanta is defined over "every meld and the pair", a
    // structure Chiitoitsu does not have, so the shape gate correctly returns null.
    const tiles = [suited('man', 1), suited('man', 1), wind('east'), wind('east')];
    expect(detectChanta(chiitoitsuHand(tiles))).toBeNull();
  });
});

describe('detectJunchan', () => {
  it('awards 3 han when every meld and the pair contain a terminal, and no honors are present', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectJunchan(standardHand(melds, pair))).toEqual({ name: 'Junchan', han: 3 });
  });

  it('is absent when an honor tile is present (that would be Chanta, not Junchan)', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('east'), wind('east'), wind('east')] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectJunchan(standardHand(melds, pair))).toBeNull();
  });

  it('is absent when a meld has no terminal', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectJunchan(standardHand(melds, pair))).toBeNull();
  });
});
