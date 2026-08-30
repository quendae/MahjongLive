import { chooseBotDecision } from '../bot/bot';
import { advanceMatch, createMatch } from '../match/match';
import { applyAction, getLegalActions } from '../rules/round';
import type {
  ApplyActionResult,
  PlayerIndex,
  RoundAction,
  RoundEvent,
  RoundState,
} from '../rules/types';
import { createRNG } from '../wall/prng';
import type {
  HumanDecision,
  HumanPrompt,
  SingleActionTrace,
  SingleDriveFailure,
  SingleDriveResult,
  SingleDriveSuccess,
  SingleGameState,
} from './types';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];
const DEFAULT_SAFETY_CAP = 1024;

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Stable round seed so a serialized single-player state can always resume deterministically. */
export function deriveSingleRoundSeed(baseSeed: number, roundNumber: number): number {
  return mix32((Math.trunc(baseSeed) ^ Math.imul(Math.max(1, Math.trunc(roundNumber)), 0x9e3779b9)) >>> 0);
}

export function createSingleGame(seed: number, humanSeat: PlayerIndex = 0): SingleGameState {
  const normalizedSeed = Math.trunc(seed) >>> 0;
  return {
    seed: normalizedSeed,
    humanSeat,
    match: createMatch(createRNG(deriveSingleRoundSeed(normalizedSeed, 1))),
  };
}

function humanTurnPrompt(state: SingleGameState): HumanPrompt | null {
  const round = state.match.round;
  if (state.match.status === 'ended') {
    return { kind: 'match-ended', result: state.match.result! };
  }
  if (round.phase.kind === 'ended') {
    return { kind: 'round-ended', result: round.phase.result };
  }

  const human = state.humanSeat;
  if (round.phase.kind === 'reactions' || round.phase.kind === 'kan-reactions') {
    const legalActions = getLegalActions(round, human);
    return legalActions.length > 0
      ? { kind: 'reaction', player: human, legalActions, canPass: true }
      : null;
  }

  if (round.phase.kind === 'awaiting-discard' && round.phase.player === human) {
    const legalActions = getLegalActions(round, human);
    const optional = legalActions.filter((action) => action.type !== 'discard');
    const discard = legalActions.find((action) => action.type === 'discard');
    const forcedDiscard = discard?.type === 'discard' && discard.tileIds.length === 1 && optional.length === 0;
    return forcedDiscard
      ? null
      : { kind: 'turn', player: human, legalActions };
  }

  return null;
}

function success(
  state: SingleGameState,
  prompt: HumanPrompt,
  events: readonly RoundEvent[],
  trace: readonly SingleActionTrace[],
): SingleDriveSuccess {
  return { ok: true, state, prompt, events, trace };
}

function failure(
  state: SingleGameState,
  code: SingleDriveFailure['code'],
  message: string,
  events: readonly RoundEvent[],
  trace: readonly SingleActionTrace[],
): SingleDriveFailure {
  return { ok: false, state, code, message, events, trace };
}

function withRound(state: SingleGameState, round: RoundState): SingleGameState {
  return { ...state, match: { ...state.match, round } };
}

function commitAction(
  state: SingleGameState,
  action: RoundAction,
  source: SingleActionTrace['source'],
  events: RoundEvent[],
  trace: SingleActionTrace[],
): { ok: true; state: SingleGameState } | { ok: false; result: ApplyActionResult } {
  const result = applyAction(state.match.round, action);
  if (!result.ok) return { ok: false, result };
  events.push(...result.events);
  trace.push({ source, ...(action.type !== 'resolve-reactions' ? { player: action.player } : {}), action });
  return { ok: true, state: withRound(state, result.state) };
}

