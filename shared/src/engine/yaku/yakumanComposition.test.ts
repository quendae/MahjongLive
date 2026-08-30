import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import type { Suit, SuitRank, Tile } from '../tiles/types';
import type {
  ChiitoitsuWinningHand,
  KokushiWinningHand,
  StandardWinningHand,
  WinningHandBase,
  WinningMeld,
} from './context';
import {
  detectChinroutou,
  detectChuurenpoutou,
  detectKokushi,
  detectRyuuiisou,
  detectTsuuiisou,
} from './yakumanComposition';

function base(allTiles: readonly Tile[], overrides: Partial<WinningHandBase> = {}): WinningHandBase {
  return {
    allTiles,
    winningTile: allTiles[allTiles.length - 1] ?? suited('man', 1),
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

function sequence(suit: Suit, low: number, isOpen = false): WinningMeld {
  return {
    type: 'sequence',
    tiles: [
      suited(suit, low as SuitRank),
      suited(suit, (low + 1) as SuitRank),
      suited(suit, (low + 2) as SuitRank),
    ],
    ...(isOpen ? { isOpen: true } : {}),
  };
}

function triplet(tile: Tile): WinningMeld {
  return { type: 'triplet', tiles: [tile, { ...tile }, { ...tile }] };
}

function standard(melds: WinningMeld[], pair: readonly Tile[]): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  return { ...base(allTiles), shape: 'standard', melds, pair };
}

describe('composition Yakuman', () => {
  it('detects Kokushi Musou from the real Kokushi shape', () => {
    const terminals = (['man', 'pin', 'sou'] as const).flatMap((suit) => [
      suited(suit, 1),
      suited(suit, 9),
    ]);
    const tiles = [
      ...terminals,
      wind('east'),
      wind('south'),
      wind('west'),
      wind('north'),
      dragon('white'),
      dragon('green'),
      dragon('red'),
      suited('man', 1),
    ];
    const hand: KokushiWinningHand = { ...base(tiles), shape: 'kokushi' };
    expect(detectKokushi(hand)).toEqual({ name: 'Kokushi Musou', han: 0, yakuman: 1 });
  });

  it('detects Tsuuiisou on an all-honor Chiitoitsu hand', () => {
    const tiles = [
      wind('east'), wind('east'),
      wind('south'), wind('south'),
      wind('west'), wind('west'),
      wind('north'), wind('north'),
      dragon('white'), dragon('white'),
      dragon('green'), dragon('green'),
      dragon('red'), dragon('red'),
    ];
    const hand: ChiitoitsuWinningHand = { ...base(tiles), shape: 'chiitoitsu' };
    expect(detectTsuuiisou(hand)).toEqual({ name: 'Tsuuiisou', han: 0, yakuman: 1 });
  });

  it('detects Chinroutou on an all-terminal hand', () => {
    const hand = standard(
      [
        triplet(suited('man', 1)),
        triplet(suited('man', 9)),
        triplet(suited('pin', 1)),
        triplet(suited('pin', 9)),
      ],
      [suited('sou', 1), suited('sou', 1)],
    );
    expect(detectChinroutou(hand)).toEqual({ name: 'Chinroutou', han: 0, yakuman: 1 });
  });

  it('detects Ryuuiisou using only the canonical green tiles', () => {
    const hand = standard(
      [
        sequence('sou', 2),
        triplet(suited('sou', 2)),
        triplet(suited('sou', 6)),
        triplet(dragon('green')),
      ],
      [suited('sou', 8), suited('sou', 8)],
    );
    expect(detectRyuuiisou(hand)).toEqual({ name: 'Ryuuiisou', han: 0, yakuman: 1 });
  });

  it('detects Chuurenpoutou and rejects the same tile pattern when the hand is open', () => {
    const closed = standard(
      [
        triplet(suited('man', 1)),
        sequence('man', 2),
        sequence('man', 6),
        triplet(suited('man', 9)),
      ],
      [suited('man', 5), suited('man', 5)],
    );
    expect(detectChuurenpoutou(closed)).toEqual({ name: 'Chuurenpoutou', han: 0, yakuman: 1 });

    const openMelds = [...closed.melds];
    openMelds[1] = { ...openMelds[1], isOpen: true };
    const open: StandardWinningHand = { ...closed, melds: openMelds };
    expect(detectChuurenpoutou(open)).toBeNull();
  });
});
