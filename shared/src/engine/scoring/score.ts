import { detectAllYaku } from '../yaku';
import { WinningHand, YakuResult } from '../yaku/context';
import { countDora, DoraBreakdown, DoraContext } from './dora';
import { calculateFu, FuResult } from './fu';
import { BasePointResult, calculateBasePoints } from './limits';
import { calculatePayments, PaymentResult, SettlementContext } from './payments';

export interface ScoredHand {
  status: 'scored';
  /** Raw detector output, useful for UI/debugging. */
  yaku: readonly YakuResult[];
  /** Results that actually contribute to point value after family/Yakuman resolution. */
  scoringYaku: readonly YakuResult[];
  dora: DoraBreakdown;
  yakuHan: number;
  bonusHan: number;
  han: number;
  yakuman: number;
  fu: FuResult | null;
  base: BasePointResult;
  payments: PaymentResult;
}

export interface NoYakuScore {
  status: 'no-yaku';
  yaku: readonly YakuResult[];
  dora: DoraBreakdown;
}

export type ScoreResult = ScoredHand | NoYakuScore;

/** Resolve detector families that Plan 3 intentionally leaves structurally non-exclusive. */
export function resolveScoringYaku(yaku: readonly YakuResult[]): YakuResult[] {
  const hasJunchan = yaku.some((result) => result.name === 'Junchan');
  return yaku.filter((result) => !(hasJunchan && result.name === 'Chanta'));
}

export function scoreWinningHand(
  hand: WinningHand,
  doraContext: DoraContext,
  settlement: SettlementContext,
): ScoreResult {
  const yaku = detectAllYaku(hand);
  const dora = countDora(hand, doraContext);

  // Dora are bonus Han, never a yaku and never enough to make a hand legally winnable.
  if (yaku.length === 0) return { status: 'no-yaku', yaku, dora };

  const resolved = resolveScoringYaku(yaku);
  const yakuman = resolved.reduce((sum, result) => sum + (result.yakuman ?? 0), 0);

  if (yakuman > 0) {
    const scoringYaku = resolved.filter((result) => (result.yakuman ?? 0) > 0);
    const base = calculateBasePoints(0, 0, yakuman);
    const payments = calculatePayments(base.basePoints, hand, settlement);
    return {
      status: 'scored',
      yaku,
      scoringYaku,
      dora,
      yakuHan: 0,
      bonusHan: 0,
      han: 0,
      yakuman,
      fu: null,
      base,
      payments,
    };
  }

  const scoringYaku = resolved;
  const yakuHan = scoringYaku.reduce((sum, result) => sum + result.han, 0);
  const bonusHan = dora.total;
  const han = yakuHan + bonusHan;
  const fu = calculateFu(hand, scoringYaku);

  // Kokushi and every other Fu-less shape is Yakuman in V1, so reaching this branch without Fu
  // signals an invalid semantic context rather than a legitimate zero-Fu ordinary score.
  if (fu === null) return { status: 'no-yaku', yaku, dora };

  const base = calculateBasePoints(han, fu.fu, 0);
  const payments = calculatePayments(base.basePoints, hand, settlement);

  return {
    status: 'scored',
    yaku,
    scoringYaku,
    dora,
    yakuHan,
    bonusHan,
    han,
    yakuman: 0,
    fu,
    base,
    payments,
  };
}

function compareScoredHands(a: ScoredHand, b: ScoredHand): number {
  if (a.payments.winnerGain !== b.payments.winnerGain) {
    return a.payments.winnerGain - b.payments.winnerGain;
  }
  if (a.base.basePoints !== b.base.basePoints) return a.base.basePoints - b.base.basePoints;
  if (a.han !== b.han) return a.han - b.han;
  return (a.fu?.fu ?? 0) - (b.fu?.fu ?? 0);
}

/**
 * Scores already-resolved semantic interpretations and selects the highest-paying one.
 * This function deliberately never calls `decomposeStandardHand`; see the winning-tile identity
 * HAZARD in `yaku/context.ts`.
 */
export function scoreBestCandidate(
  hands: readonly WinningHand[],
  dora: DoraContext,
  settlement: SettlementContext,
): ScoreResult | null {
  if (hands.length === 0) return null;

  const results = hands.map((hand) => scoreWinningHand(hand, dora, settlement));
  const scored = results.filter((result): result is ScoredHand => result.status === 'scored');
  if (scored.length === 0) return results[0];

  return scored.reduce((best, candidate) =>
    compareScoredHands(candidate, best) > 0 ? candidate : best,
  );
}
