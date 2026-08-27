import { WinningHand, YakuDetector, YakuResult } from './context';
import { detectRiichi, detectIppatsu, detectMenzenTsumo } from './riichi';
import { detectChiitoitsu, detectTanyao } from './chiitoitsuTanyao';
import { detectYakuhai } from './yakuhai';
import { detectPinfu, detectIipeikou } from './pinfuIipeikou';
import { detectSanshokuDoujun, detectIttsuu } from './sanshokuIttsuu';
import { detectChanta, detectJunchan } from './chantaJunchan';
import { detectToitoi, detectSanankou } from './toitoiSanankou';
import { detectHonitsu, detectChinitsu } from './honitsuChinitsu';

export const ALL_YAKU_DETECTORS: readonly YakuDetector[] = [
  detectRiichi,
  detectIppatsu,
  detectMenzenTsumo,
  detectChiitoitsu,
  detectTanyao,
  detectYakuhai,
  detectPinfu,
  detectIipeikou,
  detectSanshokuDoujun,
  detectIttsuu,
  detectChanta,
  detectJunchan,
  detectToitoi,
  detectSanankou,
  detectHonitsu,
  detectChinitsu,
];

/**
 * Runs every detector in `ALL_YAKU_DETECTORS` and collects the matches. This is a simple,
 * un-deduplicated collector: it reports every yaku that is structurally true of the hand, and
 * does NOT resolve exclusivity between yaku families.
 *
 * In particular, `detectChanta` and `detectJunchan` are not mutually exclusive by construction —
 * Junchan's conditions (every meld/pair contains a terminal, no honors anywhere in the hand) are
 * a strict subset of Chanta's (every meld/pair contains a terminal-or-honor). Any hand that
 * qualifies for Junchan also satisfies Chanta, so both appear in the returned array together. In
 * standard Riichi rules, Junchan supersedes Chanta rather than stacking with it (a Junchan hand
 * scores 3 han for Junchan, not 2+3=5 for both).
 *
 * A consumer that sums `han` across these results (e.g. the Scoring plan) MUST resolve this kind
 * of yaku-family exclusivity itself before summing — blindly adding every result's `han` will
 * over-score a Junchan hand.
 */
export function detectAllYaku(hand: WinningHand): YakuResult[] {
  return ALL_YAKU_DETECTORS.map((detect) => detect(hand)).filter((r): r is YakuResult => r !== null);
}

export * from './context';
