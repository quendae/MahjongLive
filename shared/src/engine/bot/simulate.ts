import { advanceMatch, createMatch } from '../match/match';
import type { MatchState } from '../match/types';
import { applyAction, createRound } from '../rules/round';
import type { PlayerIndex, RoundAction, RoundState } from '../rules/types';
import { createRNG } from '../wall/prng';
import { chooseBotDecision } from './bot';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];

export type BotRoundSimulation =
  | {
      ok: true;
      state: RoundState;
      actionCount: number;
    }
  | {
      ok: false;
      state: RoundState;
      actionCount: number;
      message: string;
    };

export type BotMatchSimulation =
  | {
      ok: true;
      state: MatchState;
      roundCount: number;
      actionCount: number;
    }
  | {
      ok: false;
      state: MatchState;
      roundCount: number;
      actionCount: number;
      message: string;
    };

function isReactionAction(action: RoundAction): boolean {
  return action.type === 'ron' || action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan';
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function matchRoundSeed(baseSeed: number, roundNumber: number): number {
  return mix32((Math.trunc(baseSeed) ^ Math.imul(Math.max(1, roundNumber), 0x9e3779b9)) >>> 0);
}

/** QA helper: plays one already-created round with four production bots. */
export function simulateBotRoundState(
  initialState: RoundState,
  maxActions = 2048,
): BotRoundSimulation {
  let state = initialState;
  let actionCount = 0;

  while (actionCount < maxActions) {
    if (state.phase.kind === 'ended') return { ok: true, state, actionCount };

    if (state.phase.kind === 'reactions' || state.phase.kind === 'kan-reactions') {
      for (const player of PLAYERS) {
        const decision = chooseBotDecision(state, player);
        if (decision.type === 'pass') continue;
        if (!isReactionAction(decision.action)) {
          return {
            ok: false,
            state,
            actionCount,
            message: `Bot ${player} returned ${decision.action.type} during reactions`,
          };
        }
        const claimed = applyAction(state, decision.action);
        actionCount += 1;
        if (!claimed.ok) {
          return {
            ok: false,
            state,
            actionCount,
            message: `Rejected bot reaction ${decision.action.type}: ${claimed.error.code}`,
          };
        }
        state = claimed.state;
      }

      const resolved = applyAction(state, { type: 'resolve-reactions' });
      actionCount += 1;
      if (!resolved.ok) {
        return {
          ok: false,
          state,
          actionCount,
          message: `Reaction resolution failed: ${resolved.error.code}`,
        };
      }
      state = resolved.state;
      continue;
    }

    const actor = state.phase.player;
    const decision = chooseBotDecision(state, actor);
    if (decision.type === 'pass') {
      return {
        ok: false,
        state,
        actionCount,
        message: `Bot ${actor} passed during own ${state.phase.kind}`,
      };
    }
    const applied = applyAction(state, decision.action);
    actionCount += 1;
    if (!applied.ok) {
      return {
        ok: false,
        state,
        actionCount,
        message: `Rejected bot ${decision.action.type}: ${applied.error.code}`,
      };
    }
    state = applied.state;
  }

  return {
    ok: false,
    state,
    actionCount,
    message: `Bot simulation exceeded ${maxActions} actions`,
  };
}

/** QA helper: creates and plays one complete deterministic bot round. */
export function simulateBotRound(seed: number, maxActions = 2048): BotRoundSimulation {
  return simulateBotRoundState(createRound(createRNG(Math.trunc(seed) >>> 0)), maxActions);
}

/**
 * Plays a complete East-South match (including West extension when required) with four bots.
 * This intentionally crosses every production boundary: reducer -> scoring -> round end -> match
 * advancement -> next wall. It is primarily a regression/stress helper, not gameplay UI code.
 */
export function simulateBotMatch(
  seed: number,
  maxRounds = 64,
  maxActionsPerRound = 2048,
): BotMatchSimulation {
  const normalizedSeed = Math.trunc(seed) >>> 0;
  let match = createMatch(createRNG(matchRoundSeed(normalizedSeed, 1)));
  let actionCount = 0;
  let roundCount = 0;

  while (roundCount < maxRounds) {
    const simulated = simulateBotRoundState(match.round, maxActionsPerRound);
    actionCount += simulated.actionCount;
    roundCount += 1;
    match = { ...match, round: simulated.state };

    if (!simulated.ok) {
      return {
        ok: false,
        state: match,
        roundCount,
        actionCount,
        message: `Round ${roundCount} failed: ${simulated.message}`,
      };
    }

    const nextRoundNumber = match.roundNumber + 1;
    const advanced = advanceMatch(
      match,
      createRNG(matchRoundSeed(normalizedSeed, nextRoundNumber)),
    );
    if (!advanced.ok) {
      return {
        ok: false,
        state: match,
        roundCount,
        actionCount,
        message: `Match advance after round ${roundCount} failed: ${advanced.error}`,
      };
    }
    match = advanced.state;
    if (match.status === 'ended') {
      return { ok: true, state: match, roundCount, actionCount };
    }
  }

  return {
    ok: false,
    state: match,
    roundCount,
    actionCount,
    message: `Bot match exceeded ${maxRounds} rounds`,
  };
}
