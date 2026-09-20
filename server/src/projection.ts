import { getLegalActions } from '@mahjong-live/shared/rules';
import type { PlayerIndex, RoundEvent, RoundState } from '@mahjong-live/shared/rules';
import type { MatchState } from '@mahjong-live/shared/match';
import type {
  LobbySeatView,
  MatchView,
  PlayerView,
  PublicEngineEvent,
  PublicRoundPhase,
  RoomDeadline,
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
  match: MatchState | null;
  round: RoundState | null;
  viewerSeat: PlayerIndex | null;
  respondedSeats?: ReadonlySet<PlayerIndex>;
  deadline?: RoomDeadline | null;
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
    bot: member?.bot?.profile ?? null,
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

function matchView(match: MatchState): MatchView {
  return {
    status: match.status,
    wind: match.wind,
    hand: match.hand,
    roundNumber: match.roundNumber,
    result: match.result ?? null,
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
    match: context.match ? matchView(context.match) : null,
    round: context.round
      ? projectRound(context.round, context.viewerSeat, context.respondedSeats)
      : null,
    deadline: context.deadline
      ? { kind: context.deadline.kind, expiresAt: context.deadline.expiresAt }
      : null,
  };
}

/**
 * Converts an authoritative engine event into something safe to send to one viewer.
 * Claim events stay server-side until the reaction barrier resolves.
 *
 * Exhaustive by design: there is no default branch, so a new `RoundEvent` member
 * makes the end of this function reachable and `tsc` fails (TS2366) instead of
 * shipping the new payload to all four clients.
 */
export function projectEngineEvent(
  event: RoundEvent,
  viewerSeat: PlayerIndex | null,
): PublicEngineEvent | null {
  switch (event.type) {
    // Per-seat: only the drawing seat learns which tile left the wall.
    case 'TileDrawn':
      return viewerSeat === event.player
        ? event
        : {
            type: 'TileDrawn',
            player: event.player,
            wasLastLiveDraw: event.wasLastLiveDraw,
            ...(event.isRinshan ? { isRinshan: true } : {}),
          };
    // In-flight claims: withheld from everyone until the barrier resolves.
    case 'RonClaimed':
    case 'CallClaimed':
      return null;
    // Public to every viewer, spectators included.
    case 'TileDiscarded':
    case 'RiichiDeclared':
    case 'CallMade':
    case 'KanDeclared':
    case 'KanCompleted':
    case 'DoraIndicatorRevealed':
    case 'HandWon':
    case 'RoundEnded':
      return event;
  }
}
