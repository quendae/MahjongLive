import {
  YakuDetector,
  WinningMeld,
  isClosedHand,
  meldContainingTile,
  isYakuhaiTile,
} from './context';
import { tileTypeKey } from '../tiles/tiles';
import { Tile } from '../tiles/types';

/**
 * Whether the winning tile completed `meld` from a two-sided (ryanmen) wait — the only wait shape
 * Pinfu allows. The two tiles held before the win are the run's other two tiles:
 *
 * - Won on the middle rank: the held tiles straddle a gap (kanchan), a one-tile wait.
 * - Won on an end: the held tiles are adjacent, waiting on the ranks either side of them. That is
 *   two-sided unless one of those ranks falls outside 1..9 — run `1,2,3` won on the `3` (held 1,2)
 *   and run `7,8,9` won on the `7` (held 8,9) are edge waits (penchan).
 */
function isRyanmenWait(meld: WinningMeld, winningTile: Tile): boolean {
  if (meld.type !== 'sequence') return false;
  const sorted = [...meld.tiles].sort((a, b) => {
    if (a.kind !== 'suited' || b.kind !== 'suited') return 0;
    return a.rank - b.rank;
  });
  const winIndex = sorted.indexOf(winningTile);
  if (winIndex === 1) return false; // middle of the run: kanchan

  const lowRank = sorted[0].kind === 'suited' ? sorted[0].rank : 0;
  const highRank = sorted[2].kind === 'suited' ? sorted[2].rank : 0;
  const isPenchanLow = lowRank === 1 && winIndex === 2; // run 1-2-3, won on the 3
  const isPenchanHigh = highRank === 9 && winIndex === 0; // run 7-8-9, won on the 7
  return !isPenchanLow && !isPenchanHigh;
}

function sequenceSignature(meld: WinningMeld): string | null {
  if (meld.type !== 'sequence') return null;
  return meld.tiles.map(tileTypeKey).sort().join(',');
}

/** Number of disjoint identical-sequence pairs available among a standard hand's melds. */
export function countIdenticalSequencePairs(melds: readonly WinningMeld[]): number {
  const counts = new Map<string, number>();
  for (const meld of melds) {
    const key = sequenceSignature(meld);
    if (key === null) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let pairs = 0;
  for (const count of counts.values()) pairs += Math.floor(count / 2);
  return pairs;
}

export const detectPinfu: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (!isClosedHand(hand)) return null;
  if (hand.pair.length !== 2) return null;
  if (hand.melds.some((m) => m.type !== 'sequence')) return null;
  if (isYakuhaiTile(hand.pair[0], hand)) return null;

  const winningMeld = meldContainingTile(hand.melds, hand.winningTile);
  if (!winningMeld) return null; // won on the pair tile: always a tanki (single) wait, not Pinfu
  if (!isRyanmenWait(winningMeld, hand.winningTile)) return null;

  return { name: 'Pinfu', han: 1 };
};

export const detectIipeikou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (!isClosedHand(hand)) return null;

  // Ryanpeikou is two identical-sequence pairs and supersedes Iipeikou rather than stacking.
  return countIdenticalSequencePairs(hand.melds) === 1 ? { name: 'Iipeikou', han: 1 } : null;
};
