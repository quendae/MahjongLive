import { getLegalActions } from '../rules/round';
import type { LegalAction, PlayerIndex, RoundAction, RoundState } from '../rules/types';
import { createRNG } from '../wall/prng';
import { advanceMatch, createMatch } from './match';
import type { MatchAdvanceResult, MatchOptions, MatchState } from './types';

/**
 * Decisions that every orchestrator over the engine has to make identically. Single-player
 * (`engine/single/single.ts`) and the authoritative server room both call these, so seeding,
 * forced actions and reaction eligibility cannot drift into two rulesets.
 */

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];
const REACTION_ACTIONS = new Set<LegalAction['type']>(['ron', 'chi', 'pon', 'daiminkan']);

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Stable round seed so a serialized game, and a recorded history, always resume to the same wall. */
export function deriveSingleRoundSeed(baseSeed: number, roundNumber: number): number {
  return mix32((Math.trunc(baseSeed) ^ Math.imul(Math.max(1, Math.trunc(roundNumber)), 0x9e3779b9)) >>> 0);
}

/** First hand of a match from a base seed. */
export function createSeededMatch(seed: number, options: MatchOptions = {}): MatchState {
  return createMatch(createRNG(deriveSingleRoundSeed(seed, 1)), options);
}

/** Next hand from the same base seed, so `replayMatchHistory` reproduces the same game. */
export function advanceSeededMatch(state: MatchState, seed: number): MatchAdvanceResult {
  return advanceMatch(state, createRNG(deriveSingleRoundSeed(seed, state.roundNumber + 1)));
}

export function isReactionPhase(round: RoundState): boolean {
  return round.phase.kind === 'reactions' || round.phase.kind === 'kan-reactions';
}

/** Seats with a legal response in the current reaction window, computed once from full state. */
export function reactionEligibleSeats(round: RoundState): PlayerIndex[] {
  if (!isReactionPhase(round)) return [];
  return PLAYERS.filter((seat) =>
    getLegalActions(round, seat).some((action) => REACTION_ACTIONS.has(action.type)),
  );
}

/**
 * The action a seat has no choice about: its draw, and the single legal discard left after a
 * Riichi declaration. Returns null whenever the seat has a real decision to make.
 */
export function forcedSeatAction(round: RoundState, seat: PlayerIndex): RoundAction | null {
  if (round.phase.kind === 'awaiting-draw' && round.phase.player === seat) {
    return { type: 'draw', player: seat };
  }
  if (round.phase.kind !== 'awaiting-discard' || round.phase.player !== seat) return null;
  const legal = getLegalActions(round, seat);
  const optional = legal.filter((action) => action.type !== 'discard');
  const discard = legal.find((action) => action.type === 'discard');
  if (optional.length === 0 && discard?.type === 'discard' && discard.tileIds.length === 1) {
    return { type: 'discard', player: seat, tileId: discard.tileIds[0] };
  }
  return null;
}
