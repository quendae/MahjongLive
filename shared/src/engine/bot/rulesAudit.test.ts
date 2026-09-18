import { describe, expect, it } from 'vitest';
import {
  RULE_REGRESSION_SEEDS,
  auditBotMatchSimulation,
  runDeterministicRulesAudit,
} from './rulesAudit';
import { simulateBotMatch } from './simulate';

function parseSeedOverride(): readonly number[] | undefined {
  const raw = process.env.RULE_AUDIT_SEEDS?.trim();
  if (!raw) return undefined;
  const seeds = raw
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));
  return seeds.length > 0 ? seeds : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

describe('deterministic full-match rules audit', () => {
  it('captures and audits every completed round while rejecting broken transition continuity', () => {
    const seed = 20260916;
    const result = simulateBotMatch(seed, 48, 1600);
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;

    expect(result.rounds).toHaveLength(result.roundCount);
    const record = auditBotMatchSimulation(seed, result);
    expect(record.roundCount).toBe(result.roundCount);
    expect(record.finalPoints.reduce((sum, value) => sum + value, 0)).toBe(100_000);

    expect(result.rounds.length).toBeGreaterThan(1);
    const next = result.rounds[1];
    const tamperedStart = [
      next.startPoints[0] + 1000,
      next.startPoints[1] - 1000,
      next.startPoints[2],
      next.startPoints[3],
    ] as const;
    const tampered = {
      ...result,
      rounds: [
        result.rounds[0],
        { ...next, startPoints: tamperedStart },
        ...result.rounds.slice(2),
      ],
    };
    expect(() => auditBotMatchSimulation(seed, tampered)).toThrow(/points changed between rounds/);
  }, 45_000);

  it('exports a stable non-empty regression seed list', () => {
    expect(RULE_REGRESSION_SEEDS.length).toBeGreaterThan(0);
    expect(new Set(RULE_REGRESSION_SEEDS).size).toBe(RULE_REGRESSION_SEEDS.length);
  });
});

const runSweep = process.env.RULE_AUDIT_RUN === '1' ? it : it.skip;

runSweep('runs deterministic regression seeds with edge-case coverage', () => {
  const seeds = parseSeedOverride() ?? RULE_REGRESSION_SEEDS;
  const maxRounds = positiveInteger(process.env.RULE_AUDIT_MAX_ROUNDS, 64);
  const maxActionsPerRound = positiveInteger(process.env.RULE_AUDIT_MAX_ACTIONS, 2048);
  const audit = runDeterministicRulesAudit({ seeds, maxRounds, maxActionsPerRound });

  console.log(`RULE_AUDIT ${JSON.stringify(audit)}`);
  expect(audit.records).toHaveLength(seeds.length);
  expect(audit.coverage.tsumo).toBeGreaterThan(0);
  expect(audit.coverage.ron).toBeGreaterThan(0);
  expect(audit.coverage.exhaustiveDraw).toBeGreaterThan(0);
  expect(audit.coverage.dealerRepeats).toBeGreaterThan(0);
  expect(audit.coverage.dealerAdvances).toBeGreaterThan(0);
  expect(audit.coverage.riichiDeclarations).toBeGreaterThan(0);
  expect(audit.coverage.calls).toBeGreaterThan(0);
  expect(audit.coverage.kans).toBeGreaterThan(0);

  const repeated = runDeterministicRulesAudit({
    seeds: [seeds[0]],
    maxRounds,
    maxActionsPerRound,
  });
  expect(repeated.records[0]).toEqual(audit.records.find((record) => record.seed === seeds[0]));
}, 240_000);
