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

/**
 * The meld containing a specific tile instance, found by reference identity.
 *
 * HAZARD — winning-tile identity must be assigned meaningfully by the caller.
 *
 * A tile *type* has up to 4 physically interchangeable copies, and a single decomposition can
 * split those copies across different meld roles (e.g. `345m` + `555m` uses all four `5m`
 * copies: one in the sequence, three in the triplet). `decomposeStandardHand` picks which copy
 * fills which role purely by array position — "whichever same-type tile object came first in the
 * caller's input array" leads the sequence — so the *object* that lands in the sequence versus
 * the triplet is determined by the caller's input ordering, not by game semantics.
 *
 * Reference-identity lookup here (and in `isConcealedMeld` below) is therefore only correct if
 * the winning tile's object reference was placed in the meld it actually completed in the real
 * game. Whoever constructs a `WinningHand` from `decomposeStandardHand`'s output — no such
 * integration code exists in this repo yet; it belongs to a future Scoring / round-state-machine
 * plan — MUST enforce that. Passing `decomposeStandardHand`'s raw output straight through is NOT
 * safe whenever this ambiguity exists: the same logical hand would yield different Sanankou/Pinfu
 * answers depending only on how the tiles happened to be ordered before decomposition.
 */
export function meldContainingTile(melds: readonly Meld[], tile: Tile): Meld | undefined {
  return melds.find((m) => m.tiles.includes(tile));
}

/**
 * Whether a triplet counts as concealed for Sanankou/Suuankou purposes. Only triplets can be
 * concealed (sequences and the pair never count). A triplet completed by Ron — turning a waiting
 * pair into a triplet (shanpon) — is NOT concealed even though no call was made; a triplet
 * completed by Tsumo, or one that already existed before the winning tile, is concealed.
 *
 * HAZARD: the Ron-shanpon exception is decided by `meld.tiles.includes(hand.winningTile)`, a
 * reference-identity search. See `meldContainingTile` above — when a tile type's copies are split
 * between a sequence and a triplet, whether the winning tile *object* sits in the triplet depends
 * on the caller's input ordering to `decomposeStandardHand`, not on what actually happened in the
 * game. The caller that builds the `WinningHand` is responsible for putting the winning tile's
 * object in the meld it truly completed.
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
