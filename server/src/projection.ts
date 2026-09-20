import { getLegalActions } from '@mahjong-live/shared/rules';
import type { PlayerIndex, RoundEvent, RoundState } from '@mahjong-live/shared/rules';
import type {
  LobbySeatView,
  PlayerView,
  PublicEngineEvent,
  PublicRoundPhase,
  RoomMember,
  RoomSeats,
  RoomStatus,
  RoomView,
  RoundView,
} from './protocol';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];

export interface ProjectionContext {
  roomId: string;
  status: RoomStatus;
  version: number;
  hostClientId: string | null;
  seats: RoomSeats;
  round: RoundState | null;
  viewerSeat: PlayerIndex | null;
  respondedSeats?: ReadonlySet<PlayerIndex>;
}

function seatView(
  seat: PlayerIndex,
  member: RoomMember | null,
  hostClientId: string | null,
): LobbySeatView {
  return {
    seat,
    occupied: member !== null,
    displayName: member?.displayName ?? null,
    ready: member?.ready ?? false,
    isHost: member !== null && member.clientId === hostClientId,
  };
}

function projectPhase(state: RoundState, viewerSeat: PlayerIndex | null): PublicRoundPhase {
  const phase = state.phase;
  switch (phase.kind) {
    case 'awaiting-draw':
      return { kind: 'awaiting-draw', player: phase.player };
    case 'awaiting-discard':
      return {
        kind: 'awaiting-discard',
        player: phase.player,
        drawnTileId: viewerSeat === phase.player ? phase.drawnTileId : null,
        wasLastLiveDraw: phase.wasLastLiveDraw,
        isRinshan: phase.isRinshan === true,
        pendingKanDora: phase.pendingKanDora === true,
      };
    case 'reactions':
      return {
        kind: 'reactions',
        discarder: phase.discarder,
        discardIndex: phase.discardIndex,
        ...(phase.pendingRiichi
          ? {
              pendingRiichi: {
                player: phase.pendingRiichi.player,
                doubleRiichi: phase.pendingRiichi.doubleRiichi,
              },
            }
          : {}),
      };
    case 'kan-reactions':
      return {
        kind: 'kan-reactions',
        declarer: phase.declarer,
        meldIndex: phase.meldIndex,
        addedTile: phase.addedTile,
      };
    case 'ended':
      return { kind: 'ended', result: phase.result };
  }
}

function projectPlayer(
  state: RoundState,
  seat: PlayerIndex,
  viewerSeat: PlayerIndex | null,
): PlayerView {
  const player = state.players[seat];
  const own = viewerSeat === seat;
  return {
    seat,
    points: player.points,
    concealed: own ? player.concealed : null,
    concealedCount: player.concealed.length,
    melds: player.melds,
    discards: player.discards,
    riichi: player.riichi,
    drawCount: player.drawCount,
    discardCount: player.discardCount,
    ...(own
      ? {
          privateState: {
            ippatsuEligible: player.ippatsuEligible,
            temporaryFuriten: player.temporaryFuriten,
            riichiFuriten: player.riichiFuriten,
          },
        }
      : {}),
  };
}

export function projectRound(
  state: RoundState,
  viewerSeat: PlayerIndex | null,
  respondedSeats: ReadonlySet<PlayerIndex> = new Set(),
): RoundView {
  const playerViews = PLAYERS.map((seat) => projectPlayer(state, seat, viewerSeat)) as unknown as RoundView['players'];
  const alreadyResponded = viewerSeat !== null && respondedSeats.has(viewerSeat);
  return {
    dealer: state.dealer,
    roundWind: state.roundWind,
    honba: state.honba,
    riichiSticks: state.riichiSticks,
    currentPlayer: state.currentPlayer,
    callsMade: state.callsMade,
    phase: projectPhase(state, viewerSeat),
    wall: {
      remainingLiveTiles: state.wall.liveWall.length,
      doraIndicators: state.wall.doraIndicators,
    },
    players: playerViews,
    legalActions:
      viewerSeat === null || alreadyResponded ? [] : getLegalActions(state, viewerSeat),
  };
}

export function projectRoom(context: ProjectionContext): RoomView {
  const seats = PLAYERS.map((seat) =>
    seatView(seat, context.seats[seat], context.hostClientId),
  ) as unknown as RoomView['seats'];
  return {
    id: context.roomId,
    status: context.status,
    version: context.version,
    viewerSeat: context.viewerSeat,
    seats,
    round: context.round
      ? projectRound(context.round, context.viewerSeat, context.respondedSeats)
      : null,
  };
}

/**
 * Converts an authoritative engine event into something safe to send to one viewer.
 * Claim events stay server-side until the reaction barrier resolves.
 */
export function projectEngineEvent(
  event: RoundEvent,
  viewerSeat: PlayerIndex | null,
): PublicEngineEvent | null {
  if (event.type === 'RonClaimed' || event.type === 'CallClaimed') return null;
  if (event.type === 'TileDrawn' && viewerSeat !== event.player) {
    return {
      type: 'TileDrawn',
      player: event.player,
      wasLastLiveDraw: event.wasLastLiveDraw,
      ...(event.isRinshan ? { isRinshan: true } : {}),
    };
  }
  return event;
}
