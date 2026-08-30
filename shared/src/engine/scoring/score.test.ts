import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type {
  ChiitoitsuWinningHand,
  StandardWinningHand,
  WinningHandBase,
  WinningMeld,
  YakuResult,
} from '../yaku/context';
import { resolveScoringYaku, scoreBestCandidate, scoreWinningHand } from './score';

function base(allTiles: readonly Tile[], overrides: Partial<WinningHandBase> = {}): WinningHandBase {
  return {
    allTiles,
    winningTile: allTiles[allTiles.length - 1],
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

function chiitoitsu(
  tiles: readonly Tile[],
  overrides: Partial<WinningHandBase> = {},
): ChiitoitsuWinningHand {
  return { ...base(tiles, overrides), shape: 'chiitoitsu' };
}

function triplet(tile: Tile): WinningMeld {
  return { type: 'triplet', tiles: [tile, { ...tile }, { ...tile }] };
}

function standard(
  melds: WinningMeld[],
  pair: readonly Tile[],
  overrides: Partial<WinningHandBase> = {},
): StandardWinningHand {
  const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
  return { ...base(allTiles, overrides), shape: 'standard', melds, pair };
}

const SETTLEMENT = { honba: 0, riichiSticks: 0 };

describe('resolveScoringYaku', () => {
  it('removes Chanta when Junchan is present', () => {
    const yaku: YakuResult[] = [
      { name: 'Chanta', han: 2 },
      { name: 'Junchan', han: 3 },
      { name: 'Riichi', han: 1 },
    ];
    expect(resolveScoringYaku(yaku).map((result) => result.name)).toEqual(['Junchan', 'Riichi']);
  });
});

describe('scoreWinningHand', () => {
  it('adds Dora to ordinary Han after confirming a real yaku', () => {
    const tiles = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 4), suited('pin', 4),
      suited('pin', 6), suited('pin', 6),
      suited('sou', 7), suited('sou', 7),
      suited('pin', 9), suited('pin', 9),
      wind('west'), wind('west'),
    ];
    const result = scoreWinningHand(
      chiitoitsu(tiles),
      { doraIndicators: [suited('pin', 3)] },
      SETTLEMENT,
    );
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.scoringYaku.map((yaku) => yaku.name)).toContain('Chiitoitsu');
    expect(result.yakuHan).toBe(2);
    expect(result.bonusHan).toBe(2);
    expect(result.han).toBe(4);
    expect(result.fu?.fu).toBe(25);
    expect(result.base).toEqual({ basePoints: 1600, limit: 'none' });
    expect(result.payments.winnerGain).toBe(6400);
  });

  it('does not allow Dora to create a legal no-yaku hand', () => {
    const winningTile = suited('man', 4);
    const melds: WinningMeld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)], isOpen: true },
      triplet(suited('pin', 3)),
      { type: 'sequence', tiles: [suited('sou', 1), suited('sou', 2), suited('sou', 3)], isOpen: true },
      { type: 'sequence', tiles: [suited('pin', 7), suited('pin', 8), suited('pin', 9)], isOpen: true },
    ];
    const pair = [suited('sou', 7), suited('sou', 7)];
    const hand = standard(melds, pair, { winningTile, winCondition: 'ron' });
    const result = scoreWinningHand(
      hand,
      { doraIndicators: [suited('man', 3), suited('pin', 2)] },
      SETTLEMENT,
    );
    expect(result.status).toBe('no-yaku');
    expect(result.dora.total).toBeGreaterThan(0);
  });

  it('ignores ordinary Han and Dora for true Yakuman point value', () => {
    const tiles = [
      wind('east'), wind('east'),
      wind('south'), wind('south'),
      wind('west'), wind('west'),
      wind('north'), wind('north'),
      dragon('white'), dragon('white'),
      dragon('green'), dragon('green'),
      dragon('red'), dragon('red'),
    ];
    const result = scoreWinningHand(
      chiitoitsu(tiles, { isRiichi: true }),
      { doraIndicators: [wind('north')], uraIndicators: [dragon('red')] },
      SETTLEMENT,
    );
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.yakuman).toBe(1);
    expect(result.scoringYaku.map((yaku) => yaku.name)).toEqual(['Tsuuiisou']);
    expect(result.han).toBe(0);
    expect(result.bonusHan).toBe(0);
    expect(result.fu).toBeNull();
    expect(result.base).toEqual({ basePoints: 8000, limit: 'yakuman' });
  });

  it('stacks distinct true Yakuman', () => {
    const hand = standard(
      [triplet(wind('east')), triplet(wind('south')), triplet(wind('west')), triplet(wind('north'))],
      [dragon('white'), dragon('white')],
      { winCondition: 'tsumo' },
    );
    const result = scoreWinningHand(hand, { doraIndicators: [] }, SETTLEMENT);
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.yakuman).toBeGreaterThanOrEqual(3); // Suuankou + Daisuushii + Tsuuiisou
    expect(result.base.limit).toBe('multiple-yakuman');
    expect(result.base.basePoints).toBe(8000 * result.yakuman);
  });
});

describe('scoreBestCandidate', () => {
  it('chooses a scored interpretation over a no-yaku interpretation', () => {
    const pairTiles = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 4), suited('pin', 4),
      suited('pin', 6), suited('pin', 6),
      suited('sou', 7), suited('sou', 7),
      suited('pin', 9), suited('pin', 9),
      wind('west'), wind('west'),
    ];
    const valid = chiitoitsu(pairTiles);

    const winningTile = suited('man', 4);
    const invalid = standard(
      [
        { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)], isOpen: true },
        triplet(suited('pin', 3)),
        { type: 'sequence', tiles: [suited('sou', 1), suited('sou', 2), suited('sou', 3)], isOpen: true },
        { type: 'sequence', tiles: [suited('pin', 7), suited('pin', 8), suited('pin', 9)], isOpen: true },
      ],
      [suited('sou', 7), suited('sou', 7)],
      { winningTile },
    );

    const best = scoreBestCandidate([invalid, valid], { doraIndicators: [] }, SETTLEMENT);
    expect(best?.status).toBe('scored');
  });
});
