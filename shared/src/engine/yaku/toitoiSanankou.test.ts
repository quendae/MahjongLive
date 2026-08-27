import { describe, it, expect } from 'vitest';
import { detectToitoi, detectSanankou } from './toitoiSanankou';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[], overrides: Partial<StandardWinningHand> = {}): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair: [suited('sou', 2), suited('sou', 2)],
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
    ...overrides,
  };
}

describe('detectToitoi', () => {
  it('awards 2 han when all four melds are triplets', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('man', 1), suited('man', 1), suited('man', 1)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'triplet', tiles: [suited('sou', 9), suited('sou', 9), suited('sou', 9)] },
      { type: 'triplet', tiles: [suited('man', 7), suited('man', 7), suited('man', 7)] },
    ];
    expect(detectToitoi(standardHand(melds))).toEqual({ name: 'Toitoi', han: 2 });
  });

  it('is absent when any meld is a sequence', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
    ];
    expect(detectToitoi(standardHand(melds))).toBeNull();
  });

  it('is absent for a chiitoitsu-shaped hand', () => {
    const hand = {
      shape: 'chiitoitsu' as const,
      allTiles: [],
      winningTile: suited('man', 1),
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
    expect(detectToitoi(hand)).toBeNull();
  });
});

describe('detectSanankou', () => {
  it('awards 2 han for three concealed triplets, won by Tsumo', () => {
    const winningTile = suited('man', 1);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [winningTile, suited('man', 1), suited('man', 1)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'triplet', tiles: [suited('sou', 9), suited('sou', 9), suited('sou', 9)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
    ];
    expect(detectSanankou(standardHand(melds, { winningTile, winCondition: 'tsumo' }))).toEqual({
      name: 'Sanankou',
      han: 2,
    });
  });

  it('is absent when the winning Ron tile completes one of the three triplets (shanpon exception)', () => {
    const winningTile = suited('man', 1);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('man', 1), suited('man', 1), winningTile] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'triplet', tiles: [suited('sou', 9), suited('sou', 9), suited('sou', 9)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
    ];
    expect(detectSanankou(standardHand(melds, { winningTile, winCondition: 'ron' }))).toBeNull();
  });

  it('is absent with only two concealed triplets', () => {
    const winningTile = suited('man', 1);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [winningTile, suited('man', 1), suited('man', 1)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
    ];
    expect(detectSanankou(standardHand(melds, { winningTile, winCondition: 'tsumo' }))).toBeNull();
  });
});
