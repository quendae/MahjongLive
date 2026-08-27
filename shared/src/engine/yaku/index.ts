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

export function detectAllYaku(hand: WinningHand): YakuResult[] {
  return ALL_YAKU_DETECTORS.map((detect) => detect(hand)).filter((r): r is YakuResult => r !== null);
}

export * from './context';
