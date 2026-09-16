import type { RoundAction } from '@mahjong-live/shared/rules';
import type { Tile } from '@mahjong-live/shared/tile-types';

export type ClaimAction = Extract<RoundAction, {
  type: 'chi' | 'pon' | 'daiminkan' | 'ankan' | 'shouminkan';
}>;

export type ClaimChoice = {
  action: ClaimAction;
  label: string;
};

type TileLabel = (tile: Tile) => string;

function tileById(hand: readonly Tile[], id: number): Tile | undefined {
  return hand.find((tile) => tile.id === id);
}

function actionTiles(action: ClaimAction, hand: readonly Tile[]): Tile[] {
  if (action.type === 'shouminkan') {
    const tile = tileById(hand, action.tileId);
    return tile ? [tile] : [];
  }
  return action.tileIds
    .map((id) => tileById(hand, id))
    .filter((tile): tile is Tile => Boolean(tile));
}

function chiSortValue(tile: Tile): number {
  if (tile.kind !== 'suited') return 100;
  const suit = tile.suit === 'man' ? 0 : tile.suit === 'pin' ? 10 : 20;
  return suit + tile.rank;
}

export function describeClaimAction(
  action: ClaimAction,
  hand: readonly Tile[],
  calledTile: Tile | undefined,
  tileLabel: TileLabel,
): string {
  const handTiles = actionTiles(action, hand);
  if (action.type !== 'chi' || !calledTile) {
    return handTiles.map(tileLabel).join(' · ');
  }

  const entries = [
    ...handTiles.map((tile) => ({ tile, called: false })),
    { tile: calledTile, called: true },
  ].sort((a, b) => chiSortValue(a.tile) - chiSortValue(b.tile));

  return entries
    .map(({ tile, called }) => called ? `[${tileLabel(tile)}]` : tileLabel(tile))
    .join(' · ');
}

export function buildClaimChoices(
  actions: readonly RoundAction[],
  hand: readonly Tile[],
  calledTile: Tile | undefined,
  tileLabel: TileLabel,
): ClaimChoice[] {
  const unique = new Map<string, ClaimChoice>();

  for (const action of actions) {
    if (!['chi', 'pon', 'daiminkan', 'ankan', 'shouminkan'].includes(action.type)) continue;
    const claimAction = action as ClaimAction;
    const label = describeClaimAction(claimAction, hand, calledTile, tileLabel);
    if (!unique.has(label)) unique.set(label, { action: claimAction, label });
  }

  return [...unique.values()];
}
