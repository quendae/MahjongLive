import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import type { Suit, SuitRank, Tile } from '../tiles/types';
import type {
  ChiitoitsuWinningHand,
  StandardWinningHand,
  WinningHandBase,
  WinningMeld,
  YakuResult,
} from '../yaku/context';
import { calculateFu } from './fu';

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
  winningTile: Tile,
  overrides: Partial<WinningHandBase> = {},
): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  return {
    shape: 'standard',
    allTiles,
    melds,
    pair,
    winningTile,
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

const PINFU: YakuResult[] = [{ name: 'Pinfu', han: 1 }];

describe('fixed Fu', () => {
  it('keeps Chiitoitsu at exactly 25 fu', () => {
    const tiles = [suited('man', 2), suited('man', 2)];
    const hand: ChiitoitsuWinningHand = {
      shape: 'chiitoitsu',
      allTiles: tiles,
      winningTile: tiles[0],
      winCondition: 'ron',
      seatWind: 'south',
      roundWind: 'east',
      isRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      isHoutei: false,
      isRinshan: false,
      isChankan: false,
    };
    expect(calculateFu(hand, [{ name: 'Chiitoitsu', han: 2 }])).toMatchObject({
      fu: 25,
      rawFu: 25,
      fixed: 'chiitoitsu',
    });
  });

  it('keeps Pinfu Tsumo at exactly 20 fu', () => {
    const winningTile = suited('man', 4);
    const first: WinningMeld = {
      type: 'sequence',
      tiles: [winningTile, suited('man', 5), suited('man', 6)],
    };
    const hand = standard(
      [first, sequence('pin', 2), sequence('sou', 3), sequence('man', 7)],
      [suited('pin', 6), suited('pin', 6)],
      winningTile,
      { winCondition: 'tsumo' },
    );
    expect(calculateFu(hand, PINFU)).toMatchObject({ fu: 20, rawFu: 20, fixed: 'pinfu-tsumo' });
  });
});

describe('meld, pair and winning-method Fu', () => {
  it('counts a double-wind pair as 4 fu', () => {
    const winningTile = suited('man', 4);
    const first: WinningMeld = {
      type: 'sequence',
      tiles: [winningTile, suited('man', 5), suited('man', 6)],
    };
    const hand = standard(
      [first, sequence('pin', 2), sequence('sou', 3), sequence('man', 7)],
      [wind('east'), wind('east')],
      winningTile,
      { seatWind: 'east', roundWind: 'east', winCondition: 'tsumo' },
    );
    const result = calculateFu(hand, [])!;
    expect(result.components).toContainEqual({ source: 'Value pair', fu: 4 });
    expect(result.rawFu).toBe(26);
    expect(result.fu).toBe(30);
  });

  it('uses the exact winning tile reference to make a Ron-completed triplet open for Fu', () => {
    const winningTile = suited('man', 5);
    const winningTriplet: WinningMeld = {
      type: 'triplet',
      tiles: [suited('man', 5), suited('man', 5), winningTile],
    };
    const hand = standard(
      [winningTriplet, sequence('pin', 2), sequence('sou', 3), sequence('man', 7)],
      [suited('pin', 6), suited('pin', 6)],
      winningTile,
      { winCondition: 'ron' },
    );

    // The hand is still menzen (+10 Ron fu), but this shanpon-completed simple triplet is 2 fu,
    // not 4. This is the reference-identity HAZARD documented in yaku/context.ts.
    const result = calculateFu(hand, [])!;
    expect(result.components).toContainEqual({ source: 'Menzen Ron', fu: 10 });
    expect(result.components.some((component) => component.fu === 2)).toBe(true);
    expect(result.rawFu).toBe(32);
    expect(result.fu).toBe(40);
  });

  it('applies the full triplet/quad Fu table', () => {
    const pairTile = suited('pin', 5);
    const pair = [pairTile, suited('pin', 5)] as const;
    const hand = standard(
      [
        triplet(suited('man', 2), true),
        triplet(wind('west')),
        quad(suited('sou', 3), true),
        quad(dragon('red')),
      ],
      pair,
      pairTile,
      { winCondition: 'tsumo' },
    );
    const result = calculateFu(hand, [])!;
    const meldFu = result.components
      .filter((component) => component.source.includes('triplet') || component.source.includes('quad'))
      .map((component) => component.fu)
      .sort((a, b) => a - b);
    expect(meldFu).toEqual([2, 8, 8, 32]);
  });
});

describe('wait Fu and rounding', () => {
  it('adds 2 fu for tanki, kanchan and penchan waits', () => {
    const pairWinningTile = suited('pin', 5);
    const tanki = standard(
      [sequence('man', 1), sequence('pin', 1), sequence('sou', 1), sequence('man', 4)],
      [pairWinningTile, suited('pin', 5)],
      pairWinningTile,
    );
    expect(calculateFu(tanki, [])!.components).toContainEqual({ source: 'Wait', fu: 2 });

    const kanchanWinningTile = suited('man', 5);
    const kanchanMeld: WinningMeld = {
      type: 'sequence',
      tiles: [suited('man', 4), kanchanWinningTile, suited('man', 6)],
    };
    const kanchan = standard(
      [kanchanMeld, sequence('pin', 1), sequence('sou', 1), sequence('man', 7)],
      [suited('pin', 5), suited('pin', 5)],
      kanchanWinningTile,
    );
    expect(calculateFu(kanchan, [])!.components).toContainEqual({ source: 'Wait', fu: 2 });

    const penchanWinningTile = suited('sou', 3);
    const penchanMeld: WinningMeld = {
      type: 'sequence',
      tiles: [suited('sou', 1), suited('sou', 2), penchanWinningTile],
    };
    const penchan = standard(
      [penchanMeld, sequence('pin', 1), sequence('man', 4), sequence('pin', 7)],
      [suited('man', 5), suited('man', 5)],
      penchanWinningTile,
    );
    expect(calculateFu(penchan, [])!.components).toContainEqual({ source: 'Wait', fu: 2 });
  });

  it('forces an otherwise 20-fu open Ron to 30 fu', () => {
    const winningTile = suited('man', 4);
    const winningMeld: WinningMeld = {
      type: 'sequence',
      tiles: [winningTile, suited('man', 5), suited('man', 6)],
      isOpen: true,
    };
    const hand = standard(
      [winningMeld, sequence('pin', 2), sequence('sou', 3), sequence('man', 7)],
      [suited('pin', 6), suited('pin', 6)],
      winningTile,
      { winCondition: 'ron' },
    );
    expect(calculateFu(hand, [])).toMatchObject({ rawFu: 20, fu: 30 });
  });
});
