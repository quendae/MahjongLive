import { Tile, Wind } from '../tiles/types';
import { Meld } from '../hand/decompose';

export type WinCondition = 'tsumo' | 'ron';

export interface WinningHandBase {
  /** All 14 tiles of the winning hand, for shape-agnostic checks (Tanyao, Honitsu, Chinitsu). */
  allTiles: readonly Tile[];
  winningTile: Tile;
  winCondition: WinCondition;
  seatWind: Wind;
  roundWind: Wind;
  isRiichi: boolean;
  isIppatsu: boolean;
  /** Won by Tsumo on the very last live-wall tile. */
  isHaitei: boolean;
  /** Won by Ron on the very last discard of the hand. */
  isHoutei: boolean;
  /** Won by Tsumo on a replacement tile drawn after declaring a Kan. */
  isRinshan: boolean;
  /** Won by Ron by robbing another player's added Kan. */
  isChankan: boolean;
}

/** A hand decomposed into four melds plus a pair. */
export interface StandardWinningHand extends WinningHandBase {
  shape: 'standard';
  melds: readonly Meld[];
  pair: readonly Tile[];
}

/** A hand of seven distinct pairs (Chiitoitsu). Has no meld/pair split. */
export interface ChiitoitsuWinningHand extends WinningHandBase {
  shape: 'chiitoitsu';
}

export type WinningHand = StandardWinningHand | ChiitoitsuWinningHand;

export interface YakuResult {
  name: string;
  han: number;
}

export type YakuDetector = (hand: WinningHand) => YakuResult | null;

/** The meld containing a specific tile instance, found by reference identity. */
export function meldContainingTile(melds: readonly Meld[], tile: Tile): Meld | undefined {
  return melds.find((m) => m.tiles.includes(tile));
}

/**
 * Whether a triplet counts as concealed for Sanankou/Suuankou purposes. Only triplets can be
 * concealed (sequences and the pair never count). A triplet completed by Ron — turning a waiting
 * pair into a triplet (shanpon) — is NOT concealed even though no call was made; a triplet
 * completed by Tsumo, or one that already existed before the winning tile, is concealed.
 */
export function isConcealedMeld(meld: Meld, hand: StandardWinningHand): boolean {
  if (meld.type !== 'triplet') return false;
  const containsWinningTile = meld.tiles.includes(hand.winningTile);
  if (containsWinningTile && hand.winCondition === 'ron') return false;
  return true;
}

/** Whether a tile is a "value" honor: any dragon, or the hand's seat or round wind. */
export function isYakuhaiTile(tile: Tile, hand: WinningHandBase): boolean {
  if (tile.kind !== 'honor') return false;
  if (tile.honorType === 'dragon') return true;
  return tile.value === hand.seatWind || tile.value === hand.roundWind;
}
