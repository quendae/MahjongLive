import { evaluateDiscard, evaluateDiscardUkeire } from '../bot/bot';
import type { PlayerIndex, RoundState } from '../rules/types';

export interface DiscardAdvice {
  tileId: number;
  shanten: number;
  ukeire: number;
  danger: number;
  doraCost: number;
  keepValue: number;
  recommended: boolean;
}

/**
 * Human-facing discard analysis using the same public-information contract as the Expert bot.
 * Opponent concealed hands and the unseen wall are deliberately never inspected by the underlying
 * evaluators; only the human hand plus public discards/melds/Dora affect the result.
 */
export function evaluateDiscardAdvice(
  state: RoundState,
  player: PlayerIndex,
  tileIds: readonly number[],
): readonly DiscardAdvice[] {
  const base = tileIds
    .map((tileId) => evaluateDiscard(state, player, tileId))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const minShanten = base.length > 0 ? Math.min(...base.map((entry) => entry.shanten)) : Infinity;

  // Ukeire is the comparatively expensive part. It can only beat another discard after shanten
  // is tied, so calculate it only for the best 0/1-shanten candidates the UI may recommend.
  const entries: Array<Omit<DiscardAdvice, 'recommended'>> = base.map((entry) => ({
    ...entry,
    ukeire: entry.shanten === minShanten && minShanten <= 1
      ? evaluateDiscardUkeire(state, player, entry.tileId) ?? 0
      : 0,
  }));

  entries.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    if (a.shanten <= 1 && a.ukeire !== b.ukeire) return b.ukeire - a.ukeire;
    if (a.danger !== b.danger) return a.danger - b.danger;
    if (a.doraCost !== b.doraCost) return a.doraCost - b.doraCost;
    if (a.keepValue !== b.keepValue) return a.keepValue - b.keepValue;
    return a.tileId - b.tileId;
  });

  const best = entries[0];
  return entries.map((entry) => ({
    ...entry,
    recommended:
      best !== undefined &&
      entry.shanten === best.shanten &&
      (entry.shanten > 1 || entry.ukeire === best.ukeire) &&
      entry.danger === best.danger &&
      entry.doraCost === best.doraCost &&
      entry.keepValue === best.keepValue,
  }));
}
