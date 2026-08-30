import { Tile, SuitRank, Wind, Dragon } from '../tiles/types';
import { allTileTypes, suited } from '../tiles/tiles';
import { RNG } from './prng';

export interface Wall {
  liveWall: Tile[];
  deadWall: Tile[];
  doraIndicators: Tile[];
}

const RED_FIVE_SUITS = ['man', 'pin', 'sou'] as const;
const MAX_DORA_INDICATORS = 5;
const URA_OFFSET = 5;
const RINSHAN_INDEX = 10;

export function build136Tiles(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (const type of allTileTypes()) {
    for (let copy = 0; copy < 4; copy++) {
      if (type.kind === 'suited') {
        const isRedFive =
          type.rank === 5 && copy === 0 && (RED_FIVE_SUITS as readonly string[]).includes(type.suit);
        tiles.push({ ...type, isRed: isRedFive, id: id++ });
      } else {
        tiles.push({ ...type, id: id++ });
      }
    }
  }
  return tiles;
}

function shuffle(tiles: Tile[], rng: RNG): Tile[] {
  const result = [...tiles];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildWall(rng: RNG): Wall {
  const shuffled = shuffle(build136Tiles(), rng);
  const deadWall = shuffled.slice(0, 14);
  const liveWall = shuffled.slice(14);
  return { liveWall, deadWall, doraIndicators: [deadWall[0]] };
}

export function drawTile(wall: Wall): { tile: Tile; wall: Wall } {
  if (wall.liveWall.length === 0) {
    throw new Error('Cannot draw from an empty live wall');
  }
  const [tile, ...rest] = wall.liveWall;
  return { tile, wall: { ...wall, liveWall: rest } };
}

/**
 * Draws the next replacement tile after a completed Kan.
 *
 * The engine uses an abstract dead-wall layout where slot 10 is always the next Rinshan tile.
 * After removing it, the final live-wall tile replenishes the dead wall. Appending the replacement
 * makes the former slot 11 become the next slot 10, so repeated calls naturally consume the four
 * original Rinshan tiles in order while preserving a 14-tile dead wall.
 */
export function drawRinshan(wall: Wall): { tile: Tile; wall: Wall } {
  const tile = wall.deadWall[RINSHAN_INDEX];
  if (!tile) throw new Error('No Rinshan tile is available');
  if (wall.liveWall.length === 0) throw new Error('Cannot replenish the dead wall from an empty live wall');

  const replacement = wall.liveWall[wall.liveWall.length - 1];
  const liveWall = wall.liveWall.slice(0, -1);
  const deadWall = [...wall.deadWall];
  deadWall.splice(RINSHAN_INDEX, 1);
  deadWall.push(replacement);

  return { tile, wall: { ...wall, liveWall, deadWall } };
}

export function revealKanDora(wall: Wall): Wall {
  const nextIndex = wall.doraIndicators.length;
  if (nextIndex >= MAX_DORA_INDICATORS) {
    throw new Error('No more dora indicators may be revealed');
  }
  const indicator = wall.deadWall[nextIndex];
  if (!indicator) {
    throw new Error('No more dead wall tiles available for a new dora indicator');
  }
  return { ...wall, doraIndicators: [...wall.doraIndicators, indicator] };
}

/** Hidden Ura indicators paired one-for-one with the currently visible Dora indicators. */
export function uraIndicators(wall: Wall): readonly Tile[] {
  return wall.deadWall.slice(URA_OFFSET, URA_OFFSET + wall.doraIndicators.length);
}

export function remainingDraws(wall: Wall): number {
  return wall.liveWall.length;
}

const NEXT_RANK: Record<SuitRank, SuitRank> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 1 };
const NEXT_WIND: Record<Wind, Wind> = { east: 'south', south: 'west', west: 'north', north: 'east' };
const NEXT_DRAGON: Record<Dragon, Dragon> = { white: 'green', green: 'red', red: 'white' };

export function doraFromIndicator(indicator: Tile): Tile {
  if (indicator.kind === 'suited') {
    return suited(indicator.suit, NEXT_RANK[indicator.rank], false);
  }
  if (indicator.honorType === 'wind') {
    return { kind: 'honor', honorType: 'wind', value: NEXT_WIND[indicator.value as Wind] };
  }
  return { kind: 'honor', honorType: 'dragon', value: NEXT_DRAGON[indicator.value as Dragon] };
}
