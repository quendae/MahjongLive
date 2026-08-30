import { describe, expect, it } from 'vitest';
import { createSingleGame, driveSingleGame, singleBotDifficulty } from './single';
import type { SingleGameState } from './types';

describe('single-player difficulty persistence', () => {
  it('stores an explicitly selected difficulty in the serializable game state', () => {
    const state = createSingleGame(91234, 0, 'standard');
    expect(state.botDifficulty).toBe('standard');
    expect(JSON.parse(JSON.stringify(state)).botDifficulty).toBe('standard');
  });

  it('migrates a legacy save without difficulty to Expert without changing deterministic play', () => {
    const modern = createSingleGame(91235, 0, 'expert');
    const { botDifficulty: _removed, ...legacyFields } = modern;
    const legacy = legacyFields as SingleGameState;

    expect(singleBotDifficulty(legacy)).toBe('expert');
    const resumed = driveSingleGame(legacy);
    const explicit = driveSingleGame(modern);
    expect(resumed.ok).toBe(true);
    expect(explicit.ok).toBe(true);
    if (!resumed.ok || !explicit.ok) return;
    expect(resumed.state.botDifficulty).toBe('expert');
    expect(resumed.state.match).toEqual(explicit.state.match);
    expect(resumed.prompt).toEqual(explicit.prompt);
  });
});
