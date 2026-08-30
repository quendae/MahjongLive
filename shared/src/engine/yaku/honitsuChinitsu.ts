import { YakuDetector, WinningHand, isClosedHand } from './context';
import { Tile, Suit } from '../tiles/types';

function suitsPresent(hand: WinningHand): Set<Suit> {
  return new Set(
    hand.allTiles
      .filter((t): t is Extract<Tile, { kind: 'suited' }> => t.kind === 'suited')
      .map((t) => t.suit),
  );
}

export const detectHonitsu: YakuDetector = (hand) => {
  const suits = suitsPresent(hand);
  const hasHonor = hand.allTiles.some((t) => t.kind === 'honor');
  return suits.size === 1 && hasHonor
    ? { name: 'Honitsu', han: isClosedHand(hand) ? 3 : 2 }
    : null;
};

export const detectChinitsu: YakuDetector = (hand) => {
  const suits = suitsPresent(hand);
  const hasHonor = hand.allTiles.some((t) => t.kind === 'honor');
  return suits.size === 1 && !hasHonor
    ? { name: 'Chinitsu', han: isClosedHand(hand) ? 6 : 5 }
    : null;
};
