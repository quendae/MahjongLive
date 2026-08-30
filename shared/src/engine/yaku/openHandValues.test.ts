import { describe, expect, it } from 'vitest';
import { suited, wind } from '../tiles/tiles';
import type { Suit, SuitRank, Tile } from '../tiles/types';
import type { StandardWinningHand, WinningHandBase, WinningMeld } from './context';
import { detectChanta, detectJunchan } from './chantaJunchan';
import { detectChinitsu, detectHonitsu } from './honitsuChinitsu';
import { detectIipeikou, detectPinfu } from './pinfuIipeikou';
import { detectMenzenTsumo, detectRiichi } from './riichi';
import { detectIttsuu, detectSanshokuDoujun } from './sanshokuIttsuu';

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

function hand(
  melds: WinningMeld[],
  pair: readonly Tile[],
  overrides: Partial<WinningHandBase> = {},
): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  const base: WinningHandBase = {
    allTiles,
    winningTile: melds[0]?.tiles[0] ?? pair[0],
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
  return { ...base, shape: 'standard', melds, pair };
}

describe('open-hand values', () => {
  it('reduces Sanshoku Doujun and Ittsuu by one han', () => {
    const sanshoku = hand(
      [
        sequence('man', 2, true),
        sequence('pin', 2),
        sequence('sou', 2),
        triplet(wind('west')),
      ],
      [suited('man', 9), suited('man', 9)],
    );
    expect(detectSanshokuDoujun(sanshoku)).toEqual({ name: 'Sanshoku Doujun', han: 1 });

    const ittsuu = hand(
      [
        sequence('man', 1, true),
        sequence('man', 4),
        sequence('man', 7),
        triplet(wind('west')),
      ],
      [suited('pin', 5), suited('pin', 5)],
    );
    expect(detectIttsuu(ittsuu)).toEqual({ name: 'Ittsuu', han: 1 });
  });

  it('reduces Chanta and Junchan by one han', () => {
    const chanta = hand(
      [
        sequence('man', 1, true),
        triplet(wind('west')),
        triplet(suited('pin', 9)),
        sequence('sou', 7),
      ],
      [wind('north'), wind('north')],
    );
    expect(detectChanta(chanta)).toEqual({ name: 'Chanta', han: 1 });

    const junchan = hand(
      [
        sequence('man', 1, true),
        triplet(suited('pin', 9)),
        triplet(suited('sou', 1)),
        sequence('pin', 7),
      ],
      [suited('sou', 9), suited('sou', 9)],
    );
    expect(detectJunchan(junchan)).toEqual({ name: 'Junchan', han: 2 });
  });

  it('reduces Honitsu and Chinitsu when any meld is open', () => {
    const honitsu = hand(
      [
        sequence('man', 1, true),
        sequence('man', 4),
        triplet(suited('man', 9)),
        triplet(wind('east')),
      ],
      [suited('man', 5), suited('man', 5)],
    );
    expect(detectHonitsu(honitsu)).toEqual({ name: 'Honitsu', han: 2 });

    const chinitsu = hand(
      [
        sequence('sou', 1, true),
        sequence('sou', 4),
        sequence('sou', 7),
        triplet(suited('sou', 2)),
      ],
      [suited('sou', 5), suited('sou', 5)],
    );
    expect(detectChinitsu(chinitsu)).toEqual({ name: 'Chinitsu', han: 5 });
  });

  it('rejects closed-only yaku on an open hand', () => {
    const open = hand(
      [
        sequence('man', 1, true),
        sequence('man', 1),
        sequence('pin', 4),
        sequence('sou', 6),
      ],
      [suited('pin', 2), suited('pin', 2)],
      { isRiichi: true, winCondition: 'tsumo' },
    );
    expect(detectRiichi(open)).toBeNull();
    expect(detectMenzenTsumo(open)).toBeNull();
    expect(detectPinfu(open)).toBeNull();
    expect(detectIipeikou(open)).toBeNull();
  });
});
