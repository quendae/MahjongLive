export type Suit = 'man' | 'pin' | 'sou';
export type SuitRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Wind = 'east' | 'south' | 'west' | 'north';
export type Dragon = 'white' | 'green' | 'red';

export interface SuitedTile {
  kind: 'suited';
  suit: Suit;
  rank: SuitRank;
  isRed: boolean;
}

export interface HonorTile {
  kind: 'honor';
  honorType: 'wind' | 'dragon';
  value: Wind | Dragon;
}

export type Tile = SuitedTile | HonorTile;
