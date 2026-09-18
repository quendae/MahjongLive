import { describe, expect, it } from 'vitest';
import { simulateBotMatch } from './simulate';

type TracedRound = {
  endPoints: readonly [number, number, number, number];
  endRiichiSticks: number;
};

describe('deterministic full-match rules audit', () => {
  it('captures every completed round with a conserved point ledger', () => {
    const result = simulateBotMatch(20260916, 48, 1600);
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;

    const traced = result as typeof result & { rounds?: readonly TracedRound[] };
    expect(Array.isArray(traced.rounds), 'full-match simulation should expose completed round traces').toBe(true);
    expect(traced.rounds).toHaveLength(result.roundCount);

    for (const round of traced.rounds ?? []) {
      const playerPoints = round.endPoints.reduce((sum, value) => sum + value, 0);
      expect(playerPoints + round.endRiichiSticks * 1000).toBe(100_000);
    }
  }, 45_000);
});
