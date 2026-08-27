import { YakuDetector, StandardWinningHand } from './context';
import { isTerminal, isTerminalOrHonor } from '../tiles/tiles';
import { Tile } from '../tiles/types';
import { Meld } from '../hand/decompose';

// OPEN-HAND NOTE: Chanta and Junchan both lose a han when the hand is open — Chanta is 2 han
// closed / 1 han open, Junchan is 3 han closed / 2 han open. Both detectors below return only
// the closed-hand value (2 and 3). This plan never constructs an open WinningHand (see the
// plan's "Open Hands" section), so no closed-hand check appears here — add one, and the reduced
// open-hand values, when open melds exist.

// SHAPE NOTE: both detectors are gated to standard-shape hands. Standard Riichi/Tenhou rules do
// not award Chanta to a seven-pairs (Chiitoitsu) hand: Chanta's rule is defined over "every meld
// and the pair", a structure Chiitoitsu does not have, and Chiitoitsu is scored on its own (or
// with Honroutou when the hand is all terminals/honors), never stacked with Chanta. Junchan can
// never structurally fire on Chiitoitsu anyway — only 6 terminal tile types exist across the
// three suits while Chiitoitsu needs 7 distinct pair types — but it is gated too so the rule is
// explicit in code rather than an implicit consequence of arithmetic.

function groupsOf(hand: StandardWinningHand): (readonly Tile[])[] {
  return [...hand.melds.map((m: Meld) => m.tiles), hand.pair];
}

export const detectChanta: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const groups = groupsOf(hand);
  const allQualify = groups.every((group) => group.some(isTerminalOrHonor));
  return allQualify ? { name: 'Chanta', han: 2 } : null;
};

export const detectJunchan: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const groups = groupsOf(hand);
  const anyHonor = hand.allTiles.some((t) => t.kind === 'honor');
  if (anyHonor) return null;
  const allQualify = groups.every((group) => group.some(isTerminal));
  return allQualify ? { name: 'Junchan', han: 3 } : null;
};
