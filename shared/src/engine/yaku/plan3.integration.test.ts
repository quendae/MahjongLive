import { describe, expect, it } from 'vitest';
import { detectAllYaku } from './index';
import { dragon, suited, wind } from '../tiles/tiles';
import type { Suit, SuitRank, Tile } from '../tiles/types';
import type {
  ChiitoitsuWinningHand,
  KokushiWinningHand,
  StandardWinningHand,
  WinningHandBase,
  WinningMeld,
} from './context';

function base(allTiles: readonly Tile[], overrides: Partial<WinningHandBase> = {}): WinningHandBase {
  return {
    allTiles,
    winningTile: allTiles[allTiles.length - 1] ?? suited('man', 1),
    winCondition: 'ron',
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

function sequence(suit: Suit, low: number): WinningMeld {
  return {
    type: 'sequence',
    tiles: [
      suited(suit, low as SuitRank),
      suited(suit, (low + 1) as SuitRank),
      suited(suit, (low + 2) as SuitRank),
    ],
  };
}

function triplet(tile: Tile): WinningMeld {
  return { type: 'triplet', tiles: [tile, { ...tile }, { ...tile }] };
}

function standard(melds: WinningMeld[], pair: readonly Tile[], overrides: Partial<WinningHandBase> = {}): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  return { ...base(allTiles, overrides), shape: 'standard', melds, pair };
}

describe('Plan 3 detectAllYaku integration', () => {
  it('lets a valid Kokushi pass through the full detector set safely', () => {
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
      wind('east'),
    ];
    const hand: KokushiWinningHand = { ...base(tiles), shape: 'kokushi' };
    const names = detectAllYaku(hand).map((result) => result.name);
    expect(names).toContain('Kokushi Musou');
  });

  it('returns Double Riichi but not ordinary Riichi', () => {
    const tiles = [
      suited('man', 2), suited('man', 2),
      suited('man', 3), suited('man', 3),
      suited('pin', 4), suited('pin', 4),
      suited('pin', 5), suited('pin', 5),
      suited('sou', 6), suited('sou', 6),
      suited('sou', 7), suited('sou', 7),
      suited('sou', 8), suited('sou', 8),
    ];
    const hand: ChiitoitsuWinningHand = {
      ...base(tiles, { isRiichi: true, isDoubleRiichi: true }),
      shape: 'chiitoitsu',
    };
    const names = detectAllYaku(hand).map((result) => result.name);
    expect(names).toContain('Double Riichi');
    expect(names).not.toContain('Riichi');
  });

  it('returns Ryanpeikou but not Iipeikou', () => {
    const hand = standard(
      [
        sequence('man', 1),
        sequence('man', 1),
        sequence('pin', 4),
        sequence('pin', 4),
      ],
      [suited('sou', 9), suited('sou', 9)],
    );
    const names = detectAllYaku(hand).map((result) => result.name);
    expect(names).toContain('Ryanpeikou');
    expect(names).not.toContain('Iipeikou');
  });

  it('returns Daisuushii but not Shousuushii and preserves stacked distinct Yakuman', () => {
    const hand = standard(
      [
        triplet(wind('east')),
        triplet(wind('south')),
        triplet(wind('west')),
        triplet(wind('north')),
      ],
      [dragon('white'), dragon('white')],
      { winCondition: 'tsumo' },
    );
    const results = detectAllYaku(hand);
    const names = results.map((result) => result.name);
    expect(names).toContain('Daisuushii');
    expect(names).not.toContain('Shousuushii');
    expect(results.filter((result) => result.yakuman === 1).length).toBeGreaterThanOrEqual(2);
  });
});
