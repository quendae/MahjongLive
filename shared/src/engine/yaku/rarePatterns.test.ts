import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import type { Suit, SuitRank, Tile } from '../tiles/types';
import type { StandardWinningHand, WinningHandBase, WinningMeld } from './context';
import { detectIipeikou } from './pinfuIipeikou';
import {
  detectHonroutou,
  detectRyanpeikou,
  detectSankantsu,
  detectSanshokuDoukou,
  detectShousangen,
} from './rarePatterns';

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

function quad(tile: Tile): WinningMeld {
  return { type: 'quad', tiles: [tile, { ...tile }, { ...tile }, { ...tile }] };
}

function base(overrides: Partial<WinningHandBase> = {}): WinningHandBase {
  return {
    allTiles: [],
    winningTile: suited('man', 3),
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
}

function standard(
  melds: WinningMeld[],
  pair: readonly Tile[] = [wind('east'), wind('east')],
): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  return { ...base({ allTiles }), shape: 'standard', melds, pair };
}

describe('Ryanpeikou', () => {
  it('detects two distinct identical-sequence pairs and suppresses Iipeikou', () => {
    const hand = standard([
      sequence('man', 1),
      sequence('man', 1),
      sequence('pin', 4),
      sequence('pin', 4),
    ]);
    expect(detectRyanpeikou(hand)).toEqual({ name: 'Ryanpeikou', han: 3 });
    expect(detectIipeikou(hand)).toBeNull();
  });

  it('detects four identical sequences as two pair-units', () => {
    const hand = standard([
      sequence('sou', 2),
      sequence('sou', 2),
      sequence('sou', 2),
      sequence('sou', 2),
    ]);
    expect(detectRyanpeikou(hand)).toEqual({ name: 'Ryanpeikou', han: 3 });
    expect(detectIipeikou(hand)).toBeNull();
  });

  it('rejects an open hand', () => {
    const hand = standard([
      sequence('man', 1, true),
      sequence('man', 1),
      sequence('pin', 4),
      sequence('pin', 4),
    ]);
    expect(detectRyanpeikou(hand)).toBeNull();
  });
});

describe('remaining rare patterns', () => {
  it('detects Sanshoku Doukou with a quad as one of the three groups', () => {
    const hand = standard([
      triplet(suited('man', 5)),
      quad(suited('pin', 5)),
      triplet(suited('sou', 5)),
      sequence('man', 1),
    ]);
    expect(detectSanshokuDoukou(hand)).toEqual({ name: 'Sanshoku Doukou', han: 2 });
  });

  it('detects exactly three quads as Sankantsu, but not four', () => {
    const three = standard([
      quad(suited('man', 2)),
      quad(suited('pin', 3)),
      quad(suited('sou', 4)),
      triplet(wind('east')),
    ]);
    const four = standard([
      quad(suited('man', 2)),
      quad(suited('pin', 3)),
      quad(suited('sou', 4)),
      quad(wind('east')),
    ]);
    expect(detectSankantsu(three)).toEqual({ name: 'Sankantsu', han: 2 });
    expect(detectSankantsu(four)).toBeNull();
  });

  it('detects Honroutou across terminals and honors', () => {
    const hand = standard(
      [
        triplet(suited('man', 1)),
        triplet(suited('pin', 9)),
        triplet(wind('west')),
        triplet(dragon('green')),
      ],
      [suited('sou', 1), suited('sou', 1)],
    );
    expect(detectHonroutou(hand)).toEqual({ name: 'Honroutou', han: 2 });
  });

  it('detects Shousangen with two dragon groups and the third dragon pair', () => {
    const hand = standard(
      [
        triplet(dragon('white')),
        quad(dragon('green')),
        sequence('man', 1),
        sequence('pin', 4),
      ],
      [dragon('red'), dragon('red')],
    );
    expect(detectShousangen(hand)).toEqual({ name: 'Shousangen', han: 2 });
  });
});
