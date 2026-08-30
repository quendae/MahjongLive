import { WinningHand, YakuDetector, YakuResult } from './context';
import { detectRiichi, detectIppatsu, detectMenzenTsumo } from './riichi';
import { detectChiitoitsu, detectTanyao } from './chiitoitsuTanyao';
import { detectYakuhai } from './yakuhai';
import { detectPinfu, detectIipeikou } from './pinfuIipeikou';
import { detectSanshokuDoujun, detectIttsuu } from './sanshokuIttsuu';
import { detectChanta, detectJunchan } from './chantaJunchan';
import { detectToitoi, detectSanankou } from './toitoiSanankou';
import { detectHonitsu, detectChinitsu } from './honitsuChinitsu';
import {
  detectRyanpeikou,
  detectSanshokuDoukou,
  detectSankantsu,
  detectHonroutou,
  detectShousangen,
} from './rarePatterns';
import {
  detectDoubleRiichi,
  detectHaitei,
  detectHoutei,
  detectRinshan,
  detectChankan,
  detectTenhou,
  detectChiihou,
} from './situational';
import {
  detectKokushi,
  detectTsuuiisou,
  detectChinroutou,
  detectRyuuiisou,
  detectChuurenpoutou,
} from './yakumanComposition';
import {
  detectSuuankou,
  detectDaisangen,
  detectShousuushii,
  detectDaisuushii,
  detectSuukantsu,
} from './yakumanGroups';

export const ALL_YAKU_DETECTORS: readonly YakuDetector[] = [
  detectRiichi,
  detectDoubleRiichi,
  detectIppatsu,
  detectMenzenTsumo,
  detectChiitoitsu,
  detectTanyao,
  detectYakuhai,
  detectPinfu,
  detectIipeikou,
  detectRyanpeikou,
  detectSanshokuDoujun,
  detectIttsuu,
  detectSanshokuDoukou,
  detectSankantsu,
  detectHonroutou,
  detectShousangen,
  detectChanta,
  detectJunchan,
  detectToitoi,
  detectSanankou,
  detectHonitsu,
  detectChinitsu,
  detectHaitei,
  detectHoutei,
  detectRinshan,
  detectChankan,
  detectKokushi,
  detectSuuankou,
  detectDaisangen,
  detectShousuushii,
  detectDaisuushii,
  detectTsuuiisou,
  detectChinroutou,
  detectRyuuiisou,
  detectChuurenpoutou,
  detectSuukantsu,
  detectTenhou,
  detectChiihou,
];

/**
 * Runs every hand-yaku detector and collects the matches. Nagashi Mangan is intentionally absent:
 * it is an exhaustive-draw settlement evaluated from discard history, not a WinningHand yaku.
 *
 * Family exclusivity that can be decided locally is already enforced by detectors:
 * - Double Riichi supersedes Riichi.
 * - Ryanpeikou supersedes Iipeikou.
 * - Daisuushii supersedes Shousuushii.
 *
 * Chanta/Junchan remain structurally non-exclusive for backwards compatibility with Plan 2; the
 * scorer must resolve Junchan over Chanta before summing ordinary han.
 *
 * If any returned result has `yakuman`, Plan 4 scoring must sum Yakuman multipliers and ignore
 * ordinary han for base hand value. V1 does not encode Yakuman as 13 han and disables double-wait
 * Yakuman variants.
 */
export function detectAllYaku(hand: WinningHand): YakuResult[] {
  return ALL_YAKU_DETECTORS.map((detect) => detect(hand)).filter((r): r is YakuResult => r !== null);
}

export * from './context';
export * from './nagashi';
