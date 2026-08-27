import { Tile } from '../tiles/types';
import { tileTypeKey, isTerminalOrHonor } from '../tiles/tiles';

function countByType(tiles: Tile[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tiles) map.set(tileTypeKey(t), (map.get(tileTypeKey(t)) ?? 0) + 1);
  return map;
}

export function isChiitoitsu(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = countByType(tiles);
  if (counts.size !== 7) return false;
  return [...counts.values()].every((c) => c === 2);
}

export function isKokushi(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = countByType(tiles);
  let pairSeen = false;
  for (const [key, count] of counts) {
    const tile = tiles.find((t) => tileTypeKey(t) === key)!;
    if (!isTerminalOrHonor(tile)) return false;
    if (count === 2) {
      if (pairSeen) return false;
      pairSeen = true;
    } else if (count !== 1) {
      return false;
    }
  }
  return counts.size === 13 && pairSeen;
}
