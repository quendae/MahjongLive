import { YakuDetector, isClosedHand, isTripletLike } from './context';
import { countIdenticalSequencePairs } from './pinfuIipeikou';
import { isTerminalOrHonor } from '../tiles/tiles';
import { Suit } from '../tiles/types';

export const detectRyanpeikou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (!isClosedHand(hand)) return null;
  return countIdenticalSequencePairs(hand.melds) >= 2
    ? { name: 'Ryanpeikou', han: 3 }
    : null;
};

export const detectSanshokuDoukou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;

  const suitsByRank = new Map<number, Set<Suit>>();
  for (const meld of hand.melds) {
    if (!isTripletLike(meld)) continue;
    const tile = meld.tiles[0];
    if (tile.kind !== 'suited') continue;
    const suits = suitsByRank.get(tile.rank) ?? new Set<Suit>();
    suits.add(tile.suit);
    suitsByRank.set(tile.rank, suits);
  }

  for (const suits of suitsByRank.values()) {
    if (suits.size === 3) return { name: 'Sanshoku Doukou', han: 2 };
  }
  return null;
};

export const detectSankantsu: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const quads = hand.melds.filter((meld) => meld.type === 'quad').length;
  return quads === 3 ? { name: 'Sankantsu', han: 2 } : null;
};

export const detectHonroutou: YakuDetector = (hand) => {
  if (hand.allTiles.length === 0) return null;
  return hand.allTiles.every(isTerminalOrHonor) ? { name: 'Honroutou', han: 2 } : null;
};

export const detectShousangen: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (hand.pair.length !== 2) return null;

  const dragonGroups = new Set<string>();
  for (const meld of hand.melds) {
    if (!isTripletLike(meld)) continue;
    const tile = meld.tiles[0];
    if (tile.kind === 'honor' && tile.honorType === 'dragon') dragonGroups.add(tile.value);
  }

  const pairTile = hand.pair[0];
  const pairIsRemainingDragon =
    pairTile.kind === 'honor' &&
    pairTile.honorType === 'dragon' &&
    !dragonGroups.has(pairTile.value);

  return dragonGroups.size === 2 && pairIsRemainingDragon
    ? { name: 'Shousangen', han: 2 }
    : null;
};
