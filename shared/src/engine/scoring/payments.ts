import { WinningHand } from '../yaku/context';

export interface SettlementContext {
  honba: number;
  riichiSticks: number;
}

export type PaymentResult =
  | {
      type: 'ron';
      fromDiscarder: number;
      handPayment: number;
      riichiBonus: number;
      winnerGain: number;
    }
  | {
      type: 'tsumo-dealer';
      fromEach: number;
      handPayment: number;
      riichiBonus: number;
      winnerGain: number;
    }
  | {
      type: 'tsumo-nondealer';
      fromDealer: number;
      fromEachNonDealer: number;
      handPayment: number;
      riichiBonus: number;
      winnerGain: number;
    };

function roundUp100(points: number): number {
  return Math.ceil(points / 100) * 100;
}

export function calculatePayments(
  basePoints: number,
  hand: WinningHand,
  context: SettlementContext,
): PaymentResult {
  const honba = Math.max(0, Math.floor(context.honba));
  const riichiSticks = Math.max(0, Math.floor(context.riichiSticks));
  const riichiBonus = riichiSticks * 1000;
  const dealer = hand.seatWind === 'east';

  if (hand.winCondition === 'ron') {
    const multiplier = dealer ? 6 : 4;
    const fromDiscarder = roundUp100(basePoints * multiplier) + honba * 300;
    return {
      type: 'ron',
      fromDiscarder,
      handPayment: fromDiscarder,
      riichiBonus,
      winnerGain: fromDiscarder + riichiBonus,
    };
  }

  if (dealer) {
    const fromEach = roundUp100(basePoints * 2) + honba * 100;
    const handPayment = fromEach * 3;
    return {
      type: 'tsumo-dealer',
      fromEach,
      handPayment,
      riichiBonus,
      winnerGain: handPayment + riichiBonus,
    };
  }

  const fromDealer = roundUp100(basePoints * 2) + honba * 100;
  const fromEachNonDealer = roundUp100(basePoints) + honba * 100;
  const handPayment = fromDealer + fromEachNonDealer * 2;
  return {
    type: 'tsumo-nondealer',
    fromDealer,
    fromEachNonDealer,
    handPayment,
    riichiBonus,
    winnerGain: handPayment + riichiBonus,
  };
}
