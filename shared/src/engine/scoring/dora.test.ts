import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import type { ChiitoitsuWinningHand, WinningHandBase } from '../yaku/context';
import { countDora, doraFromIndicator } from './dora';

function hand(
  allTiles: ChiitoitsuWinningHand['allTiles'],
  overrides: Partial<WinningHandBase> = {},
): ChiitoitsuWinningHand {
  return {
    shape: 'chiitoitsu',
    allTiles,
    winningTile: allTiles[0] ?? suited('man', 1),
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

describe('doraFromIndicator', () => {
  it('wraps suited ranks from 9 back to 1', () => {
    expect(doraFromIndicator(suited('man', 8))).toEqual(suited('man', 9));
    expect(doraFromIndicator(suited('pin', 9))).toEqual(suited('pin', 1));
  });

  it('cycles winds and dragons', () => {
    expect(doraFromIndicator(wind('east'))).toEqual(wind('south'));
    expect(doraFromIndicator(wind('north'))).toEqual(wind('east'));
    expect(doraFromIndicator(dragon('white'))).toEqual(dragon('green'));
    expect(doraFromIndicator(dragon('red'))).toEqual(dragon('white'));
  });
});

describe('countDora', () => {
  it('stacks duplicate indicators and all physical copies', () => {
    const value = hand([
      suited('man', 5),
      suited('man', 5),
      suited('man', 5),
      suited('man', 5),
    ]);
    expect(
      countDora(value, { doraIndicators: [suited('man', 4), suited('man', 4)] }),
    ).toEqual({ dora: 8, uraDora: 0, akaDora: 0, total: 8 });
  });

  it('counts a red five as both Aka and normal indicator Dora', () => {
    const value = hand([suited('sou', 5, true)]);
    expect(countDora(value, { doraIndicators: [suited('sou', 4)] })).toEqual({
      dora: 1,
      uraDora: 0,
      akaDora: 1,
      total: 2,
    });
  });

  it('ignores Ura without Riichi and enables it for Riichi', () => {
    const tiles = [suited('pin', 7), suited('pin', 7)];
    const context = { doraIndicators: [], uraIndicators: [suited('pin', 6)] };
    expect(countDora(hand(tiles), context).uraDora).toBe(0);
    expect(countDora(hand(tiles, { isRiichi: true }), context).uraDora).toBe(2);
  });

  it('enables Ura for Double Riichi even when the normal Riichi flag is absent', () => {
    const value = hand([wind('south')], { isDoubleRiichi: true });
    expect(countDora(value, { doraIndicators: [], uraIndicators: [wind('east')] }).uraDora).toBe(1);
  });
});
