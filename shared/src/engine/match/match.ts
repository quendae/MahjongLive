import { createRound } from '../rules/round';
import type { PlayerIndex, PointDeltaTuple, RoundEndResult } from '../rules/types';
import type { RNG } from '../wall/prng';
import type {
  MatchAdvanceResult,
  MatchEndReason,
  MatchHand,
  MatchOptions,
  MatchPlacement,
  MatchResult,
  MatchState,
  MatchWind,
} from './types';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];
const DEFAULT_STARTING_POINTS = 25_000;
const DEFAULT_TARGET_POINTS = 30_000;

function pointsTuple(values: readonly number[]): PointDeltaTuple {
  return [values[0], values[1], values[2], values[3]];
}

function initialPoints(options: MatchOptions): PointDeltaTuple {
  if (Array.isArray(options.startingPoints)) return pointsTuple(options.startingPoints);
  const value = typeof options.startingPoints === 'number'
    ? Math.trunc(options.startingPoints)
    : DEFAULT_STARTING_POINTS;
  return [value, value, value, value];
}

function currentPoints(state: MatchState): PointDeltaTuple {
  return pointsTuple(state.round.players.map((player) => player.points));
}

function dealerPriority(player: PlayerIndex, initialDealer: PlayerIndex): number {
  return (player - initialDealer + 4) % 4;
}

export function rankMatchPlayers(
  points: PointDeltaTuple,
  initialDealer: PlayerIndex,
): readonly [MatchPlacement, MatchPlacement, MatchPlacement, MatchPlacement] {
  const ordered = [...PLAYERS].sort((a, b) => {
    const delta = points[b] - points[a];
    if (delta !== 0) return delta;
    return dealerPriority(a, initialDealer) - dealerPriority(b, initialDealer);
  });
  return ordered.map((player, index) => ({
    player,
    place: (index + 1) as 1 | 2 | 3 | 4,
    points: points[player],
  })) as [MatchPlacement, MatchPlacement, MatchPlacement, MatchPlacement];
}

function finishMatch(state: MatchState, reason: MatchEndReason): MatchState {
  const rawPoints = currentPoints(state);
  const rawPlacements = rankMatchPlayers(rawPoints, state.initialDealer);
  const remainingSticks = Math.max(0, state.round.riichiSticks);
  const stickWinner = remainingSticks > 0 ? rawPlacements[0].player : null;
  const final = [...rawPoints];
  if (stickWinner !== null) final[stickWinner] += remainingSticks * 1000;
  const finalPoints = pointsTuple(final);
  const placements = rankMatchPlayers(finalPoints, state.initialDealer);
  const result: MatchResult = {
    reason,
    placements,
    finalPoints,
    riichiStickWinner: stickWinner,
  };
  return { ...state, status: 'ended', result };
}

export function createMatch(rng: RNG, options: MatchOptions = {}): MatchState {
  const initialDealer = options.initialDealer ?? 0;
  const targetPoints = Math.max(1, Math.trunc(options.targetPoints ?? DEFAULT_TARGET_POINTS));
  const points = initialPoints(options);
  return {
    status: 'playing',
    initialDealer,
    wind: 'east',
    hand: 1,
    targetPoints,
    roundNumber: 1,
    round: createRound(rng, {
      dealer: initialDealer,
      roundWind: 'east',
      honba: 0,
      riichiSticks: 0,
      startingPoints: points,
    }),
  };
}

export function dealerRepeats(result: RoundEndResult, dealer: PlayerIndex): boolean {
  if (result.type === 'tsumo') return result.winner === dealer;
  if (result.type === 'ron') return result.winners.some((winner) => winner.player === dealer);
  return result.tenpaiPlayers.includes(dealer);
}

function nextHandPosition(wind: MatchWind, hand: MatchHand): { wind: MatchWind; hand: MatchHand } {
  if (hand < 4) return { wind, hand: (hand + 1) as MatchHand };
  if (wind === 'east') return { wind: 'south', hand: 1 };
  if (wind === 'south') return { wind: 'west', hand: 1 };
  return { wind: 'west', hand: 4 };
}

function topPlayer(state: MatchState): MatchPlacement {
  return rankMatchPlayers(currentPoints(state), state.initialDealer)[0];
}

function dealerYameReason(result: RoundEndResult): MatchEndReason {
  return result.type === 'exhaustive-draw' ? 'tenpai-yame' : 'agari-yame';
}

function shouldDealerAutoStop(state: MatchState, repeats: boolean): boolean {
  if (!repeats) return false;
  if (!(state.wind === 'south' && state.hand === 4) && state.wind !== 'west') return false;
  const leader = topPlayer(state);
  return leader.player === state.round.dealer && leader.points >= state.targetPoints;
}

function hasTargetLeader(state: MatchState): boolean {
  return topPlayer(state).points >= state.targetPoints;
}

function nextHonba(result: RoundEndResult, repeats: boolean, currentHonba: number): number {
  if (result.type === 'exhaustive-draw') return currentHonba + 1;
  return repeats ? currentHonba + 1 : 0;
}

export function advanceMatch(state: MatchState, rng: RNG): MatchAdvanceResult {
  if (state.status === 'ended') {
    return { ok: false, error: 'MATCH_ALREADY_ENDED', message: 'The hanchan has already ended' };
  }
  if (state.round.phase.kind !== 'ended') {
    return { ok: false, error: 'ROUND_NOT_ENDED', message: 'Cannot advance before the current round ends' };
  }

  const result = state.round.phase.result;
  const points = currentPoints(state);

  // Tenhou-style tobi: negative ends the match, exactly zero continues.
  if (points.some((pointsForPlayer) => pointsForPlayer < 0)) {
    return { ok: true, state: finishMatch(state, 'bankruptcy'), startedNextRound: false };
  }

  const repeats = dealerRepeats(result, state.round.dealer);
  if (shouldDealerAutoStop(state, repeats)) {
    return {
      ok: true,
      state: finishMatch(state, dealerYameReason(result)),
      startedNextRound: false,
    };
  }

  if (!repeats) {
    if (state.wind === 'south' && state.hand === 4 && hasTargetLeader(state)) {
      return { ok: true, state: finishMatch(state, 'all-last'), startedNextRound: false };
    }
    if (state.wind === 'west') {
      if (hasTargetLeader(state)) {
        return { ok: true, state: finishMatch(state, 'sudden-death'), startedNextRound: false };
      }
      if (state.hand === 4) {
        return { ok: true, state: finishMatch(state, 'west-limit'), startedNextRound: false };
      }
    }
  }

  const nextPosition = repeats
    ? { wind: state.wind, hand: state.hand }
    : nextHandPosition(state.wind, state.hand);
  const nextDealer = repeats
    ? state.round.dealer
    : (((state.round.dealer + 1) % 4) as PlayerIndex);
  const honba = nextHonba(result, repeats, state.round.honba);

  const round = createRound(rng, {
    dealer: nextDealer,
    roundWind: nextPosition.wind,
    honba,
    riichiSticks: state.round.riichiSticks,
    startingPoints: points,
  });

  return {
    ok: true,
    startedNextRound: true,
    state: {
      ...state,
      wind: nextPosition.wind,
      hand: nextPosition.hand,
      roundNumber: state.roundNumber + 1,
      round,
    },
  };
}
