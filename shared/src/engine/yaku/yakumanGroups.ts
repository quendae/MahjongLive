import { YakuDetector, isConcealedMeld, isTripletLike } from './context';
import { Dragon, Wind } from '../tiles/types';

function dragonTripletValues(hand: Extract<Parameters<YakuDetector>[0], { shape: 'standard' }>): Set<Dragon> {
  const values = new Set<Dragon>();
  for (const meld of hand.melds) {
    if (!isTripletLike(meld)) continue;
    const tile = meld.tiles[0];
    if (tile.kind === 'honor' && tile.honorType === 'dragon') values.add(tile.value as Dragon);
  }
  return values;
}

function windTripletValues(hand: Extract<Parameters<YakuDetector>[0], { shape: 'standard' }>): Set<Wind> {
  const values = new Set<Wind>();
  for (const meld of hand.melds) {
    if (!isTripletLike(meld)) continue;
    const tile = meld.tiles[0];
    if (tile.kind === 'honor' && tile.honorType === 'wind') values.add(tile.value as Wind);
  }
  return values;
}

export const detectSuuankou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (hand.melds.length !== 4) return null;
  const allConcealedTripletLike = hand.melds.every((meld) => isConcealedMeld(meld, hand));
  return allConcealedTripletLike ? { name: 'Suuankou', han: 0, yakuman: 1 } : null;
};

export const detectDaisangen: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  return dragonTripletValues(hand).size === 3
    ? { name: 'Daisangen', han: 0, yakuman: 1 }
    : null;
};

export const detectDaisuushii: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  return windTripletValues(hand).size === 4
    ? { name: 'Daisuushii', han: 0, yakuman: 1 }
    : null;
};

export const detectShousuushii: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (hand.pair.length !== 2) return null;

  const winds = windTripletValues(hand);
  if (winds.size !== 3) return null; // Daisuushii is intentionally exclusive.

  const pairTile = hand.pair[0];
  const pairIsFourthWind =
    pairTile.kind === 'honor' &&
    pairTile.honorType === 'wind' &&
    !winds.has(pairTile.value as Wind);

  return pairIsFourthWind ? { name: 'Shousuushii', han: 0, yakuman: 1 } : null;
};

export const detectSuukantsu: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const quads = hand.melds.filter((meld) => meld.type === 'quad').length;
  return quads === 4 ? { name: 'Suukantsu', han: 0, yakuman: 1 } : null;
};
