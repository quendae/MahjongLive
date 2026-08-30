import { YakuDetector, isClosedHand } from './context';

export const detectRiichi: YakuDetector = (hand) => {
  if (!isClosedHand(hand)) return null;
  if (hand.isDoubleRiichi === true) return null;
  return hand.isRiichi ? { name: 'Riichi', han: 1 } : null;
};

export const detectIppatsu: YakuDetector = (hand) => {
  if (!isClosedHand(hand)) return null;
  return hand.isIppatsu ? { name: 'Ippatsu', han: 1 } : null;
};

export const detectMenzenTsumo: YakuDetector = (hand) => {
  if (!isClosedHand(hand)) return null;
  return hand.winCondition === 'tsumo' ? { name: 'Menzen Tsumo', han: 1 } : null;
};
