import { Tile, SuitRank } from '../tiles/types';
import { tileTypeKey, allTileTypes, suited, isTerminalOrHonor } from '../tiles/tiles';

/**
 * Shanten is how many tile exchanges a hand still needs to reach tenpai: 0 means tenpai
 * (one tile from winning), 1 means one exchange away from tenpai, and so on.
 *
 * For a fully concealed hand these functions preserve the original 13-tile API. For AI and
 * open-hand evaluation, `standardShantenWithFixedMelds` / `structuralShanten` treat called or
 * already-fixed melds as completed blocks and evaluate only the concealed remainder.
 */

const TILE_TYPES = allTileTypes();
const TYPE_COUNT = TILE_TYPES.length;
const MELDS_PER_HAND = 4;
const MAX_COPIES = 4;

const INDEX_BY_KEY = new Map<string, number>(TILE_TYPES.map((tile, i) => [tileTypeKey(tile), i]));

/** Indices of the 13 terminal/honor types a Kokushi hand is built from. */
const ORPHAN_INDICES = TILE_TYPES.reduce<number[]>((acc, tile, i) => {
  if (isTerminalOrHonor(tile)) acc.push(i);
  return acc;
}, []);

/** Whether a sequence may start at each type index. */
const SEQUENCE_START = TILE_TYPES.map((tile, i) => {
  if (tile.kind !== 'suited' || tile.rank > 7) return false;
  const second = INDEX_BY_KEY.get(tileTypeKey(suited(tile.suit, (tile.rank + 1) as SuitRank)));
  const third = INDEX_BY_KEY.get(tileTypeKey(suited(tile.suit, (tile.rank + 2) as SuitRank)));
  return second === i + 1 && third === i + 2;
});

function requireThirteenTiles(tiles: readonly Tile[], caller: string): void {
  if (tiles.length !== 13) {
    throw new Error(`${caller} requires exactly 13 tiles (closed hand, no calls)`);
  }
}

function validateFixedMeldCount(fixedMeldCount: number, caller: string): number {
  if (!Number.isInteger(fixedMeldCount) || fixedMeldCount < 0 || fixedMeldCount > 4) {
    throw new Error(`${caller} requires fixedMeldCount between 0 and 4`);
  }
  return fixedMeldCount;
}

function requireStructuralTileCount(
  tiles: readonly Tile[],
  fixedMeldCount: number,
  caller: string,
): void {
  const fixed = validateFixedMeldCount(fixedMeldCount, caller);
  const expected = 13 - fixed * 3;
  if (tiles.length !== expected) {
    throw new Error(`${caller} requires exactly ${expected} concealed tiles with ${fixed} fixed melds`);
  }
}

/** Copies of each tile type in the hand, indexed the same way as `TILE_TYPES`. */
function countByIndex(tiles: readonly Tile[]): number[] {
  const counts = new Array<number>(TYPE_COUNT).fill(0);
  for (const tile of tiles) {
    counts[INDEX_BY_KEY.get(tileTypeKey(tile))!] += 1;
  }
  return counts;
}

/**
 * Largest overlap with a complete concealed remainder containing `meldsNeeded` melds plus a pair.
 * For a closed hand meldsNeeded=4; with one fixed call it is 3, and so on.
 */
function standardOverlap(counts: number[], meldsNeeded: number): number {
  const memo = new Map<number, number>();

  function bestFrom(
    index: number,
    startedPrevious: number,
    startedTwoBack: number,
    melds: number,
    pairPlaced: boolean,
  ): number {
    if (index === TYPE_COUNT) {
      return melds === meldsNeeded && pairPlaced ? 0 : -Infinity;
    }

    const key =
      (((index * 5 + startedPrevious) * 5 + startedTwoBack) * 5 + melds) * 2 + (pairPlaced ? 1 : 0);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best = -Infinity;
    const maxTriplets = melds < meldsNeeded ? 1 : 0;
    for (let triplets = 0; triplets <= maxTriplets; triplets++) {
      const maxSequences = SEQUENCE_START[index] ? meldsNeeded - melds - triplets : 0;
      for (let sequences = 0; sequences <= maxSequences; sequences++) {
        const maxPairs = pairPlaced ? 0 : 1;
        for (let pairs = 0; pairs <= maxPairs; pairs++) {
          const used = 3 * triplets + 2 * pairs + sequences + startedPrevious + startedTwoBack;
          if (used > MAX_COPIES) continue;
          const rest = bestFrom(
            index + 1,
            sequences,
            startedPrevious,
            melds + triplets + sequences,
            pairPlaced || pairs === 1,
          );
          if (rest === -Infinity) continue;
          best = Math.max(best, Math.min(counts[index], used) + rest);
        }
      }
    }

    memo.set(key, best);
    return best;
  }

  return bestFrom(0, 0, 0, 0, false);
}

/** Shanten towards a closed standard hand: four melds plus a pair. */
export function standardShanten(tiles: Tile[]): number {
  requireThirteenTiles(tiles, 'standardShanten');
  return 13 - standardOverlap(countByIndex(tiles), MELDS_PER_HAND);
}

/**
 * Standard-hand shanten with already-completed melds (Chi/Pon/Kan) removed from `tiles`.
 * `tiles` must represent the between-draw concealed size: 13 - 3 * fixedMeldCount.
 */
export function standardShantenWithFixedMelds(
  tiles: readonly Tile[],
  fixedMeldCount: number,
): number {
  requireStructuralTileCount(tiles, fixedMeldCount, 'standardShantenWithFixedMelds');
  const concealedBaseline = 13 - fixedMeldCount * 3;
  const meldsNeeded = MELDS_PER_HAND - fixedMeldCount;
  return concealedBaseline - standardOverlap(countByIndex(tiles), meldsNeeded);
}

/** Shanten towards Chiitoitsu (seven distinct pairs). */
export function chiitoitsuShanten(tiles: Tile[]): number {
  requireThirteenTiles(tiles, 'chiitoitsuShanten');
  const counts = countByIndex(tiles);
  const pairs = counts.filter((count) => count >= 2).length;
  const kinds = counts.filter((count) => count >= 1).length;
  return 6 - pairs + Math.max(0, 7 - kinds);
}

/** Shanten towards Kokushi Musou. */
export function kokushiShanten(tiles: Tile[]): number {
  requireThirteenTiles(tiles, 'kokushiShanten');
  const counts = countByIndex(tiles);
  let kinds = 0;
  let hasPair = false;
  for (const index of ORPHAN_INDICES) {
    if (counts[index] >= 1) kinds += 1;
    if (counts[index] >= 2) hasPair = true;
  }
  return 13 - kinds - (hasPair ? 1 : 0);
}

/** How far a fully concealed 13-tile hand is from tenpai, using its closest legal shape. */
export function shanten(tiles: Tile[]): number {
  requireThirteenTiles(tiles, 'shanten');
  return Math.min(standardShanten(tiles), chiitoitsuShanten(tiles), kokushiShanten(tiles));
}

/**
 * AI-facing structural shanten. Closed hands may pursue Standard / Chiitoitsu / Kokushi;
 * once any meld is fixed, only the standard four-groups-plus-pair shape remains possible.
 */
export function structuralShanten(
  tiles: readonly Tile[],
  fixedMeldCount = 0,
): number {
  requireStructuralTileCount(tiles, fixedMeldCount, 'structuralShanten');
  if (fixedMeldCount === 0) return shanten([...tiles]);
  return standardShantenWithFixedMelds(tiles, fixedMeldCount);
}
