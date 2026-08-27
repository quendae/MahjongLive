import { describe, it, expect } from 'vitest';
import { detectYakuhai } from './yakuhai';
import { suited, wind, dragon } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[], overrides: Partial<StandardWinningHand> = {}): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair: [suited('sou', 2), suited('sou', 2)],
    winningTile: suited('sou', 2),
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

describe('detectYakuhai', () => {
  it('awards 1 han for a single dragon triplet', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [dragon('white'), dragon('white'), dragon('white')] }];
    expect(detectYakuhai(standardHand(melds))?.han).toBe(1);
  });

  it('awards 1 han for a seat-wind triplet', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('south'), wind('south'), wind('south')] }];
    expect(detectYakuhai(standardHand(melds, { seatWind: 'south', roundWind: 'east' }))?.han).toBe(1);
  });

  it('awards 2 han for the dealer holding a triplet of the round/seat wind (East-East)', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('east'), wind('east'), wind('east')] }];
    expect(detectYakuhai(standardHand(melds, { seatWind: 'east', roundWind: 'east' }))?.han).toBe(2);
  });

  it('sums han across two different qualifying triplets', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [dragon('white'), dragon('white'), dragon('white')] },
      { type: 'triplet', tiles: [dragon('red'), dragon('red'), dragon('red')] },
    ];
    expect(detectYakuhai(standardHand(melds))?.han).toBe(2);
  });

  it('is absent when no triplet is a value tile', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('north'), wind('north'), wind('north')] }];
    expect(detectYakuhai(standardHand(melds, { seatWind: 'south', roundWind: 'east' }))).toBeNull();
  });

  it('ignores sequences entirely', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] }];
    expect(detectYakuhai(standardHand(melds))).toBeNull();
  });

  it('is absent for a chiitoitsu-shaped hand (no melds to check)', () => {
    const hand = {
      shape: 'chiitoitsu' as const,
      allTiles: [dragon('white'), dragon('white')],
      winningTile: dragon('white'),
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
    expect(detectYakuhai(hand)).toBeNull();
  });
});
