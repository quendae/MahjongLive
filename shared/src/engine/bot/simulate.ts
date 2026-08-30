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

function isReactionAction(action: RoundAction): boolean {
  return action.type === 'ron' || action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan';
}

/** QA helper: plays one complete round with four deterministic bots using the production reducer. */
export function simulateBotRound(seed: number, maxActions = 2048): BotRoundSimulation {
  let state = createRound(createRNG(Math.trunc(seed) >>> 0));
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
