import { YakuDetector, WinningHand } from './context';
import { isTerminal, isTerminalOrHonor, tileTypeKey } from '../tiles/tiles';
import { Tile } from '../tiles/types';
import { Meld } from '../hand/decompose';

function groupsOf(hand: WinningHand): (readonly Tile[])[] {
  if (hand.shape === 'standard') {
    return [...hand.melds.map((m: Meld) => m.tiles), hand.pair];
  }
  // Chiitoitsu: reconstruct the 7 pairs from allTiles, grouped by tile type.
  const seen = new Map<string, Tile[]>();
  for (const tile of hand.allTiles) {
    const key = tileTypeKey(tile);
    const list = seen.get(key) ?? [];
    list.push(tile);
    seen.set(key, list);
  }
  return [...seen.values()];
}

export const detectChanta: YakuDetector = (hand) => {
  const groups = groupsOf(hand);
  const allQualify = groups.every((group) => group.some(isTerminalOrHonor));
  return allQualify ? { name: 'Chanta', han: 2 } : null;
};

export const detectJunchan: YakuDetector = (hand) => {
  const groups = groupsOf(hand);
  const anyHonor = hand.allTiles.some((t) => t.kind === 'honor');
  if (anyHonor) return null;
  const allQualify = groups.every((group) => group.some(isTerminal));
  return allQualify ? { name: 'Junchan', han: 3 } : null;
};
