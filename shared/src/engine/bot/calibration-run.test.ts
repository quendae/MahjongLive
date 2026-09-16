import { describe, expect, it } from 'vitest';
import type { BotDifficulty } from './difficulty';
import * as botExports from './index';

type BotSeatProfiles = readonly [BotDifficulty, BotDifficulty, BotDifficulty, BotDifficulty];
type CalibrationRunResult = {
  records: readonly {
    seed: number;
    rotation: number;
    profiles: BotSeatProfiles;
    roundCount: number;
    actionCount: number;
    placements: readonly unknown[];
    playerStats: readonly unknown[];
  }[];
  summary: {
    matches: number;
    totalRounds: number;
    totalActions: number;
  };
};

type CalibrationApi = {
  runBotCalibration?: (options: {
    seeds: readonly number[];
    lineups: readonly BotSeatProfiles[];
    rotations?: readonly number[];
    maxRounds?: number;
    maxActionsPerRound?: number;
  }) => CalibrationRunResult;
};

const api = botExports as unknown as CalibrationApi;
const lineup = ['casual', 'standard', 'expert', 'expert'] as const satisfies BotSeatProfiles;

describe('deterministic bot calibration runner', () => {
  it('executes a selected real seat rotation and returns completed benchmark records', () => {
    expect(api.runBotCalibration, 'calibration runner should be exported').toBeTypeOf('function');
    if (!api.runBotCalibration) return;

    const result = api.runBotCalibration({
      seeds: [20260916],
      lineups: [lineup],
      rotations: [0],
      maxRounds: 48,
      maxActionsPerRound: 1600,
    });

    expect(result.records).toHaveLength(1);
    expect(result.summary.matches).toBe(1);
    expect(result.summary.totalRounds).toBeGreaterThan(0);
    expect(result.summary.totalActions).toBeGreaterThan(result.summary.totalRounds);

    const record = result.records[0];
    expect(record.seed).toBe(20260916);
    expect(record.rotation).toBe(0);
    expect(record.profiles).toEqual(lineup);
    expect(record.placements).toHaveLength(4);
    expect(record.playerStats).toHaveLength(4);
  }, 45_000);
});
