export type Suit = 'man' | 'pin' | 'sou';
export type SuitRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Wind = 'east' | 'south' | 'west' | 'north';
export type Dragon = 'white' | 'green' | 'red';

/**
 * Physical tile ID used by real wall/round state. Hand-written rule fixtures may omit it.
 * Tile equality and type keys deliberately ignore this field.
 */
export interface PhysicalTileIdentity {
  id?: number;
}

export interface SuitedTile extends PhysicalTileIdentity {
  kind: 'suited';
  suit: Suit;
  rank: SuitRank;
  isRed: boolean;
}

export interface HonorTile extends PhysicalTileIdentity {
  kind: 'honor';
  honorType: 'wind' | 'dragon';
  value: Wind | Dragon;
}

export type Tile = SuitedTile | HonorTile;
