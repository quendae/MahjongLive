import { describe, expect, it } from 'vitest';
import type { BotDifficulty } from './difficulty';
import * as botExports from './index';

type BotSeatProfiles = readonly [BotDifficulty, BotDifficulty, BotDifficulty, BotDifficulty];
type CalibrationCase = {
  seed: number;
  rotation: number;
  profiles: BotSeatProfiles;
};
type PlayerStats = {
  roundsPlayed: number;
  wins: number;
  dealIns: number;
  riichiDeclarations: number;
  calls: number;
};
type ProfiledMatchResult = {
  ok: boolean;
  roundCount: number;
  profiles?: BotSeatProfiles;
  playerStats?: readonly PlayerStats[];
  message?: string;
};
type CalibrationRecord = CalibrationCase & {
  roundCount: number;
  actionCount: number;
  placements: readonly {
    player: 0 | 1 | 2 | 3;
    place: 1 | 2 | 3 | 4;
    points: number;
  }[];
  playerStats: readonly PlayerStats[];
};
type ProfileSummary = {
  samples: number;
  seatExposure: readonly number[];
  placementCounts: readonly number[];
  averagePlacement: number;
  averageFinalPoints: number;
  roundsPlayed: number;
  wins: number;
  dealIns: number;
  riichiDeclarations: number;
  calls: number;
};
type CalibrationSummary = {
  matches: number;
  totalRounds: number;
  totalActions: number;
  averageRoundsPerMatch: number;
  averageActionsPerMatch: number;
  profiles: Record<BotDifficulty, ProfileSummary>;
};

type CalibrationApi = {
  buildBotCalibrationCases?: (
    seeds: readonly number[],
    lineups: readonly BotSeatProfiles[],
  ) => readonly CalibrationCase[];
  summarizeBotCalibration?: (records: readonly CalibrationRecord[]) => CalibrationSummary;
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

describe('profile-aware bot match simulation', () => {
  it('uses the requested seat profiles and returns per-seat calibration counters', () => {
    const simulate = botExports.simulateBotMatch as unknown as (
      seed: number,
      maxRounds: number,
      maxActionsPerRound: number,
      profiles: BotSeatProfiles,
    ) => ProfiledMatchResult;

    const result = simulate(20260916, 48, 1600, mixedLineup);
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;

    expect(result.profiles).toEqual(mixedLineup);
    expect(result.playerStats).toHaveLength(4);
    for (const stats of result.playerStats ?? []) {
      expect(stats.roundsPlayed).toBe(result.roundCount);
      expect(stats.wins).toBeGreaterThanOrEqual(0);
      expect(stats.dealIns).toBeGreaterThanOrEqual(0);
      expect(stats.riichiDeclarations).toBeGreaterThanOrEqual(0);
      expect(stats.calls).toBeGreaterThanOrEqual(0);
    }
  }, 45_000);
});

describe('bot calibration aggregation', () => {
  it('aggregates placements, points, seat exposure and play counters by profile', () => {
    expect(api.summarizeBotCalibration, 'calibration summary should be exported').toBeTypeOf('function');
    if (!api.summarizeBotCalibration || !api.buildBotCalibrationCases) return;

    const cases = api.buildBotCalibrationCases([77], [mixedLineup]);
    const playerStats: readonly PlayerStats[] = [0, 1, 2, 3].map(() => ({
      roundsPlayed: 8,
      wins: 2,
      dealIns: 1,
      riichiDeclarations: 3,
      calls: 4,
    }));
    const placements = [
      { player: 0 as const, place: 1 as const, points: 30_000 },
      { player: 1 as const, place: 2 as const, points: 27_000 },
      { player: 2 as const, place: 3 as const, points: 23_000 },
      { player: 3 as const, place: 4 as const, points: 20_000 },
    ];
    const records: CalibrationRecord[] = cases.map((entry) => ({
      ...entry,
      roundCount: 8,
      actionCount: 100,
      placements,
      playerStats,
    }));

    const summary = api.summarizeBotCalibration(records);
    expect(summary.matches).toBe(4);
    expect(summary.totalRounds).toBe(32);
    expect(summary.totalActions).toBe(400);
    expect(summary.averageRoundsPerMatch).toBe(8);
    expect(summary.averageActionsPerMatch).toBe(100);

    expect(summary.profiles.casual.samples).toBe(4);
    expect(summary.profiles.casual.seatExposure).toEqual([1, 1, 1, 1]);
    expect(summary.profiles.casual.placementCounts).toEqual([1, 1, 1, 1]);
    expect(summary.profiles.casual.averagePlacement).toBe(2.5);
    expect(summary.profiles.casual.averageFinalPoints).toBe(25_000);
    expect(summary.profiles.casual.roundsPlayed).toBe(32);
    expect(summary.profiles.casual.wins).toBe(8);
    expect(summary.profiles.casual.dealIns).toBe(4);
    expect(summary.profiles.casual.riichiDeclarations).toBe(12);
    expect(summary.profiles.casual.calls).toBe(16);

    expect(summary.profiles.standard.samples).toBe(4);
    expect(summary.profiles.standard.seatExposure).toEqual([1, 1, 1, 1]);
    expect(summary.profiles.expert.samples).toBe(8);
    expect(summary.profiles.expert.seatExposure).toEqual([2, 2, 2, 2]);
    expect(summary.profiles.expert.placementCounts).toEqual([2, 2, 2, 2]);
    expect(summary.profiles.expert.averagePlacement).toBe(2.5);
    expect(summary.profiles.expert.averageFinalPoints).toBe(25_000);
  });
});
