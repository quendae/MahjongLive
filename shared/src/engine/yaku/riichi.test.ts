import { describe, it, expect } from 'vitest';
import { detectRiichi, detectIppatsu, detectMenzenTsumo } from './riichi';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand } from './context';

function hand(overrides: Partial<StandardWinningHand>): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds: [],
    pair: [suited('sou', 2), suited('sou', 2)],
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

describe('detectRiichi', () => {
  it('awards 1 han when Riichi was declared', () => {
    expect(detectRiichi(hand({ isRiichi: true }))).toEqual({ name: 'Riichi', han: 1 });
  });

  it('is absent without Riichi', () => {
    expect(detectRiichi(hand({ isRiichi: false }))).toBeNull();
  });
});

describe('detectIppatsu', () => {
  it('awards 1 han when Ippatsu applies', () => {
    expect(detectIppatsu(hand({ isRiichi: true, isIppatsu: true }))).toEqual({ name: 'Ippatsu', han: 1 });
  });

  it('is absent without Ippatsu, even under Riichi', () => {
    expect(detectIppatsu(hand({ isRiichi: true, isIppatsu: false }))).toBeNull();
  });
});

describe('detectMenzenTsumo', () => {
  it('awards 1 han for a self-draw win', () => {
    expect(detectMenzenTsumo(hand({ winCondition: 'tsumo' }))).toEqual({ name: 'Menzen Tsumo', han: 1 });
  });

  it('is absent for a Ron win', () => {
    expect(detectMenzenTsumo(hand({ winCondition: 'ron' }))).toBeNull();
  });
});
