import { Tile, SuitRank, Wind, Dragon } from '../tiles/types';
import { allTileTypes, suited } from '../tiles/tiles';
import { RNG } from './prng';

export interface Wall {
  liveWall: Tile[];
  deadWall: Tile[];
  doraIndicators: Tile[];
}

const RED_FIVE_SUITS = ['man', 'pin', 'sou'] as const;

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

export function revealKanDora(wall: Wall): Wall {
  const nextIndex = wall.doraIndicators.length;
  const indicator = wall.deadWall[nextIndex];
  if (!indicator) {
    throw new Error('No more dead wall tiles available for a new dora indicator');
  }
  return { ...wall, doraIndicators: [...wall.doraIndicators, indicator] };
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
