import { getLegalActions } from '../rules/round';
import type { PlayerIndex, RoundAction, RoundState } from '../rules/types';
import { chooseBotDecision, evaluateDiscard } from './bot';
import type { BotDecision, DiscardEvaluation } from './bot';

export type BotDifficulty = 'casual' | 'standard' | 'expert';

export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'expert';

export function normalizeBotDifficulty(
  value: unknown,
  fallback: BotDifficulty = DEFAULT_BOT_DIFFICULTY,
): BotDifficulty {
  return value === 'casual' || value === 'standard' || value === 'expert' ? value : fallback;
}

function riichiOpponentCount(state: RoundState, player: PlayerIndex): number {
  return state.players.reduce((count, candidate, index) =>
    index !== player && candidate.riichi !== 'none' ? count + 1 : count,
  0);
}

function compareStandard(a: DiscardEvaluation, b: DiscardEvaluation, folding: boolean): number {
  if (folding && a.danger !== b.danger) return a.danger - b.danger;
  if (a.shanten !== b.shanten) return a.shanten - b.shanten;
  if (!folding && a.danger !== b.danger) return a.danger - b.danger;
  if (a.doraCost !== b.doraCost) return a.doraCost - b.doraCost;
  if (a.keepValue !== b.keepValue) return a.keepValue - b.keepValue;
  return a.tileId - b.tileId;
}

function chooseProfileDiscardId(
  state: RoundState,
  player: PlayerIndex,
  tileIds: readonly number[],
  difficulty: Exclude<BotDifficulty, 'expert'>,
): number | null {
  const evaluations = tileIds
    .map((tileId) => evaluateDiscard(state, player, tileId))
    .filter((entry): entry is DiscardEvaluation => entry !== null);
  if (evaluations.length === 0) return tileIds[0] ?? null;

  if (difficulty === 'casual') {
    evaluations.sort((a, b) => a.shanten - b.shanten || a.tileId - b.tileId);
    return evaluations[0]?.tileId ?? null;
  }

  const minShanten = Math.min(...evaluations.map((entry) => entry.shanten));
  const folding = riichiOpponentCount(state, player) > 0 && minShanten >= 2;
  evaluations.sort((a, b) => compareStandard(a, b, folding));
  return evaluations[0]?.tileId ?? null;
}

function immediateAction(
  state: RoundState,
  player: PlayerIndex,
): BotDecision | null {
  const legal = getLegalActions(state, player);
  if (legal.some((action) => action.type === 'tsumo')) {
    return { type: 'action', action: { type: 'tsumo', player } };
  }
  if (legal.some((action) => action.type === 'ron')) {
    return { type: 'action', action: { type: 'ron', player } };
  }
  if (legal.some((action) => action.type === 'draw')) {
    return { type: 'action', action: { type: 'draw', player } };
  }
  return null;
}

/**
 * Difficulty wrapper around the deterministic production bot.
 *
 * Casual deliberately stays closed and ignores defense / Dora / ukeire tie-breaks. Standard keeps
 * the production shape/Dora/genbutsu heuristics and yaku-safe calls, but skips the expensive ukeire
 * tie-break. Expert is the full production bot.
 */
export function chooseBotDecisionForDifficulty(
  state: RoundState,
  player: PlayerIndex,
  difficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY,
): BotDecision {
  if (difficulty === 'expert') return chooseBotDecision(state, player);

  const immediate = immediateAction(state, player);
  if (immediate) return immediate;

  const legal = getLegalActions(state, player);
  if (legal.length === 0) return { type: 'pass' };

  if (state.phase.kind === 'reactions' || state.phase.kind === 'kan-reactions') {
    if (difficulty === 'casual') return { type: 'pass' };
    return chooseBotDecision(state, player);
  }

  // Standard retains safe Kan judgement from the production bot. Casual skips voluntary Kans.
  if (difficulty === 'standard' && legal.some((action) => action.type === 'ankan' || action.type === 'shouminkan')) {
    const production = chooseBotDecision(state, player);
    if (
      production.type === 'action' &&
      (production.action.type === 'ankan' || production.action.type === 'shouminkan')
    ) {
      return production;
    }
  }

  const riichi = legal.find((action) => action.type === 'riichi-discard');
  if (riichi?.type === 'riichi-discard') {
    const tileId = chooseProfileDiscardId(state, player, riichi.tileIds, difficulty);
    if (tileId !== null) {
      const action: RoundAction = { type: 'riichi-discard', player, tileId };
      return { type: 'action', action };
    }
  }

  const discard = legal.find((action) => action.type === 'discard');
  if (discard?.type === 'discard') {
    const tileId = chooseProfileDiscardId(state, player, discard.tileIds, difficulty);
    if (tileId !== null) {
      return { type: 'action', action: { type: 'discard', player, tileId } };
    }
  }

  return { type: 'pass' };
}
