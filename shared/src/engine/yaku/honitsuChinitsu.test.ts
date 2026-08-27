import { describe, it, expect } from 'vitest';
import { detectHonitsu, detectChinitsu } from './honitsuChinitsu';
import { suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type { StandardWinningHand } from './context';

function standardHand(allTiles: Tile[]): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles,
    melds: [],
    pair: [],
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

describe('detectHonitsu', () => {
  it('awards 3 han for one suit plus honors', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3), wind('east'), wind('east')];
    expect(detectHonitsu(standardHand(tiles))).toEqual({ name: 'Honitsu', han: 3 });
  });

  it('is absent when two suits are present', () => {
    const tiles = [suited('man', 1), suited('pin', 2), wind('east')];
    expect(detectHonitsu(standardHand(tiles))).toBeNull();
  });

  it('is absent for a pure one-suit hand with no honors (that is Chinitsu instead)', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3)];
    expect(detectHonitsu(standardHand(tiles))).toBeNull();
  });
});

describe('detectChinitsu', () => {
  it('awards 6 han for tiles from one suit only, no honors', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3)];
    expect(detectChinitsu(standardHand(tiles))).toEqual({ name: 'Chinitsu', han: 6 });
  });

  it('is absent when any honor is present', () => {
    const tiles = [suited('man', 1), suited('man', 2), wind('east')];
    expect(detectChinitsu(standardHand(tiles))).toBeNull();
  });

  it('is absent when two suits are present', () => {
    const tiles = [suited('man', 1), suited('pin', 2)];
    expect(detectChinitsu(standardHand(tiles))).toBeNull();
  });
});
