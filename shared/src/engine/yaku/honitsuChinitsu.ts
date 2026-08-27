import { YakuDetector, WinningHand } from './context';
import { Tile, Suit } from '../tiles/types';

// OPEN-HAND NOTE: Honitsu and Chinitsu both lose a han when the hand is open — Honitsu is 3 han
// closed / 2 han open, Chinitsu is 6 han closed / 5 han open. Both detectors below return only
// the closed-hand value (3 and 6). This plan never constructs an open WinningHand (see the
// plan's "Open Hands" section), so no closed-hand check appears here — add one, and the reduced
// open-hand values, when open melds exist.

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
  return suits.size === 1 && hasHonor ? { name: 'Honitsu', han: 3 } : null;
};

export const detectChinitsu: YakuDetector = (hand) => {
  const suits = suitsPresent(hand);
  const hasHonor = hand.allTiles.some((t) => t.kind === 'honor');
  return suits.size === 1 && !hasHonor ? { name: 'Chinitsu', han: 6 } : null;
};
