import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand, WinningHandBase, WinningMeld } from './context';
import { isClosedHand, isConcealedMeld, isTripletLike } from './context';

function base(overrides: Partial<WinningHandBase> = {}): WinningHandBase {
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

function standard(melds: WinningMeld[], overrides: Partial<WinningHandBase> = {}): StandardWinningHand {
  return {
    ...base(overrides),
    shape: 'standard',
    melds,
    pair: [suited('pin', 2), suited('pin', 2)],
  };
}

describe('Plan 3 winning context', () => {
  it('treats legacy melds without isOpen as concealed', () => {
    const hand = standard([
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
    ]);
    expect(isClosedHand(hand)).toBe(true);
  });

  it('detects an explicitly open standard hand', () => {
    const hand = standard([
      {
        type: 'sequence',
        tiles: [suited('man', 1), suited('man', 2), suited('man', 3)],
        isOpen: true,
      },
    ]);
    expect(isClosedHand(hand)).toBe(false);
  });

  it('treats quads as triplet-like', () => {
    const quad: WinningMeld = {
      type: 'quad',
      tiles: [suited('sou', 8), suited('sou', 8), suited('sou', 8), suited('sou', 8)],
    };
    expect(isTripletLike(quad)).toBe(true);
  });

  it('counts a concealed quad as concealed', () => {
    const quad: WinningMeld = {
      type: 'quad',
      tiles: [suited('sou', 8), suited('sou', 8), suited('sou', 8), suited('sou', 8)],
    };
    const hand = standard([quad]);
    expect(isConcealedMeld(quad, hand)).toBe(true);
  });

  it('never counts an open quad as concealed', () => {
    const quad: WinningMeld = {
      type: 'quad',
      tiles: [suited('sou', 8), suited('sou', 8), suited('sou', 8), suited('sou', 8)],
      isOpen: true,
    };
    const hand = standard([quad]);
    expect(isConcealedMeld(quad, hand)).toBe(false);
  });
});
