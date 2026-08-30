import { isTerminalOrHonor } from '../tiles/tiles';
import { Tile } from '../tiles/types';

export interface NagashiDiscard {
  tile: Tile;
  wasCalled: boolean;
}

export interface NagashiManganResult {
  name: 'Nagashi Mangan';
  limit: 'mangan';
}

/**
 * Evaluates only the player's discard-history portion of Nagashi Mangan. The caller is responsible
 * for invoking it only when the hand reaches exhaustive draw.
 */
export function detectNagashiMangan(
  discards: readonly NagashiDiscard[],
): NagashiManganResult | null {
  if (discards.length === 0) return null;
  const qualifies = discards.every(
    (discard) => !discard.wasCalled && isTerminalOrHonor(discard.tile),
  );
  return qualifies ? { name: 'Nagashi Mangan', limit: 'mangan' } : null;
}
