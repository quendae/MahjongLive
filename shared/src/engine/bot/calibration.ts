import type { BotDifficulty } from './difficulty';

export type BotSeatProfiles = readonly [BotDifficulty, BotDifficulty, BotDifficulty, BotDifficulty];

export type BotCalibrationCase = {
  seed: number;
  rotation: number;
  profiles: BotSeatProfiles;
};

function rotateProfiles(lineup: BotSeatProfiles, rotation: number): BotSeatProfiles {
  const offset = ((rotation % 4) + 4) % 4;
  return [
    lineup[(4 - offset) % 4],
    lineup[(5 - offset) % 4],
    lineup[(6 - offset) % 4],
    lineup[(7 - offset) % 4],
  ];
}

/**
 * Expands each deterministic seed/lineup pair into four seat rotations so profile results are not
 * accidentally tied to East/South/West/North position. Duplicate profiles remain duplicated.
 */
export function buildBotCalibrationCases(
  seeds: readonly number[],
  lineups: readonly BotSeatProfiles[],
): BotCalibrationCase[] {
  const cases: BotCalibrationCase[] = [];
  for (const seed of seeds) {
    for (const lineup of lineups) {
      for (let rotation = 0; rotation < 4; rotation += 1) {
        cases.push({
          seed: Math.trunc(seed) >>> 0,
          rotation,
          profiles: rotateProfiles(lineup, rotation),
        });
      }
    }
  }
  return cases;
}
