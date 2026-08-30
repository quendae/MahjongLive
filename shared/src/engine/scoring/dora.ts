import { WinningHand } from '../yaku/context';
import { dragon, suited, tileTypeKey, wind } from '../tiles/tiles';
import { Dragon, SuitRank, Tile, Wind } from '../tiles/types';

export interface DoraContext {
  /** Includes the initial indicator and every active Kan-Dora indicator. */
  doraIndicators: readonly Tile[];
  /** Includes initial Ura plus active Kan-Ura indicators. Ignored without Riichi. */
  uraIndicators?: readonly Tile[];
}

export interface DoraBreakdown {
  dora: number;
  uraDora: number;
  akaDora: number;
  total: number;
}

const WIND_ORDER: readonly Wind[] = ['east', 'south', 'west', 'north'];
const DRAGON_ORDER: readonly Dragon[] = ['white', 'green', 'red'];

export function doraFromIndicator(indicator: Tile): Tile {
  if (indicator.kind === 'suited') {
    const nextRank = indicator.rank === 9 ? 1 : ((indicator.rank + 1) as SuitRank);
    return suited(indicator.suit, nextRank);
  }

  if (indicator.honorType === 'wind') {
    const index = WIND_ORDER.indexOf(indicator.value as Wind);
    return wind(WIND_ORDER[(index + 1) % WIND_ORDER.length]);
  }

  const index = DRAGON_ORDER.indexOf(indicator.value as Dragon);
  return dragon(DRAGON_ORDER[(index + 1) % DRAGON_ORDER.length]);
}

function countMatchingIndicators(tiles: readonly Tile[], indicators: readonly Tile[]): number {
  let count = 0;
  for (const indicator of indicators) {
    const doraKey = tileTypeKey(doraFromIndicator(indicator));
    count += tiles.filter((tile) => tileTypeKey(tile) === doraKey).length;
  }
  return count;
}

export function countDora(hand: WinningHand, context: DoraContext): DoraBreakdown {
  const dora = countMatchingIndicators(hand.allTiles, context.doraIndicators);
  const canUseUra = hand.isRiichi || hand.isDoubleRiichi === true;
  const uraDora = canUseUra
    ? countMatchingIndicators(hand.allTiles, context.uraIndicators ?? [])
    : 0;
  const akaDora = hand.allTiles.filter((tile) => tile.kind === 'suited' && tile.isRed).length;

  return {
    dora,
    uraDora,
    akaDora,
    total: dora + uraDora + akaDora,
  };
}
