import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type {
  ChiitoitsuWinningHand,
  StandardWinningHand,
  WinningHandBase,
  WinningMeld,
} from '../yaku/context';
import { scoreBestCandidate, scoreWinningHand } from './score';

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

const SETTLEMENT = { honba: 0, riichiSticks: 0 };

describe('scoring end-to-end', () => {
  it('scores a closed non-dealer Pinfu Tsumo at fixed 20 fu', () => {
    const winningTile = suited('pin', 4);
    const melds: WinningMeld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [winningTile, suited('pin', 5), suited('pin', 6)] },
      { type: 'sequence', tiles: [suited('sou', 2), suited('sou', 3), suited('sou', 4)] },
      { type: 'sequence', tiles: [suited('man', 6), suited('man', 7), suited('man', 8)] },
    ];
    const pair = [suited('sou', 5), suited('sou', 5)];
    const allTiles = [...melds.flatMap((meld) => meld.tiles), ...pair];
    const hand: StandardWinningHand = {
      ...base(allTiles, { winningTile, winCondition: 'tsumo' }),
      shape: 'standard',
      melds,
      pair,
    };

    const result = scoreWinningHand(hand, { doraIndicators: [] }, SETTLEMENT);
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.scoringYaku.map((yaku) => yaku.name).sort()).toEqual([
      'Menzen Tsumo',
      'Pinfu',
    ]);
    expect(result.han).toBe(2);
    expect(result.fu?.fu).toBe(20);
    expect(result.base).toEqual({ basePoints: 320, limit: 'none' });
    expect(result.payments).toMatchObject({
      type: 'tsumo-nondealer',
      fromDealer: 700,
      fromEachNonDealer: 400,
      handPayment: 1500,
    });
  });

  it('counts Riichi Ura and Aka + indicator Dora together', () => {
    const redFive = suited('pin', 5, true);
    const tiles = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 4), suited('pin', 4),
      redFive, suited('pin', 5),
      suited('sou', 7), suited('sou', 7),
      suited('pin', 9), suited('pin', 9),
      suited('sou', 8), suited('sou', 8),
    ];
    const hand: ChiitoitsuWinningHand = {
      ...base(tiles, { isRiichi: true }),
      shape: 'chiitoitsu',
    };
    const result = scoreWinningHand(
      hand,
      {
        doraIndicators: [suited('pin', 4)], // both 5p are Dora; red 5p is also Aka
        uraIndicators: [suited('sou', 6)], // both 7s are Ura
      },
      SETTLEMENT,
    );
    expect(result.status).toBe('scored');
    if (result.status !== 'scored') return;
    expect(result.dora).toEqual({ dora: 2, uraDora: 2, akaDora: 1, total: 5 });
    expect(result.yakuHan).toBe(3); // Chiitoitsu + Riichi
    expect(result.bonusHan).toBe(5);
    expect(result.han).toBe(8);
    expect(result.base.limit).toBe('baiman');
  });

  it('chooses the higher-paying semantic interpretation of the same physical tiles', () => {
    // Physical shape: 112233m 445566p 77s. It can be seven pairs (2 han Chiitoitsu) or
    // 123m+123m+456p+456p+77s (3 han Ryanpeikou). The winning tile is the second 7s, a tanki in
    // the standard interpretation. We provide both semantic candidates explicitly instead of
    // asking scoring to reconstruct them, preserving the winning-tile identity invariant.
    const m1a = suited('man', 1); const m1b = suited('man', 1);
    const m2a = suited('man', 2); const m2b = suited('man', 2);
    const m3a = suited('man', 3); const m3b = suited('man', 3);
    const p4a = suited('pin', 4); const p4b = suited('pin', 4);
    const p5a = suited('pin', 5); const p5b = suited('pin', 5);
    const p6a = suited('pin', 6); const p6b = suited('pin', 6);
    const s7a = suited('sou', 7); const winningTile = suited('sou', 7);
    const tiles = [m1a, m1b, m2a, m2b, m3a, m3b, p4a, p4b, p5a, p5b, p6a, p6b, s7a, winningTile];

    const pairs: ChiitoitsuWinningHand = {
      ...base(tiles, { winningTile }),
      shape: 'chiitoitsu',
    };

    const melds: WinningMeld[] = [
      { type: 'sequence', tiles: [m1a, m2a, m3a] },
      { type: 'sequence', tiles: [m1b, m2b, m3b] },
      { type: 'sequence', tiles: [p4a, p5a, p6a] },
      { type: 'sequence', tiles: [p4b, p5b, p6b] },
    ];
    const standard: StandardWinningHand = {
      ...base(tiles, { winningTile }),
      shape: 'standard',
      melds,
      pair: [s7a, winningTile],
    };

    const best = scoreBestCandidate([pairs, standard], { doraIndicators: [] }, SETTLEMENT);
    expect(best?.status).toBe('scored');
    if (!best || best.status !== 'scored') return;
    expect(best.scoringYaku.map((yaku) => yaku.name)).toContain('Ryanpeikou');
    expect(best.han).toBe(3);
    expect(best.fu?.fu).toBe(40);
    expect(best.payments.winnerGain).toBe(5200);
  });
});
