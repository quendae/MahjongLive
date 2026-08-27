import { describe, it, expect } from 'vitest';
import { detectChiitoitsu, detectTanyao } from './chiitoitsuTanyao';
import { suited, wind } from '../tiles/tiles';
import type { ChiitoitsuWinningHand, StandardWinningHand } from './context';
import type { Tile } from '../tiles/types';

function chiitoitsuHand(allTiles: Tile[]): ChiitoitsuWinningHand {
  return {
    shape: 'chiitoitsu',
    allTiles,
    winningTile: allTiles[0],
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

function standardHand(allTiles: Tile[]): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles,
    melds: [],
    pair: [suited('sou', 2), suited('sou', 2)],
    winningTile: allTiles[0],
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

describe('detectChiitoitsu', () => {
  it('awards 2 han for a chiitoitsu-shaped hand', () => {
    expect(detectChiitoitsu(chiitoitsuHand([suited('man', 1)]))).toEqual({ name: 'Chiitoitsu', han: 2 });
  });

  it('is absent for a standard-shaped hand', () => {
    expect(detectChiitoitsu(standardHand([suited('man', 1)]))).toBeNull();
  });
});

describe('detectTanyao', () => {
  it('awards 1 han when every tile is a simple (no terminals or honors)', () => {
    const tiles = [suited('man', 2), suited('man', 3), suited('man', 4), suited('pin', 5), suited('pin', 5)];
    expect(detectTanyao(standardHand(tiles))).toEqual({ name: 'Tanyao', han: 1 });
  });

  it('is absent when a terminal is present', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3)];
    expect(detectTanyao(standardHand(tiles))).toBeNull();
  });

  it('is absent when an honor is present', () => {
    const tiles = [wind('east'), suited('man', 2), suited('man', 3)];
    expect(detectTanyao(standardHand(tiles))).toBeNull();
  });

  it('applies equally to a chiitoitsu-shaped hand made of all simples', () => {
    const tiles = [suited('man', 2), suited('man', 2), suited('pin', 5), suited('pin', 5)];
    expect(detectTanyao(chiitoitsuHand(tiles))).toEqual({ name: 'Tanyao', han: 1 });
  });
});
