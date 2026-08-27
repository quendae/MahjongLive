import { YakuDetector } from './context';

// OPEN-HAND NOTE: Riichi, Ippatsu, and Menzen Tsumo all require a closed (menzen) hand. This
// plan never constructs an open WinningHand (see the plan's "Open Hands" section), so no
// closed-hand check appears here — add one when open melds exist.

export const detectRiichi: YakuDetector = (hand) => {
  return hand.isRiichi ? { name: 'Riichi', han: 1 } : null;
};

export const detectIppatsu: YakuDetector = (hand) => {
  return hand.isIppatsu ? { name: 'Ippatsu', han: 1 } : null;
};

export const detectMenzenTsumo: YakuDetector = (hand) => {
  return hand.winCondition === 'tsumo' ? { name: 'Menzen Tsumo', han: 1 } : null;
};
