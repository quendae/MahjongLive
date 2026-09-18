import { describe, expect, it } from 'vitest';
import * as botExports from './index';
import { simulateBotMatch } from './simulate';

type RulesAuditApi = {
  RULE_REGRESSION_SEEDS?: readonly number[];
  auditBotMatchSimulation?: (seed: number, simulation: ReturnType<typeof simulateBotMatch>) => unknown;
  runDeterministicRulesAudit?: (options?: {
    seeds?: readonly number[];
    maxRounds?: number;
    maxActionsPerRound?: number;
  }) => unknown;
};

const auditApi = botExports as unknown as RulesAuditApi;

describe('deterministic full-match rules audit', () => {
  it('captures every completed round with a conserved point ledger', () => {
    const result = simulateBotMatch(20260916, 48, 1600);
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;

    expect(result.rounds).toHaveLength(result.roundCount);
    for (const round of result.rounds) {
      const playerPoints = round.endPoints.reduce((sum, value) => sum + value, 0);
      expect(playerPoints + round.endRiichiSticks * 1000).toBe(100_000);
    }
  }, 45_000);

  it('exports a stable seed list plus reusable match and sweep auditors', () => {
    expect(auditApi.RULE_REGRESSION_SEEDS, 'regression seed list should be exported').toBeDefined();
    expect(auditApi.RULE_REGRESSION_SEEDS?.length ?? 0).toBeGreaterThan(0);
    expect(auditApi.auditBotMatchSimulation, 'match invariant auditor should be exported').toBeTypeOf('function');
    expect(auditApi.runDeterministicRulesAudit, 'seed sweep auditor should be exported').toBeTypeOf('function');
  });
});