function forcedHumanAutomaticAction(state: SingleGameState): RoundAction | null {
  const round = state.match.round;
  const human = state.humanSeat;
  if (round.phase.kind === 'awaiting-draw' && round.phase.player === human) {
    return { type: 'draw', player: human };
  }
  if (round.phase.kind !== 'awaiting-discard' || round.phase.player !== human) return null;
  const legal = getLegalActions(round, human);
  const optional = legal.filter((action) => action.type !== 'discard');
  const discard = legal.find((action) => action.type === 'discard');
  if (optional.length === 0 && discard?.type === 'discard' && discard.tileIds.length === 1) {
    return { type: 'discard', player: human, tileId: discard.tileIds[0] };
  }
  return null;
}

function processBotReactions(
  state: SingleGameState,
  events: RoundEvent[],
  trace: SingleActionTrace[],
): { ok: true; state: SingleGameState } | { ok: false; message: string; state: SingleGameState } {
  let working = state;
  const phase = working.match.round.phase;
  if (phase.kind !== 'reactions' && phase.kind !== 'kan-reactions') {
    return { ok: false, state: working, message: 'Bot reaction processing requires a reaction phase' };
  }

  for (const player of PLAYERS) {
    if (player === working.humanSeat) continue;
    const decision = chooseBotDecision(working.match.round, player);
    if (decision.type === 'pass') continue;
    const action = decision.action;
    if (action.type !== 'ron' && action.type !== 'chi' && action.type !== 'pon' && action.type !== 'daiminkan') {
      return { ok: false, state: working, message: `Bot ${player} returned non-reaction ${action.type}` };
    }
    const committed = commitAction(working, action, 'bot', events, trace);
    if (!committed.ok) {
      return {
        ok: false,
        state: working,
        message: `Bot ${player} produced rejected ${action.type}: ${committed.result.error.code}`,
      };
    }
    working = committed.state;
  }

  const resolved = commitAction(working, { type: 'resolve-reactions' }, 'system', events, trace);
  if (!resolved.ok) {
    return {
      ok: false,
      state: working,
      message: `Reaction resolution failed: ${resolved.result.error.code}`,
    };
  }
  return { ok: true, state: resolved.state };
}

/**
 * Runs every non-choice transition: draws, bot turns, bot-only reaction windows and forced
 * Riichi tsumogiri. It stops before any meaningful human decision and at every round result.
 */
export function driveSingleGame(
  state: SingleGameState,
  safetyCap = DEFAULT_SAFETY_CAP,
): SingleDriveResult {
  let working = state;
  const events: RoundEvent[] = [];
  const trace: SingleActionTrace[] = [];

  for (let step = 0; step < safetyCap; step++) {
    const prompt = humanTurnPrompt(working);
    if (prompt) return success(working, prompt, events, trace);

    const round = working.match.round;
    if (round.phase.kind === 'reactions' || round.phase.kind === 'kan-reactions') {
      const reacted = processBotReactions(working, events, trace);
      if (!reacted.ok) {
        return failure(reacted.state, 'AUTOMATION_STALLED', reacted.message, events, trace);
      }
      working = reacted.state;
      continue;
    }

    const automaticHuman = forcedHumanAutomaticAction(working);
    if (automaticHuman) {
      const committed = commitAction(working, automaticHuman, 'system', events, trace);
      if (!committed.ok) {
        return failure(
          working,
          'AUTOMATION_STALLED',
          `Forced human action was rejected: ${committed.result.error.code}`,
          events,
          trace,
        );
      }
      working = committed.state;
      continue;
    }

    let actor: PlayerIndex | null = null;
    if (round.phase.kind === 'awaiting-draw' || round.phase.kind === 'awaiting-discard') {
      actor = round.phase.player;
    }
    if (actor === null || actor === working.humanSeat) {
      return failure(working, 'AUTOMATION_STALLED', 'No automatic transition is available', events, trace);
    }

    const decision = chooseBotDecision(round, actor);
    if (decision.type === 'pass') {
      return failure(working, 'AUTOMATION_STALLED', `Bot ${actor} passed during its own turn`, events, trace);
    }
    const committed = commitAction(working, decision.action, 'bot', events, trace);
    if (!committed.ok) {
      return failure(
        working,
        'AUTOMATION_STALLED',
        `Bot ${actor} action ${decision.action.type} rejected: ${committed.result.error.code}`,
        events,
        trace,
      );
    }
    working = committed.state;
  }

  return failure(working, 'SAFETY_CAP', `Automation exceeded ${safetyCap} actions`, events, trace);
}

