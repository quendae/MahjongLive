import { describe, expect, it } from 'vitest';
import { formatBotCalibrationReport, runBotCalibration } from './calibration';
import type { BotSeatProfiles } from './calibration';

const enabled = process.env.BOT_BENCHMARK_RUN === '1';
const benchmarkIt = enabled ? it : it.skip;
const lineup = ['casual', 'standard', 'expert', 'expert'] as const satisfies BotSeatProfiles;

function parseNumberList(value: string | undefined, fallback: readonly number[]): number[] {
  if (!value) return [...fallback];
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.trunc(entry));
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

describe('bot calibration benchmark', () => {
  benchmarkIt('runs deterministic full-match profile calibration and prints the report', () => {
    const seeds = parseNumberList(process.env.BOT_BENCHMARK_SEEDS, [20260916, 20260917]);
    const rotations = parseNumberList(process.env.BOT_BENCHMARK_ROTATIONS, [0, 1, 2, 3]);
    const maxRounds = positiveInteger(process.env.BOT_BENCHMARK_MAX_ROUNDS, 64);
    const maxActionsPerRound = positiveInteger(process.env.BOT_BENCHMARK_MAX_ACTIONS, 2048);

    const result = runBotCalibration({
      seeds,
      lineups: [lineup],
      rotations,
      maxRounds,
      maxActionsPerRound,
    });

    expect(result.records).toHaveLength(seeds.length * new Set(rotations.map((value) => ((value % 4) + 4) % 4)).size);
    expect(result.summary.matches).toBe(result.records.length);
    expect(result.summary.totalRounds).toBeGreaterThan(0);
    expect(result.summary.totalActions).toBeGreaterThan(result.summary.totalRounds);

    console.log(`\n${formatBotCalibrationReport(result.summary)}\n`);
  }, 300_000);
});
