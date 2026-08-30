import { YakuDetector, isConcealedMeld, isTripletLike } from './context';

export const detectToitoi: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const allTripletLike = hand.melds.every(isTripletLike);
  return allTripletLike ? { name: 'Toitoi', han: 2 } : null;
};

export const detectSanankou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const concealedTriplets = hand.melds.filter((m) => isConcealedMeld(m, hand));
  return concealedTriplets.length >= 3 ? { name: 'Sanankou', han: 2 } : null;
};
