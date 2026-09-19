import { describe, expect, it } from 'vitest';
import { advanceMatch, createMatch } from '../match/match';
import type { MatchState } from '../match/types';
import { createSingleGame, driveSingleGame } from '../single/single';
import type { SingleGameState } from '../single/types';
import { createRNG } from '../wall/prng';
import * as rulesApi from './index';
import type { RoundEndResult } from './types';

const exhaustive: RoundEndResult = {
  type: 'exhaustive-draw',
  tenpaiPlayers: [],
  notenPayments: [0, 0, 0, 0],
};

type ProfiledMatchState = MatchState & {
  ruleProfileId?: string;
  round: MatchState['round'] & { ruleProfileId?: string };
};

function withEndedRound(state: MatchState): MatchState {
  return {
    ...state,
    round: {
      ...state.round,
      phase: { kind: 'ended', result: exhaustive },
    },
  };
}

describe('rule-profile plumbing', () => {
  it('defines Standard as the explicit form of current production rules', () => {
    expect((rulesApi as unknown as { STANDARD_RULE_PROFILE?: unknown }).STANDARD_RULE_PROFILE).toEqual({
      id: 'standard',
      kanDoraTiming: 'immediate',
      nagashiMangan: true,
      bankruptcyBelowZero: true,
      dealerYame: true,
      westRoundExtension: true,
    });

    const implicit = createMatch(createRNG(81001)) as ProfiledMatchState;
    const explicit = (createMatch as unknown as (
      rng: ReturnType<typeof createRNG>,
      options: { ruleProfileId: 'standard' },
    ) => MatchState)(createRNG(81001), { ruleProfileId: 'standard' }) as ProfiledMatchState;

    expect(implicit.ruleProfileId).toBe('standard');
    expect(implicit.round.ruleProfileId).toBe('standard');
    expect(implicit).toEqual(explicit);
  });

  it('carries the profile through match round advancement', () => {
    const rng = createRNG(81002);
    const state = (createMatch as unknown as (
      rng: ReturnType<typeof createRNG>,
      options: { ruleProfileId: 'standard' },
    ) => MatchState)(rng, { ruleProfileId: 'standard' });
    const advanced = advanceMatch(withEndedRound(state), rng);

    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    const profiled = advanced.state as ProfiledMatchState;
    expect(advanced.startedNextRound).toBe(true);
    expect(profiled.ruleProfileId).toBe('standard');
    expect(profiled.round.ruleProfileId).toBe('standard');
  });

  it('migrates a legacy single-player save without a profile without changing deterministic play', () => {
    const modern = (createSingleGame as unknown as (
      seed: number,
      humanSeat: 0,
      difficulty: 'expert',
      ruleProfileId: 'standard',
    ) => SingleGameState)(81003, 0, 'expert', 'standard');
    const legacy = JSON.parse(JSON.stringify(modern)) as SingleGameState & {
      match: ProfiledMatchState;
    };
    delete legacy.match.ruleProfileId;
    delete legacy.match.round.ruleProfileId;

    const resumed = driveSingleGame(legacy);
    const explicit = driveSingleGame(modern);
    expect(resumed.ok).toBe(true);
    expect(explicit.ok).toBe(true);
    if (!resumed.ok || !explicit.ok) return;

    const resumedMatch = resumed.state.match as ProfiledMatchState;
    expect(resumedMatch.ruleProfileId).toBe('standard');
    expect(resumedMatch.round.ruleProfileId).toBe('standard');
    expect(resumed.state.match).toEqual(explicit.state.match);
    expect(resumed.prompt).toEqual(explicit.prompt);
  });
});
