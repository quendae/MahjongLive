import { YakuDetector } from './context';
import { Tile, Suit } from '../tiles/types';

function sequenceLowRank(tiles: readonly Tile[]): number {
  const ranks = tiles
    .filter((t): t is Extract<Tile, { kind: 'suited' }> => t.kind === 'suited')
    .map((t) => t.rank);
  return Math.min(...ranks);
}

function sequenceSuit(tiles: readonly Tile[]): Suit | null {
  const first = tiles[0];
  return first.kind === 'suited' ? first.suit : null;
}

export const detectSanshokuDoujun: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const sequences = hand.melds.filter((m) => m.type === 'sequence');

  for (const low of sequences) {
    const lowRank = sequenceLowRank(low.tiles);
    const suits = new Set(
      sequences
        .filter((m) => sequenceLowRank(m.tiles) === lowRank)
        .map((m) => sequenceSuit(m.tiles)),
    );
    if (suits.size === 3) return { name: 'Sanshoku Doujun', han: 2 };
  }
  return null;
};

export const detectIttsuu: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const sequences = hand.melds.filter((m) => m.type === 'sequence');

  const bySuit = new Map<Suit, Set<number>>();
  for (const seq of sequences) {
    const suit = sequenceSuit(seq.tiles);
    if (!suit) continue;
    const lowRanks = bySuit.get(suit) ?? new Set<number>();
    lowRanks.add(sequenceLowRank(seq.tiles));
    bySuit.set(suit, lowRanks);
  }

  for (const lowRanks of bySuit.values()) {
    if (lowRanks.has(1) && lowRanks.has(4) && lowRanks.has(7)) {
      return { name: 'Ittsuu', han: 2 };
    }
  }
  return null;
};
