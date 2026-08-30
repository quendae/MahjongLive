import { describe, expect, it } from 'vitest';
import { simulateBotMatch, simulateBotRound } from './simulate';

describe('bot-only round simulation', () => {
  it('finishes deterministic rounds without illegal actions', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const result = simulateBotRound(seed, 1600);
      expect(result.ok, `seed ${seed}: ${result.ok ? '' : result.message}`).toBe(true);
      if (!result.ok) continue;
      expect(result.state.phase.kind).toBe('ended');
      expect(result.actionCount).toBeGreaterThan(0);
      expect(result.actionCount).toBeLessThan(1600);
    }
  });

  it('is replay-deterministic for the same seed', () => {
    const a = simulateBotRound(424242, 1600);
    const b = simulateBotRound(424242, 1600);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.actionCount).toBe(b.actionCount);
    expect(a.state.phase).toEqual(b.state.phase);
    expect(a.state.players.map((player) => player.points)).toEqual(
      b.state.players.map((player) => player.points),
    );
  });
});

describe('bot-only hanchan integration', () => {
  it('plays a complete match through scoring, round transitions and final ranking', () => {
    const result = simulateBotMatch(20260830, 48, 1600);
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    if (!result.ok) return;

    expect(result.state.status).toBe('ended');
    expect(result.state.result).toBeDefined();
    expect(result.state.result?.placements).toHaveLength(4);
    expect(result.state.result?.placements.map((entry) => entry.place)).toEqual([1, 2, 3, 4]);
    expect(result.roundCount).toBeGreaterThanOrEqual(4);
    expect(result.roundCount).toBeLessThanOrEqual(48);
    expect(result.actionCount).toBeGreaterThan(result.roundCount);

    const placementPlayers = result.state.result!.placements.map((entry) => entry.player);
    expect(new Set(placementPlayers).size).toBe(4);
  }, 30_000);
});
