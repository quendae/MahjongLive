import { doraFromIndicator } from '../scoring/dora';
import { structuralShanten } from '../shanten/shanten';
import { isTerminal, tileTypeKey } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { getLegalActions, seatWindFor } from '../rules/round';
import type {
  LegalAction,
  PlayerIndex,
  PlayerMeld,
  RoundAction,
  RoundPlayerState,
  RoundState,
} from '../rules/types';

export type BotDecision =
  | { type: 'action'; action: RoundAction }
  | { type: 'pass' };

export interface DiscardEvaluation {
  tileId: number;
  shanten: number;
  danger: number;
  doraCost: number;
  keepValue: number;
}

function requireId(tile: Tile): number | null {
  return typeof tile.id === 'number' ? tile.id : null;
}

function removeIds(tiles: readonly Tile[], ids: readonly number[]): Tile[] | null {
  const remaining = [...tiles];
  for (const id of ids) {
    const index = remaining.findIndex((tile) => tile.id === id);
    if (index < 0) return null;
    remaining.splice(index, 1);
  }
  return remaining;
}

function isSimpleTile(tile: Tile): boolean {
  return tile.kind === 'suited' && tile.rank >= 2 && tile.rank <= 8;
}

function activeDoraKeys(state: RoundState): Map<string, number> {
  const keys = new Map<string, number>();
  for (const indicator of state.wall.doraIndicators) {
    const key = tileTypeKey(doraFromIndicator(indicator));
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  return keys;
}

function doraCost(tile: Tile, state: RoundState): number {
  let value = tile.kind === 'suited' && tile.isRed ? 3 : 0;
  value += (activeDoraKeys(state).get(tileTypeKey(tile)) ?? 0) * 2;
  return value;
}

function isValueHonor(tile: Tile, state: RoundState, player: PlayerIndex): boolean {
  if (tile.kind !== 'honor') return false;
  if (tile.honorType === 'dragon') return true;
  const seatWind = seatWindFor(player, state.dealer);
  return tile.value === seatWind || tile.value === state.roundWind;
}

function valueHonorMeld(
  meld: PlayerMeld,
  state: RoundState,
  player: PlayerIndex,
): boolean {
  if (meld.type !== 'triplet' && meld.type !== 'quad') return false;
  const tile = meld.tiles[0];
  return tile ? isValueHonor(tile, state, player) : false;
}

function hasValueHonorAnchor(
  playerState: RoundPlayerState,
  state: RoundState,
  player: PlayerIndex,
): boolean {
  return playerState.melds.some((meld) => valueHonorMeld(meld, state, player));
}

function meldsAreAllSimple(melds: readonly PlayerMeld[]): boolean {
  return melds.every((meld) => meld.tiles.every(isSimpleTile));
}

function keepValue(tile: Tile, hand: readonly Tile[], state: RoundState, player: PlayerIndex): number {
  const key = tileTypeKey(tile);
  const same = hand.filter((candidate) => tileTypeKey(candidate) === key).length;
  let value = same >= 3 ? 6 : same === 2 ? 4 : 0;

  if (isValueHonor(tile, state, player)) value += 2;
  if (tile.kind === 'suited') {
    if (hand.some((candidate) =>
      candidate.kind === 'suited' &&
      candidate.suit === tile.suit &&
      Math.abs(candidate.rank - tile.rank) === 1
    )) value += 3;
    if (hand.some((candidate) =>
      candidate.kind === 'suited' &&
      candidate.suit === tile.suit &&
      Math.abs(candidate.rank - tile.rank) === 2
    )) value += 1;
    if (tile.rank >= 3 && tile.rank <= 7) value += 1;
  } else if (same === 1 && !isValueHonor(tile, state, player)) {
    value -= 2;
  }

  if (isTerminal(tile) && same === 1) value -= 1;
  return value;
}

function riichiOpponents(state: RoundState, player: PlayerIndex): PlayerIndex[] {
  return ([0, 1, 2, 3] as PlayerIndex[]).filter(
    (candidate) => candidate !== player && state.players[candidate].riichi !== 'none',
  );
}

function dangerScore(tile: Tile, state: RoundState, player: PlayerIndex): number {
  const key = tileTypeKey(tile);
  let danger = 0;
  for (const opponent of riichiOpponents(state, player)) {
    const genbutsu = state.players[opponent].discards.some(
      (discard) => tileTypeKey(discard.tile) === key,
    );
    if (!genbutsu) danger += 1;
  }
  return danger;
}

export function evaluateDiscard(
  state: RoundState,
  player: PlayerIndex,
  tileId: number,
): DiscardEvaluation | null {
  const roundPlayer = state.players[player];
  const tile = roundPlayer.concealed.find((candidate) => candidate.id === tileId);
  if (!tile) return null;
  const concealed = removeIds(roundPlayer.concealed, [tileId]);
  if (!concealed) return null;
  const fixedMeldCount = roundPlayer.melds.length;
  let distance: number;
  try {
    distance = structuralShanten(concealed, fixedMeldCount);
  } catch {
    return null;
  }
  return {
    tileId,
    shanten: distance,
    danger: dangerScore(tile, state, player),
    doraCost: doraCost(tile, state),
    keepValue: keepValue(tile, roundPlayer.concealed, state, player),
  };
}

function chooseDiscardId(
  state: RoundState,
  player: PlayerIndex,
  tileIds: readonly number[],
): number | null {
  const evaluations = tileIds
    .map((tileId) => evaluateDiscard(state, player, tileId))
    .filter((entry): entry is DiscardEvaluation => entry !== null);
  if (evaluations.length === 0) return tileIds[0] ?? null;

  const minShanten = Math.min(...evaluations.map((entry) => entry.shanten));
  const folding = riichiOpponents(state, player).length > 0 && minShanten >= 2;

  evaluations.sort((a, b) => {
    if (folding && a.danger !== b.danger) return a.danger - b.danger;
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    if (!folding && a.danger !== b.danger) return a.danger - b.danger;
    if (a.doraCost !== b.doraCost) return a.doraCost - b.doraCost;
    if (a.keepValue !== b.keepValue) return a.keepValue - b.keepValue;
    return a.tileId - b.tileId;
  });
  return evaluations[0].tileId;
}

function currentBaseShanten(player: RoundPlayerState): number {
  return structuralShanten(player.concealed, player.melds.length);
}

function bestPostCallDiscardShanten(
  concealedAfterClaim: readonly Tile[],
  fixedMeldCount: number,
  acceptsAfterDiscard: (tiles: readonly Tile[]) => boolean = () => true,
): number {
  let best = Infinity;
  for (const tile of concealedAfterClaim) {
    const id = requireId(tile);
    if (id === null) continue;
    const afterDiscard = removeIds(concealedAfterClaim, [id]);
    if (!afterDiscard || !acceptsAfterDiscard(afterDiscard)) continue;
    try {
      best = Math.min(best, structuralShanten(afterDiscard, fixedMeldCount));
    } catch {
      // Ignore malformed alternatives; legal engine options should leave at least one valid path.
    }
  }
  return best;
}

function reactionDiscardTile(state: RoundState): Tile | null {
  if (state.phase.kind !== 'reactions') return null;
  return state.players[state.phase.discarder].discards[state.phase.discardIndex]?.tile ?? null;
}

function selectedTiles(player: RoundPlayerState, ids: readonly number[]): Tile[] | null {
  const selected = ids.map((id) => player.concealed.find((tile) => tile.id === id));
  return selected.some((tile) => tile === undefined) ? null : selected as Tile[];
}

function chooseCall(
  state: RoundState,
  playerIndex: PlayerIndex,
  actions: readonly LegalAction[],
): RoundAction | null {
  const player = state.players[playerIndex];
  let before: number;
  try {
    before = currentBaseShanten(player);
  } catch {
    return null;
  }
  const discard = reactionDiscardTile(state);
  const existingValueAnchor = hasValueHonorAnchor(player, state, playerIndex);
  const existingMeldsSimple = meldsAreAllSimple(player.melds);
  const candidates: Array<{ action: RoundAction; after: number; priority: number }> = [];

  for (const legal of actions) {
    if ((legal.type === 'pon' || legal.type === 'chi') && discard) {
      for (const option of legal.options) {
        const chosen = selectedTiles(player, option);
        const afterClaim = removeIds(player.concealed, option);
        if (!chosen || !afterClaim) continue;

        const valueHonorPon = legal.type === 'pon' && isValueHonor(discard, state, playerIndex);
        const valueAnchor = existingValueAnchor || valueHonorPon;
        const calledMeldSimple = isSimpleTile(discard) && chosen.every(isSimpleTile);
        const canPursueTanyao = !valueAnchor && existingMeldsSimple && calledMeldSimple;
        if (!valueAnchor && !canPursueTanyao) continue;

        const after = bestPostCallDiscardShanten(
          afterClaim,
          player.melds.length + 1,
          valueAnchor ? undefined : (tiles) => tiles.every(isSimpleTile),
        );
        if (!Number.isFinite(after)) continue;
        if (after < before || (valueHonorPon && after <= before)) {
          candidates.push({
            action: { type: legal.type, player: playerIndex, tileIds: option } as RoundAction,
            after,
            priority: legal.type === 'pon' ? 1 : 2,
          });
        }
      }
    }

    if (legal.type === 'daiminkan' && discard && riichiOpponents(state, playerIndex).length === 0) {
      for (const option of legal.options) {
        const chosen = selectedTiles(player, option);
        const afterClaim = removeIds(player.concealed, option);
        if (!chosen || !afterClaim) continue;

        const valueAnchor = existingValueAnchor || isValueHonor(discard, state, playerIndex);
        const tanyaoAnchor =
          !valueAnchor &&
          existingMeldsSimple &&
          isSimpleTile(discard) &&
          chosen.every(isSimpleTile) &&
          afterClaim.every(isSimpleTile);
        if (!valueAnchor && !tanyaoAnchor) continue;

        let after = Infinity;
        try {
          after = structuralShanten(afterClaim, player.melds.length + 1);
        } catch {
          continue;
        }
        if (after <= before) {
          candidates.push({
            action: { type: 'daiminkan', player: playerIndex, tileIds: option },
            after,
            priority: 3,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => a.after - b.after || a.priority - b.priority);
  return candidates[0]?.action ?? null;
}

function bestDiscardShanten(state: RoundState, player: PlayerIndex): number {
  const legal = getLegalActions(state, player).find((action) => action.type === 'discard');
  if (!legal || legal.type !== 'discard') return Infinity;
  const values = legal.tileIds
    .map((id) => evaluateDiscard(state, player, id)?.shanten)
    .filter((value): value is number => value !== undefined);
  return values.length > 0 ? Math.min(...values) : Infinity;
}

function chooseKan(
  state: RoundState,
  player: PlayerIndex,
  actions: readonly LegalAction[],
): RoundAction | null {
  const underRiichiThreat = riichiOpponents(state, player).length > 0;
  const playerState = state.players[player];
  const baseline = bestDiscardShanten(state, player);

  const ankan = actions.find((action) => action.type === 'ankan');
  if (ankan?.type === 'ankan') {
    for (const option of ankan.options) {
      const after = removeIds(playerState.concealed, option);
      if (!after) continue;
      try {
        const distance = structuralShanten(after, playerState.melds.length + 1);
        if (distance <= baseline && (!underRiichiThreat || playerState.riichi !== 'none' || distance <= 1)) {
          return { type: 'ankan', player, tileIds: option };
        }
      } catch {
        // Try another legal Kan option.
      }
    }
  }

  const shouminkan = actions.find((action) => action.type === 'shouminkan');
  if (shouminkan?.type === 'shouminkan' && !underRiichiThreat && baseline <= 1) {
    const option = shouminkan.options[0];
    if (option) return { type: 'shouminkan', player, meldIndex: option.meldIndex, tileId: option.tileId };
  }

  return null;
}

/** Deterministic baseline AI. It never invents an action; every choice starts from getLegalActions(). */
export function chooseBotDecision(state: RoundState, player: PlayerIndex): BotDecision {
  const legal = getLegalActions(state, player);
  if (legal.length === 0) return { type: 'pass' };

  if (legal.some((action) => action.type === 'tsumo')) {
    return { type: 'action', action: { type: 'tsumo', player } };
  }
  if (legal.some((action) => action.type === 'ron')) {
    return { type: 'action', action: { type: 'ron', player } };
  }
  if (legal.some((action) => action.type === 'draw')) {
    return { type: 'action', action: { type: 'draw', player } };
  }

  if (state.phase.kind === 'reactions' || state.phase.kind === 'kan-reactions') {
    const call = state.phase.kind === 'reactions' ? chooseCall(state, player, legal) : null;
    return call ? { type: 'action', action: call } : { type: 'pass' };
  }

  const kan = chooseKan(state, player, legal);
  if (kan) return { type: 'action', action: kan };

  const riichi = legal.find((action) => action.type === 'riichi-discard');
  if (riichi?.type === 'riichi-discard') {
    const tileId = chooseDiscardId(state, player, riichi.tileIds);
    if (tileId !== null) {
      return { type: 'action', action: { type: 'riichi-discard', player, tileId } };
    }
  }

  const discard = legal.find((action) => action.type === 'discard');
  if (discard?.type === 'discard') {
    const tileId = chooseDiscardId(state, player, discard.tileIds);
    if (tileId !== null) return { type: 'action', action: { type: 'discard', player, tileId } };
  }

  return { type: 'pass' };
}
