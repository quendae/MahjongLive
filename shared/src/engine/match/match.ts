import { normalizeRuleProfileId, resolveRuleProfile } from '../rules/profile';
import type { RuleProfile } from '../rules/profile';
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

function normalizeMatchProfile(state: MatchState): { state: MatchState; profile: RuleProfile } {
  const ruleProfileId = normalizeRuleProfileId(state.ruleProfileId ?? state.round.ruleProfileId);
  const round = state.round.ruleProfileId === ruleProfileId
    ? state.round
    : { ...state.round, ruleProfileId };
  return {
    profile: resolveRuleProfile(ruleProfileId),
    state: state.ruleProfileId === ruleProfileId && round === state.round
      ? state
      : { ...state, ruleProfileId, round },
  };
}

export function createMatch(rng: RNG, options: MatchOptions = {}): MatchState {
  const initialDealer = options.initialDealer ?? 0;
  const targetPoints = Math.max(1, Math.trunc(options.targetPoints ?? DEFAULT_TARGET_POINTS));
  const points = initialPoints(options);
  const ruleProfileId = normalizeRuleProfileId(options.ruleProfileId);
  return {
    ruleProfileId,
    status: 'playing',
    initialDealer,
    wind: 'east',
    hand: 1,
    targetPoints,
    roundNumber: 1,
    round: createRound(rng, {
      ruleProfileId,
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

function shouldDealerAutoStop(state: MatchState, repeats: boolean, profile: RuleProfile): boolean {
  if (!profile.dealerYame || !repeats) return false;
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
  const normalized = normalizeMatchProfile(state);
  const working = normalized.state;
  const profile = normalized.profile;

  if (working.status === 'ended') {
    return { ok: false, error: 'MATCH_ALREADY_ENDED', message: 'The hanchan has already ended' };
  }
  if (working.round.phase.kind !== 'ended') {
    return { ok: false, error: 'ROUND_NOT_ENDED', message: 'Cannot advance before the current round ends' };
  }

  const result = working.round.phase.result;
  const points = currentPoints(working);

  if (profile.bankruptcyBelowZero && points.some((pointsForPlayer) => pointsForPlayer < 0)) {
    return { ok: true, state: finishMatch(working, 'bankruptcy'), startedNextRound: false };
  }

  const repeats = dealerRepeats(result, working.round.dealer);
  if (shouldDealerAutoStop(working, repeats, profile)) {
    return {
      ok: true,
      state: finishMatch(working, dealerYameReason(result)),
      startedNextRound: false,
    };
  }

  if (!repeats) {
    if (working.wind === 'south' && working.hand === 4) {
      if (hasTargetLeader(working) || !profile.westRoundExtension) {
        return { ok: true, state: finishMatch(working, 'all-last'), startedNextRound: false };
      }
    }
    if (working.wind === 'west') {
      if (hasTargetLeader(working)) {
        return { ok: true, state: finishMatch(working, 'sudden-death'), startedNextRound: false };
      }
      if (working.hand === 4) {
        return { ok: true, state: finishMatch(working, 'west-limit'), startedNextRound: false };
      }
    }
  }

  const nextPosition = repeats
    ? { wind: working.wind, hand: working.hand }
    : nextHandPosition(working.wind, working.hand);
  const nextDealer = repeats
    ? working.round.dealer
    : (((working.round.dealer + 1) % 4) as PlayerIndex);
  const honba = nextHonba(result, repeats, working.round.honba);

  const round = createRound(rng, {
    ruleProfileId: profile.id,
    dealer: nextDealer,
    roundWind: nextPosition.wind,
    honba,
    riichiSticks: working.round.riichiSticks,
    startingPoints: points,
  });

  return {
    ok: true,
    startedNextRound: true,
    state: {
      ...working,
      ruleProfileId: profile.id,
      wind: nextPosition.wind,
      hand: nextPosition.hand,
      roundNumber: working.roundNumber + 1,
      round,
    },
  };
}
