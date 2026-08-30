import type {
  LegalAction,
  PlayerIndex,
  PlayerMeld,
  RiichiState,
  RoundAction,
  RoundDiscard,
  RoundEndResult,
  RoundEvent,
  RoundState,
} from '@mahjong-live/shared/rules';
import type { Tile, Wind } from '@mahjong-live/shared/tile-types';

export type ClientId = string;
export type RoomId = string;

export interface RoomMember {
  clientId: ClientId;
  displayName: string;
  ready: boolean;
}

export type RoomSeats = readonly [
  RoomMember | null,
  RoomMember | null,
  RoomMember | null,
  RoomMember | null,
];

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export type PlayerRoundAction = Exclude<RoundAction, { type: 'resolve-reactions' }>;

export type ClientCommand =
  | { type: 'set-ready'; ready: boolean }
  | { type: 'start-round'; seed: number }
  | { type: 'round-action'; action: PlayerRoundAction }
  | { type: 'pass' };

export interface CommandEnvelope {
  commandId: string;
  expectedVersion: number;
  command: ClientCommand;
}

export type CommandErrorCode =
  | 'UNKNOWN_CLIENT'
  | 'STALE_VERSION'
  | 'HOST_ONLY'
  | 'ROOM_FULL'
  | 'ROOM_NOT_LOBBY'
  | 'ROOM_NOT_PLAYING'
  | 'SEAT_TAKEN'
  | 'INVALID_SEAT'
  | 'NOT_READY'
  | 'WRONG_SEAT'
  | 'SERVER_ONLY'
  | 'NOT_REACTION_PHASE'
  | 'NOT_ELIGIBLE'
  | 'ALREADY_RESPONDED'
  | 'ENGINE_REJECTED';

export type CommandReceipt =
  | {
      ok: true;
      commandId: string;
      version: number;
      duplicate: boolean;
    }
  | {
      ok: false;
      commandId: string;
      version: number;
      code: CommandErrorCode;
      message: string;
      engineCode?: string;
    };

export type JoinResult =
  | { ok: true; seat: PlayerIndex; version: number }
  | { ok: false; code: Extract<CommandErrorCode, 'ROOM_FULL' | 'ROOM_NOT_LOBBY' | 'SEAT_TAKEN' | 'INVALID_SEAT'>; message: string };

export interface LobbySeatView {
  seat: PlayerIndex;
  occupied: boolean;
  displayName: string | null;
  ready: boolean;
  isHost: boolean;
}

export interface PlayerView {
  seat: PlayerIndex;
  points: number;
  concealed: readonly Tile[] | null;
  concealedCount: number;
  melds: readonly PlayerMeld[];
  discards: readonly RoundDiscard[];
  riichi: RiichiState;
  drawCount: number;
  discardCount: number;
  privateState?: {
    ippatsuEligible: boolean;
    temporaryFuriten: boolean;
    riichiFuriten: boolean;
  };
}

export type PublicRoundPhase =
  | { kind: 'awaiting-draw'; player: PlayerIndex }
  | {
      kind: 'awaiting-discard';
      player: PlayerIndex;
      drawnTileId: number | null;
      wasLastLiveDraw: boolean;
      isRinshan: boolean;
      pendingKanDora: boolean;
    }
  | {
      kind: 'reactions';
      discarder: PlayerIndex;
      discardIndex: number;
      pendingRiichi?: { player: PlayerIndex; doubleRiichi: boolean };
    }
  | {
      kind: 'kan-reactions';
      declarer: PlayerIndex;
      meldIndex: number;
      addedTile: Tile;
    }
  | { kind: 'ended'; result: RoundEndResult };

export interface WallView {
  remainingLiveTiles: number;
  doraIndicators: readonly Tile[];
}

export interface RoundView {
  dealer: PlayerIndex;
  roundWind: Wind;
  honba: number;
  riichiSticks: number;
  currentPlayer: PlayerIndex;
  callsMade: number;
  phase: PublicRoundPhase;
  wall: WallView;
  players: readonly [PlayerView, PlayerView, PlayerView, PlayerView];
  legalActions: readonly LegalAction[];
}

export interface RoomView {
  id: RoomId;
  status: RoomStatus;
  version: number;
  viewerSeat: PlayerIndex | null;
  seats: readonly [LobbySeatView, LobbySeatView, LobbySeatView, LobbySeatView];
  round: RoundView | null;
}

export interface ReactionBarrierCheckpoint {
  phaseVersion: number;
  eligibleSeats: readonly PlayerIndex[];
  respondedSeats: readonly PlayerIndex[];
}

export interface RoomCheckpoint {
  id: RoomId;
  status: RoomStatus;
  version: number;
  hostClientId: ClientId | null;
  seats: RoomSeats;
  seed: number | null;
  round: RoundState | null;
  reaction: ReactionBarrierCheckpoint | null;
}

export interface RoomTransition {
  version: number;
  events: readonly RoundEvent[];
}

export type PublicEngineEvent =
  | RoundEvent
  | {
      type: 'TileDrawn';
      player: PlayerIndex;
      wasLastLiveDraw: boolean;
      isRinshan?: boolean;
    };
