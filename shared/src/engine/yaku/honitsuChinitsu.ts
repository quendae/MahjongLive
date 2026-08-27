import { YakuDetector, WinningHand } from './context';

function suitsPresent(hand: WinningHand): Set<string> {
  return new Set(
    hand.allTiles.filter((t) => t.kind === 'suited').map((t) => (t.kind === 'suited' ? t.suit : '')),
  );
}

export const detectHonitsu: YakuDetector = (hand) => {
  const suits = suitsPresent(hand);
  const hasHonor = hand.allTiles.some((t) => t.kind === 'honor');
  return suits.size === 1 && hasHonor ? { name: 'Honitsu', han: 3 } : null;
};

export const detectChinitsu: YakuDetector = (hand) => {
  const suits = suitsPresent(hand);
  const hasHonor = hand.allTiles.some((t) => t.kind === 'honor');
  return suits.size === 1 && !hasHonor ? { name: 'Chinitsu', han: 6 } : null;
};
