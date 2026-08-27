import { describe, it, expect } from 'vitest';
import { detectSanshokuDoujun, detectIttsuu } from './sanshokuIttsuu';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[]): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair: [suited('sou', 9), suited('sou', 9)],
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

describe('detectSanshokuDoujun', () => {
  it('awards 2 han for the same sequence in all three suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 3), suited('man', 4), suited('man', 5)] },
      { type: 'sequence', tiles: [suited('pin', 3), suited('pin', 4), suited('pin', 5)] },
      { type: 'sequence', tiles: [suited('sou', 3), suited('sou', 4), suited('sou', 5)] },
    ];
    expect(detectSanshokuDoujun(standardHand(melds))).toEqual({ name: 'Sanshoku Doujun', han: 2 });
  });

  it('is absent when the matching sequence spans only two suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 3), suited('man', 4), suited('man', 5)] },
      { type: 'sequence', tiles: [suited('pin', 3), suited('pin', 4), suited('pin', 5)] },
    ];
    expect(detectSanshokuDoujun(standardHand(melds))).toBeNull();
  });

  it('is absent when the ranks do not line up across suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 3), suited('man', 4), suited('man', 5)] },
      { type: 'sequence', tiles: [suited('pin', 4), suited('pin', 5), suited('pin', 6)] },
      { type: 'sequence', tiles: [suited('sou', 3), suited('sou', 4), suited('sou', 5)] },
    ];
    expect(detectSanshokuDoujun(standardHand(melds))).toBeNull();
  });
});

describe('detectIttsuu', () => {
  it('awards 2 han for 1-9 straight in one suit', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
      { type: 'sequence', tiles: [suited('man', 7), suited('man', 8), suited('man', 9)] },
    ];
    expect(detectIttsuu(standardHand(melds))).toEqual({ name: 'Ittsuu', han: 2 });
  });

  it('is absent when the three runs span different suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [suited('pin', 4), suited('pin', 5), suited('pin', 6)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
    ];
    expect(detectIttsuu(standardHand(melds))).toBeNull();
  });

  it('is absent when a needed run is missing', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [suited('man', 7), suited('man', 8), suited('man', 9)] },
    ];
    expect(detectIttsuu(standardHand(melds))).toBeNull();
  });
});
