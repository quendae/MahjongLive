import type { ScoredHand } from '../scoring/score';
import type { Tile, Wind } from '../tiles/types';
import type { Wall } from '../wall/wall';
import type { WinningMeld } from '../yaku/context';

export type PlayerIndex = 0 | 1 | 2 | 3;

export interface PlayerMeld extends WinningMeld {
  /** Source seat for called melds; absent for concealed Kans / legacy fixtures. */
  calledFrom?: PlayerIndex;
  /** Physical ID of the claimed discard when applicable. */
  calledTileId?: number;
}

export interface RoundDiscard {
  tile: Tile;
  tileId: number;
  tsumogiri: boolean;
  /** This discard followed the final live-wall draw, so a Ron on it is Houtei. */
  wasLastLiveDraw: boolean;
  /** Filled by Plan 6 when a discard is claimed for Chi/Pon/Kan. */
  calledBy?: PlayerIndex;
}

export type RiichiState = 'none' | 'riichi' | 'double-riichi';

export interface RoundPlayerState {
  points: number;
  concealed: readonly Tile[];
  melds: readonly PlayerMeld[];
  discards: readonly RoundDiscard[];
  riichi: RiichiState;
  ippatsuEligible: boolean;
  drawCount: number;
  discardCount: number;
}

export interface RonClaim {
  player: PlayerIndex;
  score: ScoredHand;
}

export type RoundPhase =
  | { kind: 'awaiting-draw'; player: PlayerIndex }
  | {
      kind: 'awaiting-discard';
      player: PlayerIndex;
      drawnTileId: number;
      wasLastLiveDraw: boolean;
    }
  | {
      kind: 'reactions';
      discarder: PlayerIndex;
      discardIndex: number;
      ronClaims: readonly RonClaim[];
    }
  | { kind: 'ended'; result: RoundEndResult };

export interface RoundState {
  wall: Wall;
  players: readonly [RoundPlayerState, RoundPlayerState, RoundPlayerState, RoundPlayerState];
  dealer: PlayerIndex;
  roundWind: Wind;
  honba: number;
  riichiSticks: number;
  currentPlayer: PlayerIndex;
  callsMade: number;
  phase: RoundPhase;
}

export interface RoundOptions {
  dealer?: PlayerIndex;
  roundWind?: Wind;
  honba?: number;
  riichiSticks?: number;
  startingPoints?: number | readonly [number, number, number, number];
}

export type RoundEndResult =
  | {
      type: 'tsumo';
      winner: PlayerIndex;
      score: ScoredHand;
    }
  | {
      type: 'ron';
      discarder: PlayerIndex;
      winners: readonly RonClaim[];
    }
  | {
      type: 'exhaustive-draw';
    };

export type RoundAction =
  | { type: 'draw'; player: PlayerIndex }
  | { type: 'discard'; player: PlayerIndex; tileId: number }
  | { type: 'tsumo'; player: PlayerIndex }
  | { type: 'ron'; player: PlayerIndex }
  | { type: 'resolve-reactions' };

export type LegalAction =
  | { type: 'draw' }
  | { type: 'discard'; tileIds: readonly number[] }
  | { type: 'tsumo' }
  | { type: 'ron' };

export type RoundEvent =
  | { type: 'TileDrawn'; player: PlayerIndex; tile: Tile; wasLastLiveDraw: boolean }
  | { type: 'TileDiscarded'; player: PlayerIndex; discard: RoundDiscard }
  | { type: 'RonClaimed'; player: PlayerIndex; discarder: PlayerIndex; tile: Tile }
  | { type: 'HandWon'; result: Extract<RoundEndResult, { type: 'tsumo' | 'ron' }> }
  | { type: 'RoundEnded'; result: RoundEndResult };

export type EngineErrorCode =
  | 'ROUND_ENDED'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'NO_LIVE_TILES'
  | 'TILE_NOT_FOUND'
  | 'MISSING_TILE_ID'
  | 'ILLEGAL_WIN'
  | 'CANNOT_RON_OWN_DISCARD'
  | 'DUPLICATE_RON_CLAIM';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export type ApplyActionResult =
  | { ok: true; state: RoundState; events: readonly RoundEvent[] }
  | { ok: false; error: EngineError };
