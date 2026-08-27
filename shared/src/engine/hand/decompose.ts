import { Tile, SuitRank } from '../tiles/types';
import { tileTypeKey, sortTiles, suited } from '../tiles/tiles';

export interface Meld {
  type: 'sequence' | 'triplet';
  tiles: readonly Tile[];
}

export interface StandardDecomposition {
  pair: readonly Tile[];
  melds: readonly Meld[];
}

function groupByType(tiles: Tile[]): Map<string, Tile[]> {
  const map = new Map<string, Tile[]>();
  for (const t of tiles) {
    const key = tileTypeKey(t);
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return map;
}

function removeTiles(tiles: Tile[], toRemove: Tile[]): Tile[] {
  const result = [...tiles];
  for (const tile of toRemove) {
    const index = result.indexOf(tile);
    if (index !== -1) result.splice(index, 1);
  }
  return result;
}

/** All tiles in `byType` that sit `rankOffset` ranks above `reference` in the same suit. */
function tilesAtRankOffset(
  byType: Map<string, Tile[]>,
  reference: Tile,
  rankOffset: number,
): Tile[] {
  if (reference.kind !== 'suited') return [];
  const targetRank = reference.rank + rankOffset;
  if (targetRank > 9) return [];
  const key = tileTypeKey(suited(reference.suit, targetRank as SuitRank));
  return byType.get(key) ?? [];
}

/**
 * Enumerates every way to split a sorted tile array into complete melds.
 *
 * `sorted[0]` is the lowest tile remaining, so every meld holding a copy of its type is either a
 * triplet of that type or a sequence starting at its rank — nothing lower can absorb one. All
 * `count` copies must therefore be consumed right here, split as `k` sequence-leaders plus
 * `(count - k) / 3` triplets. Branching on `k` alone fixes this type's melds completely, so each
 * decomposition is produced exactly once.
 *
 * Branching instead on "put the first tile in a triplet, or in a sequence" would double-count any
 * reading that uses both (e.g. 2222s34s -> 222s + 234s), since the interchangeable copies make the
 * two branches converge on the same set of melds.
 */
function decomposeSorted(sorted: Tile[]): Meld[][] {
  if (sorted.length === 0) return [[]];

  const byType = groupByType(sorted);
  const first = sorted[0];
  const sameType = byType.get(tileTypeKey(first))!;
  const count = sameType.length;

  const seconds = tilesAtRankOffset(byType, first, 1);
  const thirds = tilesAtRankOffset(byType, first, 2);
  const maxSequences = Math.min(count, seconds.length, thirds.length);

  const results: Meld[][] = [];

  for (let k = 0; k <= maxSequences; k++) {
    const leftover = count - k;
    if (leftover % 3 !== 0) continue;

    const melds: Meld[] = [];
    const used: Tile[] = [];

    for (let i = 0; i < k; i++) {
      const tiles = [sameType[i], seconds[i], thirds[i]];
      melds.push({ type: 'sequence', tiles });
      used.push(...tiles);
    }
    for (let i = 0; i < leftover; i += 3) {
      const tiles = sameType.slice(k + i, k + i + 3);
      melds.push({ type: 'triplet', tiles });
      used.push(...tiles);
    }

    for (const rest of decomposeSorted(removeTiles(sorted, used))) {
      results.push([...melds, ...rest]);
    }
  }

  return results;
}

/**
 * All valid ways to split `tiles` into complete melds (triplets and sequences). Returns `[[]]` for
 * an empty input (one decomposition, using no melds) and `[]` when no valid split exists.
 */
export function decomposeMelds(tiles: Tile[]): Meld[][] {
  if (tiles.length % 3 !== 0) return [];
  return decomposeSorted(sortTiles(tiles));
}

/**
 * Enumerates every 4-melds-plus-pair reading of a complete 14-tile hand. Each tile type with at
 * least two copies is tried as the pair, and the remaining 12 tiles are decomposed into melds.
 */
export function decomposeStandardHand(tiles: Tile[]): StandardDecomposition[] {
  if (tiles.length !== 14) return [];

  const sorted = sortTiles(tiles);
  const byType = groupByType(sorted);
  const results: StandardDecomposition[] = [];

  for (const group of byType.values()) {
    if (group.length < 2) continue;
    const pair = group.slice(0, 2);
    const remaining = removeTiles(sorted, pair);
    for (const melds of decomposeMelds(remaining)) {
      results.push({ pair, melds });
    }
  }

  return results;
}