function isHumanReactionAction(action: RoundAction): boolean {
  return action.type === 'ron' || action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan';
}

/** Applies one explicit human choice and then resumes automation until the next human prompt. */
export function applyHumanDecision(
  state: SingleGameState,
  decision: HumanDecision,
  safetyCap = DEFAULT_SAFETY_CAP,
): SingleDriveResult {
  const prompt = humanTurnPrompt(state);
  const events: RoundEvent[] = [];
  const trace: SingleActionTrace[] = [];
  if (!prompt || (prompt.kind !== 'turn' && prompt.kind !== 'reaction')) {
    return failure(state, 'ILLEGAL_HUMAN_ACTION', 'The game is not waiting for a human decision', events, trace);
  }

  let working = state;
  if (decision.type === 'pass') {
    if (prompt.kind !== 'reaction') {
      return failure(state, 'INVALID_HUMAN_PASS', 'Pass is only valid during a reaction prompt', events, trace);
    }
  } else {
    const action = decision.action;
    if (action.type === 'resolve-reactions' || action.player !== state.humanSeat) {
      return failure(state, 'ILLEGAL_HUMAN_ACTION', 'Action does not belong to the human seat', events, trace);
    }
    if (prompt.kind === 'reaction' && !isHumanReactionAction(action)) {
      return failure(state, 'ILLEGAL_HUMAN_ACTION', 'Only Ron/Chi/Pon/Daiminkan or pass are valid reactions', events, trace);
    }
    const committed = commitAction(working, action, 'human', events, trace);
    if (!committed.ok) {
      return failure(
        state,
        'ILLEGAL_HUMAN_ACTION',
        `${committed.result.error.code}: ${committed.result.error.message}`,
        events,
        trace,
      );
    }
    working = committed.state;
  }

  // A human reaction (including pass) completes only their response. Other seats still answer
  // against the same phase, then the reducer resolves priority exactly once.
  if (prompt.kind === 'reaction') {
    const reacted = processBotReactions(working, events, trace);
    if (!reacted.ok) {
      return failure(reacted.state, 'AUTOMATION_STALLED', reacted.message, events, trace);
    }
    working = reacted.state;
  }

  const driven = driveSingleGame(working, safetyCap);
  return driven.ok
    ? {
        ...driven,
        events: [...events, ...driven.events],
        trace: [...trace, ...driven.trace],
      }
    : {
        ...driven,
        events: [...events, ...driven.events],
        trace: [...trace, ...driven.trace],
      };
}

/** Starts the next hand after the UI/user has acknowledged the completed-hand result. */
export function continueSingleGame(
  state: SingleGameState,
  safetyCap = DEFAULT_SAFETY_CAP,
): SingleDriveResult {
  const events: RoundEvent[] = [];
  const trace: SingleActionTrace[] = [];
  if (state.match.status === 'ended') {
    return success(state, { kind: 'match-ended', result: state.match.result! }, events, trace);
  }
  if (state.match.round.phase.kind !== 'ended') {
    return failure(state, 'ROUND_NOT_ENDED', 'The current hand is still in progress', events, trace);
  }

  const nextRoundNumber = state.match.roundNumber + 1;
  const advanced = advanceMatch(
    state.match,
    createRNG(deriveSingleRoundSeed(state.seed, nextRoundNumber)),
  );
  if (!advanced.ok) {
    return failure(state, 'ROUND_NOT_ENDED', advanced.message, events, trace);
  }
  const working = { ...state, match: advanced.state };
  if (advanced.state.status === 'ended') {
    return success(working, { kind: 'match-ended', result: advanced.state.result! }, events, trace);
  }
  return driveSingleGame(working, safetyCap);
}
