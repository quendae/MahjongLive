import { Tile, SuitedTile, HonorTile, Suit, SuitRank, Wind, Dragon } from './types';

const SUITS: Suit[] = ['man', 'pin', 'sou'];
const WINDS: Wind[] = ['east', 'south', 'west', 'north'];
const DRAGONS: Dragon[] = ['white', 'green', 'red'];

export function suited(suit: Suit, rank: SuitRank, isRed = false): SuitedTile {
  return { kind: 'suited', suit, rank, isRed };
}

export function wind(value: Wind): HonorTile {
  return { kind: 'honor', honorType: 'wind', value };
}

export function dragon(value: Dragon): HonorTile {
  return { kind: 'honor', honorType: 'dragon', value };
}

export function tileTypeKey(tile: Tile): string {
  if (tile.kind === 'suited') return `${tile.suit}${tile.rank}`;
  return `${tile.honorType[0]}-${tile.value}`;
}

export function tilesEqual(a: Tile, b: Tile): boolean {
  return tileTypeKey(a) === tileTypeKey(b);
}

export function allTileTypes(): Tile[] {
  const types: Tile[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      types.push(suited(suit, rank as SuitRank));
    }
  }
  for (const w of WINDS) types.push(wind(w));
  for (const d of DRAGONS) types.push(dragon(d));
  return types;
}

const TYPE_ORDER = allTileTypes().map(tileTypeKey);

export function compareTiles(a: Tile, b: Tile): number {
  return TYPE_ORDER.indexOf(tileTypeKey(a)) - TYPE_ORDER.indexOf(tileTypeKey(b));
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort(compareTiles);
}

export function isTerminal(tile: Tile): boolean {
  return tile.kind === 'suited' && (tile.rank === 1 || tile.rank === 9);
}

export function isHonor(tile: Tile): boolean {
  return tile.kind === 'honor';
}

export function isTerminalOrHonor(tile: Tile): boolean {
  return isTerminal(tile) || isHonor(tile);
}
