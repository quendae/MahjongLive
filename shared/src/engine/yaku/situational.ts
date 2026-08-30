import { YakuDetector, isClosedHand } from './context';

export const detectDoubleRiichi: YakuDetector = (hand) => {
  if (!isClosedHand(hand)) return null;
  return hand.isDoubleRiichi === true ? { name: 'Double Riichi', han: 2 } : null;
};

export const detectHaitei: YakuDetector = (hand) => {
  return hand.isHaitei && hand.winCondition === 'tsumo' ? { name: 'Haitei', han: 1 } : null;
};

export const detectHoutei: YakuDetector = (hand) => {
  return hand.isHoutei && hand.winCondition === 'ron' ? { name: 'Houtei', han: 1 } : null;
};

export const detectRinshan: YakuDetector = (hand) => {
  return hand.isRinshan && hand.winCondition === 'tsumo' ? { name: 'Rinshan Kaihou', han: 1 } : null;
};

export const detectChankan: YakuDetector = (hand) => {
  return hand.isChankan && hand.winCondition === 'ron' ? { name: 'Chankan', han: 1 } : null;
};

export const detectTenhou: YakuDetector = (hand) => {
  if (!isClosedHand(hand)) return null;
  return hand.isTenhou === true && hand.winCondition === 'tsumo' && hand.seatWind === 'east'
    ? { name: 'Tenhou', han: 0, yakuman: 1 }
    : null;
};

export const detectChiihou: YakuDetector = (hand) => {
  if (!isClosedHand(hand)) return null;
  return hand.isChiihou === true && hand.winCondition === 'tsumo' && hand.seatWind !== 'east'
    ? { name: 'Chiihou', han: 0, yakuman: 1 }
    : null;
};
