import { YakuDetector } from './context';
import { isTerminalOrHonor } from '../tiles/tiles';

export const detectChiitoitsu: YakuDetector = (hand) => {
  return hand.shape === 'chiitoitsu' ? { name: 'Chiitoitsu', han: 2 } : null;
};

export const detectTanyao: YakuDetector = (hand) => {
  const allSimples = hand.allTiles.every((t) => !isTerminalOrHonor(t));
  return allSimples ? { name: 'Tanyao', han: 1 } : null;
};
