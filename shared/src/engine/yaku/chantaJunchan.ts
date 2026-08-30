import { YakuDetector, StandardWinningHand, isClosedHand } from './context';
import { isTerminal, isTerminalOrHonor } from '../tiles/tiles';
import { Tile } from '../tiles/types';

// SHAPE NOTE: both detectors are gated to standard-shape hands. Standard Riichi/Tenhou rules do
// not award Chanta to a seven-pairs (Chiitoitsu) hand: Chanta's rule is defined over "every meld
// and the pair", a structure Chiitoitsu does not have, and Chiitoitsu is scored on its own (or
// with Honroutou when the hand is all terminals/honors), never stacked with Chanta. Both Chanta
// and Junchan also require at least one sequence; an all-triplet outside hand belongs to the
// Honroutou/Chinroutou families instead.

function groupsOf(hand: StandardWinningHand): (readonly Tile[])[] {
  return [...hand.melds.map((m) => m.tiles), hand.pair];
}

export const detectChanta: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (!hand.melds.some((meld) => meld.type === 'sequence')) return null;
  const groups = groupsOf(hand);
  const allQualify = groups.every((group) => group.some(isTerminalOrHonor));
  return allQualify ? { name: 'Chanta', han: isClosedHand(hand) ? 2 : 1 } : null;
};

export const detectJunchan: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (!hand.melds.some((meld) => meld.type === 'sequence')) return null;
  const groups = groupsOf(hand);
  const anyHonor = hand.allTiles.some((t) => t.kind === 'honor');
  if (anyHonor) return null;
  const allQualify = groups.every((group) => group.some(isTerminal));
  return allQualify ? { name: 'Junchan', han: isClosedHand(hand) ? 3 : 2 } : null;
};
