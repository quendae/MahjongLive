import { Tile, SuitRank } from '../tiles/types';
import { tileTypeKey, allTileTypes, suited, isTerminalOrHonor } from '../tiles/tiles';

/**
 * Shanten is how many tile exchanges a 13-tile hand still needs to reach tenpai: 0 means tenpai
 * (one tile from winning), 1 means one exchange away from tenpai, and so on.
 *
 * Every function in this file measures that the same way. For a target shape, let `W` be a
 * complete 14-tile hand of that shape and `k = |hand ∩ W|` (counting duplicates). The hand must
 * acquire the other `14 - k` tiles of `W`; the first `13 - k` acquisitions are draw-and-discard
 * exchanges and the last one is the winning draw, so the hand is `13 - k` exchanges from tenpai.
 * Maximising `k` therefore gives
 *
 *     shanten = 13 - max over complete hands W of |hand ∩ W|
 *
 * Working from complete hands rather than from a "count melds and partial sets, then apply a
 * correction formula" heuristic keeps two things automatically right that the heuristic gets
 * wrong: how many blocks a hand may usefully count, and the fact that no complete hand can use
 * more than four copies of a tile type (so a hand already holding all four copies of a tile
 * cannot count a block that would need a fifth). Most reference shanten calculators use a
 * closed-form block-counting formula that does not account for this limit and will report a
 * lower (looser) value on hands holding all four copies of some tile; the divergence here is
 * intentional and was verified correct against the exchange-distance definition above.
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

/**
 * Whether a sequence may start at each type index — true only when the two following indices are
 * the next two ranks of the same suit, so the scan below can treat a sequence started at `i` as
 * covering exactly `i`, `i + 1` and `i + 2`.
 */
const SEQUENCE_START = TILE_TYPES.map((tile, i) => {
  if (tile.kind !== 'suited' || tile.rank > 7) return false;
  const second = INDEX_BY_KEY.get(tileTypeKey(suited(tile.suit, (tile.rank + 1) as SuitRank)));
  const third = INDEX_BY_KEY.get(tileTypeKey(suited(tile.suit, (tile.rank + 2) as SuitRank)));
  return second === i + 1 && third === i + 2;
});

function requireThirteenTiles(tiles: Tile[], caller: string): void {
  if (tiles.length !== 13) {
    throw new Error(`${caller} requires exactly 13 tiles (closed hand, no calls)`);
  }
}

/** Copies of each tile type in the hand, indexed the same way as `TILE_TYPES`. */
function countByIndex(tiles: Tile[]): number[] {
  const counts = new Array<number>(TYPE_COUNT).fill(0);
  for (const tile of tiles) {
    // Every representable tile type appears in `allTileTypes()`, so the lookup always hits.
    counts[INDEX_BY_KEY.get(tileTypeKey(tile))!] += 1;
  }
  return counts;
}

/**
 * The largest number of tiles the hand shares with any complete 4-melds-plus-pair hand.
 *
 * Complete hands are enumerated by scanning tile types in index order and choosing, at each type,
 * how many triplets and sequences start there and whether the pair sits there — which describes
 * every standard hand exactly once. A sequence started at index `i` also consumes `i + 1` and
 * `i + 2`, so the scan carries how many sequences began at the previous two indices. Results are
 * memoised per scan state, which keeps the enumeration cheap.
 */
function standardOverlap(counts: number[]): number {
  const memo = new Map<number, number>();

  function bestFrom(
    index: number,
    startedPrevious: number,
    startedTwoBack: number,
    melds: number,
    pairPlaced: boolean,
  ): number {
    if (index === TYPE_COUNT) {
      return melds === MELDS_PER_HAND && pairPlaced ? 0 : -Infinity;
    }

    const key =
      (((index * 5 + startedPrevious) * 5 + startedTwoBack) * 5 + melds) * 2 + (pairPlaced ? 1 : 0);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best = -Infinity;
    // Two triplets of one type would need six copies, so at most one triplet starts at a type.
    const maxTriplets = melds < MELDS_PER_HAND ? 1 : 0;
    for (let triplets = 0; triplets <= maxTriplets; triplets++) {
      const maxSequences = SEQUENCE_START[index] ? MELDS_PER_HAND - melds - triplets : 0;
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

/** Shanten towards a standard hand: four melds (sequences or triplets) plus a pair. */
export function standardShanten(tiles: Tile[]): number {
  requireThirteenTiles(tiles, 'standardShanten');
  return 13 - standardOverlap(countByIndex(tiles));
}

/**
 * Shanten towards Chiitoitsu (seven distinct pairs). The best overlap keeps every pair the hand
 * already has and one tile from each remaining distinct type, which reduces to `6 - pairs`, plus
 * one extra exchange for each type short of seven (a duplicate beyond a pair is dead weight).
 */
export function chiitoitsuShanten(tiles: Tile[]): number {
  requireThirteenTiles(tiles, 'chiitoitsuShanten');
  const counts = countByIndex(tiles);
  const pairs = counts.filter((count) => count >= 2).length;
  const kinds = counts.filter((count) => count >= 1).length;
  return 6 - pairs + Math.max(0, 7 - kinds);
}

/**
 * Shanten towards Kokushi Musou (all thirteen terminals and honors, one of them doubled). The best
 * overlap is one tile of each required type already held, plus one more if any of them is paired.
 */
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

/** How far the hand is from tenpai, reading it as whichever of the three shapes is closest. */
export function shanten(tiles: Tile[]): number {
  requireThirteenTiles(tiles, 'shanten');
  return Math.min(standardShanten(tiles), chiitoitsuShanten(tiles), kokushiShanten(tiles));
}
