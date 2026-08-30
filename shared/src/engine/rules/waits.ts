import { allTileTypes, tileTypeKey } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type { WinningMeld } from '../yaku/context';
import type { RoundPlayerState } from './types';
import { resolveWinningHands } from './winning';

function physicalTypeCounts(
  concealed: readonly Tile[],
  fixedMelds: readonly WinningMeld[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of [...concealed, ...fixedMelds.flatMap((meld) => meld.tiles)]) {
    const key = tileTypeKey(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Every tile type that structurally completes the player's current pre-win tile state.
 *
 * This deliberately ignores yaku. Furiten and Riichi-tenpai are properties of the hand's waits,
 * not of whether one particular candidate happens to carry enough yaku to score right now.
 */
export function winningTileTypeKeys(
  concealedBeforeWin: readonly Tile[],
  fixedMelds: readonly WinningMeld[] = [],
): Set<string> {
  const waits = new Set<string>();
  const counts = physicalTypeCounts(concealedBeforeWin, fixedMelds);

  for (const tileType of allTileTypes()) {
    const key = tileTypeKey(tileType);
    if ((counts.get(key) ?? 0) >= 4) continue;
    const candidates = resolveWinningHands({
      concealedBeforeWin,
      winningTile: tileType,
      fixedMelds,
      winCondition: 'ron',
      seatWind: 'south',
      roundWind: 'east',
    });
    if (candidates.length > 0) waits.add(key);
  }

  return waits;
}

export function isStructurallyTenpai(
  concealedBeforeWin: readonly Tile[],
  fixedMelds: readonly WinningMeld[] = [],
): boolean {
  return winningTileTypeKeys(concealedBeforeWin, fixedMelds).size > 0;
}

export function isDiscardFuriten(player: Pick<RoundPlayerState, 'concealed' | 'melds' | 'discards'>): boolean {
  const waits = winningTileTypeKeys(player.concealed, player.melds);
  if (waits.size === 0) return false;
  return player.discards.some((discard) => waits.has(tileTypeKey(discard.tile)));
}

export function isRonFuriten(
  player: Pick<
    RoundPlayerState,
    'concealed' | 'melds' | 'discards' | 'temporaryFuriten' | 'riichiFuriten'
  >,
): boolean {
  return player.temporaryFuriten || player.riichiFuriten || isDiscardFuriten(player);
}
