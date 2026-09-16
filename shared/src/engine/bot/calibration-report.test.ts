import { describe, expect, it } from 'vitest';
import type { BotDifficulty } from './difficulty';
import * as botExports from './index';

type ProfileSummary = {
  samples: number;
  seatExposure: readonly [number, number, number, number];
  placementCounts: readonly [number, number, number, number];
  averagePlacement: number;
  averageFinalPoints: number;
  roundsPlayed: number;
  wins: number;
  dealIns: number;
  riichiDeclarations: number;
  calls: number;
};
type Summary = {
  matches: number;
  totalRounds: number;
  totalActions: number;
  averageRoundsPerMatch: number;
  averageActionsPerMatch: number;
  profiles: Record<BotDifficulty, ProfileSummary>;
};
type Api = { formatBotCalibrationReport?: (summary: Summary) => string };

const api = botExports as unknown as Api;

function profile(samples: number, placement: number, points: number): ProfileSummary {
  return {
    samples,
    seatExposure: [1, 1, 1, 1],
    placementCounts: [1, 1, 1, 1],
    averagePlacement: placement,
    averageFinalPoints: points,
    roundsPlayed: 32,
    wins: 8,
    dealIns: 4,
    riichiDeclarations: 12,
    calls: 16,
  };
}

describe('bot calibration report', () => {
  it('prints match totals and normalized per-round rates so unequal sample counts stay comparable', () => {
    expect(api.formatBotCalibrationReport, 'report formatter should be exported').toBeTypeOf('function');
    if (!api.formatBotCalibrationReport) return;

    const summary: Summary = {
      matches: 4,
      totalRounds: 32,
      totalActions: 400,
      averageRoundsPerMatch: 8,
      averageActionsPerMatch: 100,
      profiles: {
        casual: profile(4, 2.75, 23_500),
        standard: profile(4, 2.5, 25_000),
        expert: profile(8, 2.25, 26_500),
      },
    };

    const report = api.formatBotCalibrationReport(summary);
    expect(report).toContain('Mahjong Live bot calibration');
    expect(report).toContain('Matches: 4');
    expect(report).toContain('Rounds: 32');
    expect(report).toContain('Casual');
    expect(report).toContain('Standard');
    expect(report).toContain('Expert');
    expect(report).toContain('23,500');
    expect(report).toContain('26,500');
    expect(report).toContain('Win%');
    expect(report).toContain('Deal-in%');
    expect(report).toContain('Riichi%');
    expect(report).toContain('Calls/rnd');
    // 8 wins / 32 player-rounds = 25%; 4 deal-ins = 12.5%; 12 Riichi = 37.5%; 16 calls = 0.50/round.
    expect(report).toContain('25.0%');
    expect(report).toContain('12.5%');
    expect(report).toContain('37.5%');
    expect(report).toContain('0.50');
  });
});
