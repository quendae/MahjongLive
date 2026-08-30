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
  /** Set when this discard is consumed by a Chi/Pon/Kan. */
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
  /** Passed a legal Ron since the previous own draw. */
  temporaryFuriten: boolean;
  /** Passed a legal Ron after declaring Riichi; persists for the hand. */
  riichiFuriten: boolean;
  drawCount: number;
  discardCount: number;
}

export interface RonClaim {
  player: PlayerIndex;
  score: ScoredHand;
}

export type CallKind = 'chi' | 'pon';

export interface CallClaim {
  player: PlayerIndex;
  kind: CallKind;
  /** Exact two physical hand tiles used with the current reaction discard. */
  tileIds: readonly [number, number];
}

export type RoundPhase =
  | { kind: 'awaiting-draw'; player: PlayerIndex }
  | {
      kind: 'awaiting-discard';
      player: PlayerIndex;
      /** Null after a resolved Chi/Pon because the caller did not draw. */
      drawnTileId: number | null;
      wasLastLiveDraw: boolean;
    }
  | {
      kind: 'reactions';
      discarder: PlayerIndex;
      discardIndex: number;
      ronClaims: readonly RonClaim[];
      callClaims: readonly CallClaim[];
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
      tenpaiPlayers: readonly PlayerIndex[];
      /** Per-seat point delta from the 3,000-point noten pool. */
      notenPayments: readonly [number, number, number, number];
    };

export type RoundAction =
  | { type: 'draw'; player: PlayerIndex }
  | { type: 'discard'; player: PlayerIndex; tileId: number }
  | { type: 'riichi-discard'; player: PlayerIndex; tileId: number }
  | { type: 'tsumo'; player: PlayerIndex }
  | { type: 'ron'; player: PlayerIndex }
  | { type: 'chi'; player: PlayerIndex; tileIds: readonly [number, number] }
  | { type: 'pon'; player: PlayerIndex; tileIds: readonly [number, number] }
  | { type: 'resolve-reactions' };

export type LegalAction =
  | { type: 'draw' }
  | { type: 'discard'; tileIds: readonly number[] }
  | { type: 'riichi-discard'; tileIds: readonly number[] }
  | { type: 'tsumo' }
  | { type: 'ron' }
  | { type: 'chi'; options: readonly (readonly [number, number])[] }
  | { type: 'pon'; options: readonly (readonly [number, number])[] };

export type RoundEvent =
  | { type: 'TileDrawn'; player: PlayerIndex; tile: Tile; wasLastLiveDraw: boolean }
  | { type: 'TileDiscarded'; player: PlayerIndex; discard: RoundDiscard }
  | { type: 'RiichiDeclared'; player: PlayerIndex; doubleRiichi: boolean; tileId: number }
  | { type: 'RonClaimed'; player: PlayerIndex; discarder: PlayerIndex; tile: Tile }
  | { type: 'CallClaimed'; player: PlayerIndex; kind: CallKind; discarder: PlayerIndex }
  | { type: 'CallMade'; player: PlayerIndex; kind: CallKind; meld: PlayerMeld }
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
  | 'ILLEGAL_RIICHI'
  | 'FURITEN'
  | 'ILLEGAL_CALL'
  | 'CANNOT_RON_OWN_DISCARD'
  | 'DUPLICATE_RON_CLAIM'
  | 'DUPLICATE_CALL_CLAIM';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export type ApplyActionResult =
  | { ok: true; state: RoundState; events: readonly RoundEvent[] }
  | { ok: false; error: EngineError };
