import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { ChiitoitsuWinningHand, WinningHandBase } from '../yaku/context';
import { calculatePayments } from './payments';

function hand(overrides: Partial<WinningHandBase> = {}): ChiitoitsuWinningHand {
  const tile = suited('man', 2);
  return {
    shape: 'chiitoitsu',
    allTiles: [tile],
    winningTile: tile,
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

describe('calculatePayments', () => {
  it('rounds a non-dealer Ron payment and adds Honba + Riichi sticks', () => {
    // 30 fu 1 han -> 240 base -> 960 -> rounded to 1000, plus 2 honba = 1600.
    expect(calculatePayments(240, hand(), { honba: 2, riichiSticks: 3 })).toEqual({
      type: 'ron',
      fromDiscarder: 1600,
      handPayment: 1600,
      riichiBonus: 3000,
      winnerGain: 4600,
    });
  });

  it('uses x6 for dealer Ron', () => {
    expect(
      calculatePayments(2000, hand({ seatWind: 'east' }), { honba: 0, riichiSticks: 0 }),
    ).toEqual({
      type: 'ron',
      fromDiscarder: 12000,
      handPayment: 12000,
      riichiBonus: 0,
      winnerGain: 12000,
    });
  });

  it('splits non-dealer Tsumo into dealer and two non-dealer obligations', () => {
    // 30 fu 1 han base 240: dealer 480->500, others 240->300. One honba adds 100 to each.
    expect(
      calculatePayments(
        240,
        hand({ winCondition: 'tsumo', seatWind: 'south' }),
        { honba: 1, riichiSticks: 1 },
      ),
    ).toEqual({
      type: 'tsumo-nondealer',
      fromDealer: 600,
      fromEachNonDealer: 400,
      handPayment: 1400,
      riichiBonus: 1000,
      winnerGain: 2400,
    });
  });

  it('charges every opponent the same x2 amount for dealer Tsumo', () => {
    expect(
      calculatePayments(
        2000,
        hand({ winCondition: 'tsumo', seatWind: 'east' }),
        { honba: 2, riichiSticks: 0 },
      ),
    ).toEqual({
      type: 'tsumo-dealer',
      fromEach: 4200,
      handPayment: 12600,
      riichiBonus: 0,
      winnerGain: 12600,
    });
  });
});
