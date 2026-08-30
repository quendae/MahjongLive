import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type { StandardWinningHand, WinningHandBase, WinningMeld } from './context';
import {
  detectDaisangen,
  detectDaisuushii,
  detectShousuushii,
  detectSuuankou,
  detectSuukantsu,
} from './yakumanGroups';

function triplet(tile: Tile, isOpen = false): WinningMeld {
  return {
    type: 'triplet',
    tiles: [tile, { ...tile }, { ...tile }],
    ...(isOpen ? { isOpen: true } : {}),
  };
}

function quad(tile: Tile, isOpen = false): WinningMeld {
  return {
    type: 'quad',
    tiles: [tile, { ...tile }, { ...tile }, { ...tile }],
    ...(isOpen ? { isOpen: true } : {}),
  };
}

function standard(
  melds: WinningMeld[],
  pair: readonly Tile[],
  overrides: Partial<WinningHandBase> = {},
): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  const base: WinningHandBase = {
    allTiles,
    winningTile: pair[1] ?? allTiles[allTiles.length - 1],
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'south',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
  return { ...base, shape: 'standard', melds, pair };
}

describe('Suuankou', () => {
  it('detects four concealed triplet-like groups by Tsumo', () => {
    const hand = standard(
      [
        triplet(suited('man', 2)),
        triplet(suited('pin', 3)),
        quad(suited('sou', 4)),
        triplet(wind('east')),
      ],
      [dragon('white'), dragon('white')],
    );
    expect(detectSuuankou(hand)).toEqual({ name: 'Suuankou', han: 0, yakuman: 1 });
  });

  it('allows Ron when the winning tile completed the pair', () => {
    const pairTile = dragon('white');
    const pair = [pairTile, dragon('white')] as const;
    const hand = standard(
      [
        triplet(suited('man', 2)),
        triplet(suited('pin', 3)),
        triplet(suited('sou', 4)),
        triplet(wind('east')),
      ],
      pair,
      { winningTile: pairTile, winCondition: 'ron' },
    );
    expect(detectSuuankou(hand)).toEqual({ name: 'Suuankou', han: 0, yakuman: 1 });
  });

  it('rejects Ron when the exact winning tile object completed a triplet', () => {
    const winningTile = suited('man', 2);
    const winningTriplet: WinningMeld = {
      type: 'triplet',
      tiles: [suited('man', 2), suited('man', 2), winningTile],
    };
    const hand = standard(
      [
        winningTriplet,
        triplet(suited('pin', 3)),
        triplet(suited('sou', 4)),
        triplet(wind('east')),
      ],
      [dragon('white'), dragon('white')],
      { winningTile, winCondition: 'ron' },
    );
    expect(detectSuuankou(hand)).toBeNull();
  });

  it('rejects an explicitly open triplet', () => {
    const hand = standard(
      [
        triplet(suited('man', 2), true),
        triplet(suited('pin', 3)),
        triplet(suited('sou', 4)),
        triplet(wind('east')),
      ],
      [dragon('white'), dragon('white')],
    );
    expect(detectSuuankou(hand)).toBeNull();
  });
});

describe('group Yakuman', () => {
  it('detects Daisangen with triplets/quads of all three dragons', () => {
    const hand = standard(
      [
        triplet(dragon('white')),
        quad(dragon('green'), true),
        triplet(dragon('red')),
        triplet(suited('man', 5)),
      ],
      [suited('pin', 2), suited('pin', 2)],
    );
    expect(detectDaisangen(hand)).toEqual({ name: 'Daisangen', han: 0, yakuman: 1 });
  });

  it('keeps Shousuushii and Daisuushii mutually exclusive', () => {
    const small = standard(
      [
        triplet(wind('east')),
        triplet(wind('south')),
        triplet(wind('west')),
        triplet(suited('man', 5)),
      ],
      [wind('north'), wind('north')],
    );
    expect(detectShousuushii(small)).toEqual({ name: 'Shousuushii', han: 0, yakuman: 1 });
    expect(detectDaisuushii(small)).toBeNull();

    const big = standard(
      [
        triplet(wind('east')),
        triplet(wind('south')),
        triplet(wind('west')),
        quad(wind('north')),
      ],
      [suited('man', 5), suited('man', 5)],
    );
    expect(detectDaisuushii(big)).toEqual({ name: 'Daisuushii', han: 0, yakuman: 1 });
    expect(detectShousuushii(big)).toBeNull();
  });

  it('detects exactly four quads as Suukantsu', () => {
    const hand = standard(
      [
        quad(suited('man', 2)),
        quad(suited('pin', 3), true),
        quad(suited('sou', 4)),
        quad(wind('east'), true),
      ],
      [dragon('white'), dragon('white')],
    );
    expect(detectSuukantsu(hand)).toEqual({ name: 'Suukantsu', han: 0, yakuman: 1 });
  });
});
