import { describe, expect, it } from 'vitest';
import { simulateBotRound } from './simulate';

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
