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
  /** This discard followed the final normal live-wall draw, so a Ron on it is Houtei. */
  wasLastLiveDraw: boolean;
  /** Set when this discard is consumed by a Chi/Pon/Daiminkan. */
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
  temporaryFuriten: boolean;
  riichiFuriten: boolean;
  drawCount: number;
  discardCount: number;
}

export interface RonClaim {
  player: PlayerIndex;
  score: ScoredHand;
}

export type CallKind = 'chi' | 'pon' | 'daiminkan';

export interface CallClaim {
  player: PlayerIndex;
  kind: CallKind;
  /** Two physical IDs for Chi/Pon, three for Daiminkan. */
  tileIds: readonly number[];
}

export interface PendingRiichi {
  player: PlayerIndex;
  tileId: number;
  doubleRiichi: boolean;
}

export type RoundPhase =
  | { kind: 'awaiting-draw'; player: PlayerIndex }
  | {
      kind: 'awaiting-discard';
      player: PlayerIndex;
      /** Null after a resolved Chi/Pon because the caller did not draw. */
      drawnTileId: number | null;
      wasLastLiveDraw: boolean;
      /** The current draw came from the dead wall after a completed Kan. */
      isRinshan?: boolean;
      /** Tenhou-style delayed Dora from a Daiminkan/Shouminkan, revealed on discard/chained Kan. */
      pendingKanDora?: boolean;
    }
  | {
      kind: 'reactions';
      discarder: PlayerIndex;
      discardIndex: number;
      ronClaims: readonly RonClaim[];
      callClaims: readonly CallClaim[];
      pendingRiichi?: PendingRiichi;
    }
  | {
      /** Shouminkan has been declared but has not yet completed because Chankan is possible. */
      kind: 'kan-reactions';
      declarer: PlayerIndex;
      meldIndex: number;
      addedTile: Tile;
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

export type PointDeltaTuple = readonly [number, number, number, number];

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
      notenPayments: PointDeltaTuple;
      /** Present only when Nagashi Mangan replaces ordinary noten settlement. */
      nagashiPlayers?: readonly PlayerIndex[];
      nagashiPayments?: PointDeltaTuple;
    };

export type RoundAction =
  | { type: 'draw'; player: PlayerIndex }
  | { type: 'discard'; player: PlayerIndex; tileId: number }
  | { type: 'riichi-discard'; player: PlayerIndex; tileId: number }
  | { type: 'tsumo'; player: PlayerIndex }
  | { type: 'ron'; player: PlayerIndex }
  | { type: 'chi'; player: PlayerIndex; tileIds: readonly [number, number] }
  | { type: 'pon'; player: PlayerIndex; tileIds: readonly [number, number] }
  | { type: 'daiminkan'; player: PlayerIndex; tileIds: readonly [number, number, number] }
  | { type: 'ankan'; player: PlayerIndex; tileIds: readonly [number, number, number, number] }
  | { type: 'shouminkan'; player: PlayerIndex; meldIndex: number; tileId: number }
  | { type: 'resolve-reactions' };

export type LegalAction =
  | { type: 'draw' }
  | { type: 'discard'; tileIds: readonly number[] }
  | { type: 'riichi-discard'; tileIds: readonly number[] }
  | { type: 'tsumo' }
  | { type: 'ron' }
  | { type: 'chi'; options: readonly (readonly [number, number])[] }
  | { type: 'pon'; options: readonly (readonly [number, number])[] }
  | { type: 'daiminkan'; options: readonly (readonly [number, number, number])[] }
  | { type: 'ankan'; options: readonly (readonly [number, number, number, number])[] }
  | { type: 'shouminkan'; options: readonly { meldIndex: number; tileId: number }[] };

export type RoundEvent =
  | { type: 'TileDrawn'; player: PlayerIndex; tile: Tile; wasLastLiveDraw: boolean; isRinshan?: boolean }
  | { type: 'TileDiscarded'; player: PlayerIndex; discard: RoundDiscard }
  | { type: 'RiichiDeclared'; player: PlayerIndex; doubleRiichi: boolean; tileId: number }
  | { type: 'RonClaimed'; player: PlayerIndex; discarder: PlayerIndex; tile: Tile; chankan?: boolean }
  | { type: 'CallClaimed'; player: PlayerIndex; kind: CallKind; discarder: PlayerIndex }
  | { type: 'CallMade'; player: PlayerIndex; kind: CallKind; meld: PlayerMeld }
  | { type: 'KanDeclared'; player: PlayerIndex; kind: 'ankan' | 'shouminkan'; meldIndex?: number }
  | { type: 'KanCompleted'; player: PlayerIndex; kind: 'ankan' | 'daiminkan' | 'shouminkan'; meld: PlayerMeld }
  | { type: 'DoraIndicatorRevealed'; count: number }
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
  | 'ILLEGAL_KAN'
  | 'KAN_LIMIT'
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
