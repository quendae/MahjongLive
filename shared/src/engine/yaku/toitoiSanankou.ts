import { YakuDetector, isConcealedMeld } from './context';

export const detectToitoi: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const allTriplets = hand.melds.every((m) => m.type === 'triplet');
  return allTriplets ? { name: 'Toitoi', han: 2 } : null;
};

export const detectSanankou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const concealedTriplets = hand.melds.filter((m) => isConcealedMeld(m, hand));
  return concealedTriplets.length >= 3 ? { name: 'Sanankou', han: 2 } : null;
};
