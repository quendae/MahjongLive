import { describe, expect, it } from 'vitest';
import { dragon, suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type { StandardWinningHand, WinningHandBase, WinningMeld } from './context';
import { detectToitoi, detectSanankou } from './toitoiSanankou';
import { detectYakuhai } from './yakuhai';

function triplet(tile: Tile): WinningMeld {
  return { type: 'triplet', tiles: [tile, { ...tile }, { ...tile }] };
}

function quad(tile: Tile, isOpen = false): WinningMeld {
  return {
    type: 'quad',
    tiles: [tile, { ...tile }, { ...tile }, { ...tile }],
    ...(isOpen ? { isOpen: true } : {}),
  };
}

function hand(melds: WinningMeld[], pair: readonly Tile[]): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  const base: WinningHandBase = {
    allTiles,
    winningTile: pair[0],
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'south',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
  return { ...base, shape: 'standard', melds, pair };
}

describe('Plan 2 yaku remain correct with quads', () => {
  it('counts a dragon quad as Yakuhai', () => {
    const value = hand(
      [
        quad(dragon('green'), true),
        triplet(suited('man', 2)),
        triplet(suited('pin', 3)),
        triplet(suited('sou', 4)),
      ],
      [suited('man', 5), suited('man', 5)],
    );
    expect(detectYakuhai(value)).toEqual({ name: 'Yakuhai', han: 1 });
  });

  it('treats quads as triplet-like for Toitoi', () => {
    const value = hand(
      [
        quad(suited('man', 2), true),
        triplet(suited('pin', 3)),
        quad(suited('sou', 4)),
        triplet(dragon('white')),
      ],
      [suited('man', 5), suited('man', 5)],
    );
    expect(detectToitoi(value)).toEqual({ name: 'Toitoi', han: 2 });
  });

  it('counts concealed quads toward Sanankou but excludes an open quad', () => {
    const concealed = hand(
      [
        quad(suited('man', 2)),
        quad(suited('pin', 3)),
        triplet(suited('sou', 4)),
        { type: 'sequence', tiles: [suited('man', 5), suited('man', 6), suited('man', 7)] },
      ],
      [dragon('white'), dragon('white')],
    );
    expect(detectSanankou(concealed)).toEqual({ name: 'Sanankou', han: 2 });

    const open = hand(
      [
        quad(suited('man', 2), true),
        quad(suited('pin', 3)),
        triplet(suited('sou', 4)),
        { type: 'sequence', tiles: [suited('man', 5), suited('man', 6), suited('man', 7)] },
      ],
      [dragon('white'), dragon('white')],
    );
    expect(detectSanankou(open)).toBeNull();
  });
});
