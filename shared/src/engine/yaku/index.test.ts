import { describe, it, expect } from 'vitest';
import { detectAllYaku } from './index';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

describe('detectAllYaku', () => {
  it('collects every matching yaku for a hand that qualifies for exactly two at once', () => {
    // 567m 234p 345s 234m + 66s pair, won by Ron on the 5m (a low-end ryanmen: held 6m7m,
    // waiting on 5m or 8m). All 14 tiles are simples (ranks 2-7, no terminals/honors), all four
    // melds are sequences, and the pair (6s) isn't a value tile — so exactly Tanyao and Pinfu
    // should fire. No triplets, no single suit, no matching sequences, no terminal/honor in any
    // group: every other detector in this plan's set is independently ruled out below.
    const winningTile = suited('man', 5);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 6), suited('man', 7)] },
      { type: 'sequence', tiles: [suited('pin', 2), suited('pin', 3), suited('pin', 4)] },
      { type: 'sequence', tiles: [suited('sou', 3), suited('sou', 4), suited('sou', 5)] },
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
    ];
    const pair = [suited('sou', 6), suited('sou', 6)];
    const hand: StandardWinningHand = {
      shape: 'standard',
      allTiles: [...melds.flatMap((m) => m.tiles), ...pair],
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
    };
    const results = detectAllYaku(hand);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(['Pinfu', 'Tanyao']);
    expect(results.every((r) => r.han > 0)).toBe(true);
  });

  it('returns an empty array when no yaku applies', () => {
    // 456m 333p 123s 789p + 77s pair, won by Ron on the 4m. A triplet rules out Pinfu/Toitoi
    // (only one triplet, so also not Sanankou); the 9p terminal rules out Tanyao; three suits
    // are present (rules out Honitsu/Chinitsu, and no suit alone carries a 1-4-7 run so Ittsuu is
    // out too); not every group contains a terminal/honor (rules out Chanta/Junchan); no two
    // sequences match (rules out Iipeikou); no matching low rank across all three suits (rules
    // out Sanshoku); no honor tile exists at all (rules out Yakuhai).
    const winningTile = suited('man', 4);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] },
      { type: 'triplet', tiles: [suited('pin', 3), suited('pin', 3), suited('pin', 3)] },
      { type: 'sequence', tiles: [suited('sou', 1), suited('sou', 2), suited('sou', 3)] },
      { type: 'sequence', tiles: [suited('pin', 7), suited('pin', 8), suited('pin', 9)] },
    ];
    const pair = [suited('sou', 7), suited('sou', 7)];
    const hand: StandardWinningHand = {
      shape: 'standard',
      allTiles: [...melds.flatMap((m) => m.tiles), ...pair],
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
    };
    expect(detectAllYaku(hand)).toEqual([]);
  });
});
