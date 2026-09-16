import { describe, expect, it } from 'vitest';
import type { BotDifficulty } from './difficulty';
import * as botExports from './index';

type BotSeatProfiles = readonly [BotDifficulty, BotDifficulty, BotDifficulty, BotDifficulty];
type CalibrationCase = {
  seed: number;
  rotation: number;
  profiles: BotSeatProfiles;
};

type CalibrationApi = {
  buildBotCalibrationCases?: (
    seeds: readonly number[],
    lineups: readonly BotSeatProfiles[],
  ) => readonly CalibrationCase[];
};

const api = botExports as unknown as CalibrationApi;
const mixedLineup = ['casual', 'standard', 'expert', 'expert'] as const satisfies BotSeatProfiles;

describe('bot calibration seat rotation', () => {
  it('rotates every profile across seats without seat-position bias', () => {
    expect(api.buildBotCalibrationCases, 'calibration case builder should be exported').toBeTypeOf('function');
    if (!api.buildBotCalibrationCases) return;

    const cases = api.buildBotCalibrationCases([20260916], [mixedLineup]);
    expect(cases).toHaveLength(4);
    expect(cases.map((entry) => entry.rotation)).toEqual([0, 1, 2, 3]);
    expect(new Set(cases.map((entry) => entry.seed))).toEqual(new Set([20260916]));

    const exposure: Record<BotDifficulty, number[]> = {
      casual: [0, 0, 0, 0],
      standard: [0, 0, 0, 0],
      expert: [0, 0, 0, 0],
    };

    for (const entry of cases) {
      entry.profiles.forEach((profile, seat) => {
        exposure[profile][seat] += 1;
      });
    }

    expect(exposure.casual).toEqual([1, 1, 1, 1]);
    expect(exposure.standard).toEqual([1, 1, 1, 1]);
    expect(exposure.expert).toEqual([2, 2, 2, 2]);
  });
});
