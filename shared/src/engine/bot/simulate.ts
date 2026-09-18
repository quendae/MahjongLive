import { advanceMatch, createMatch } from '../match/match';
import type { MatchState } from '../match/types';
import { applyAction, createRound } from '../rules/round';
import type {
  PlayerIndex,
  PointDeltaTuple,
  RoundAction,
  RoundEndResult,
  RoundState,
} from '../rules/types';
import { createRNG } from '../wall/prng';
import type { BotSeatProfiles } from './calibration';
import { chooseBotDecisionForDifficulty } from './difficulty';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];
const ALL_EXPERT: BotSeatProfiles = ['expert', 'expert', 'expert', 'expert'];

export type BotActionCounts = Partial<Record<RoundAction['type'], number>>;

export type BotRoundTrace = {
  roundNumber: number;
  wind: MatchState['wind'];
  hand: MatchState['hand'];
  dealer: PlayerIndex;
  honba: number;
  startRiichiSticks: number;
  endRiichiSticks: number;
  startPoints: PointDeltaTuple;
  endPoints: PointDeltaTuple;
  result: RoundEndResult;
  actionCount: number;
  actionCounts: BotActionCounts;
};

export type BotPlayerSimulationStats = {
  roundsPlayed: number;
  wins: number;
  dealIns: number;
  riichiDeclarations: number;
  calls: number;
};

export type BotPlayerStatsTuple = readonly [
  BotPlayerSimulationStats,
  BotPlayerSimulationStats,
  BotPlayerSimulationStats,
  BotPlayerSimulationStats,
];

export type BotRoundSimulation =
  | {
      ok: true;
      state: RoundState;
      actionCount: number;
      actionCounts: BotActionCounts;
    }
  | {
      ok: false;
      state: RoundState;
      actionCount: number;
      actionCounts: BotActionCounts;
      message: string;
    };

export type BotMatchSimulation =
  | {
      ok: true;
      state: MatchState;
      roundCount: number;
      actionCount: number;
      profiles: BotSeatProfiles;
      playerStats: BotPlayerStatsTuple;
      rounds: readonly BotRoundTrace[];
    }
  | {
      ok: false;
      state: MatchState;
      roundCount: number;
      actionCount: number;
      profiles: BotSeatProfiles;
      playerStats: BotPlayerStatsTuple;
      rounds: readonly BotRoundTrace[];
      message: string;
    };

function emptyPlayerStats(): [
  BotPlayerSimulationStats,
  BotPlayerSimulationStats,
  BotPlayerSimulationStats,
  BotPlayerSimulationStats,
] {
  const create = (): BotPlayerSimulationStats => ({
    roundsPlayed: 0,
    wins: 0,
    dealIns: 0,
    riichiDeclarations: 0,
    calls: 0,
  });
  return [create(), create(), create(), create()];
}

function accumulateRoundStats(stats: BotPlayerSimulationStats[], state: RoundState): void {
  if (state.phase.kind !== 'ended') return;

  for (const player of PLAYERS) {
    const playerState = state.players[player];
    const playerStats = stats[player];
    playerStats.roundsPlayed += 1;
    playerStats.riichiDeclarations += playerState.discards.some((discard) => discard.riichiDeclaration === true) ? 1 : 0;
    playerStats.calls += playerState.melds.filter((meld) => meld.isOpen === true).length;
  }

  const result = state.phase.result;
  if (result.type === 'tsumo') {
    stats[result.winner].wins += 1;
  } else if (result.type === 'ron') {
    for (const winner of result.winners) stats[winner.player].wins += 1;
    stats[result.discarder].dealIns += 1;
  }
}

function isReactionAction(action: RoundAction): boolean {
  return action.type === 'ron' || action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan';
}

function countAction(counts: BotActionCounts, type: RoundAction['type']): void {
  counts[type] = (counts[type] ?? 0) + 1;
}

function roundPoints(state: RoundState): PointDeltaTuple {
  return [
    state.players[0].points,
    state.players[1].points,
    state.players[2].points,
    state.players[3].points,
  ];
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function matchRoundSeed(baseSeed: number, roundNumber: number): number {
  return mix32((Math.trunc(baseSeed) ^ Math.imul(Math.max(1, roundNumber), 0x9e3779b9)) >>> 0);
}

/** QA helper: plays one already-created round with four selected bot profiles. */
export function simulateBotRoundState(
  initialState: RoundState,
  maxActions = 2048,
  profiles: BotSeatProfiles = ALL_EXPERT,
): BotRoundSimulation {
  let state = initialState;
  let actionCount = 0;
  const actionCounts: BotActionCounts = {};

  while (actionCount < maxActions) {
    if (state.phase.kind === 'ended') return { ok: true, state, actionCount, actionCounts };

    if (state.phase.kind === 'reactions' || state.phase.kind === 'kan-reactions') {
      for (const player of PLAYERS) {
        const decision = chooseBotDecisionForDifficulty(state, player, profiles[player]);
        if (decision.type === 'pass') continue;
        if (!isReactionAction(decision.action)) {
          return {
            ok: false,
            state,
            actionCount,
            actionCounts,
            message: `Bot ${player} returned ${decision.action.type} during reactions`,
          };
        }
        const claimed = applyAction(state, decision.action);
        actionCount += 1;
        if (!claimed.ok) {
          return {
            ok: false,
            state,
            actionCount,
            actionCounts,
            message: `Rejected bot reaction ${decision.action.type}: ${claimed.error.code}`,
          };
        }
        countAction(actionCounts, decision.action.type);
        state = claimed.state;
      }

      const resolved = applyAction(state, { type: 'resolve-reactions' });
      actionCount += 1;
      if (!resolved.ok) {
        return {
          ok: false,
          state,
          actionCount,
          actionCounts,
          message: `Reaction resolution failed: ${resolved.error.code}`,
        };
      }
      countAction(actionCounts, 'resolve-reactions');
      state = resolved.state;
      continue;
    }

    const actor = state.phase.player;
    const decision = chooseBotDecisionForDifficulty(state, actor, profiles[actor]);
    if (decision.type === 'pass') {
      return {
        ok: false,
        state,
        actionCount,
        actionCounts,
        message: `Bot ${actor} passed during own ${state.phase.kind}`,
      };
    }
    const applied = applyAction(state, decision.action);
    actionCount += 1;
    if (!applied.ok) {
      return {
        ok: false,
        state,
        actionCount,
        actionCounts,
        message: `Rejected bot ${decision.action.type}: ${applied.error.code}`,
      };
    }
    countAction(actionCounts, decision.action.type);
    state = applied.state;
  }

  return {
    ok: false,
    state,
    actionCount,
    actionCounts,
    message: `Bot simulation exceeded ${maxActions} actions`,
  };
}

/** QA helper: creates and plays one complete deterministic bot round. */
export function simulateBotRound(seed: number, maxActions = 2048): BotRoundSimulation {
  return simulateBotRoundState(createRound(createRNG(Math.trunc(seed) >>> 0)), maxActions);
}

/**
 * Plays a complete East-South match (including West extension when required) with four bots.
 * This intentionally crosses every production boundary: reducer -> scoring -> round end -> match
 * advancement -> next wall. It is primarily a regression/stress helper, not gameplay UI code.
 */
export function simulateBotMatch(
  seed: number,
  maxRounds = 64,
  maxActionsPerRound = 2048,
  profiles: BotSeatProfiles = ALL_EXPERT,
): BotMatchSimulation {
  const normalizedSeed = Math.trunc(seed) >>> 0;
  let match = createMatch(createRNG(matchRoundSeed(normalizedSeed, 1)));
  let actionCount = 0;
  let roundCount = 0;
  const playerStats = emptyPlayerStats();
  const rounds: BotRoundTrace[] = [];

  while (roundCount < maxRounds) {
    const startRoundNumber = match.roundNumber;
    const startWind = match.wind;
    const startHand = match.hand;
    const startDealer = match.round.dealer;
    const startHonba = match.round.honba;
    const startRiichiSticks = match.round.riichiSticks;
    const startPoints = roundPoints(match.round);
    const simulated = simulateBotRoundState(match.round, maxActionsPerRound, profiles);
    actionCount += simulated.actionCount;
    roundCount += 1;
    match = { ...match, round: simulated.state };

    if (!simulated.ok) {
      return {
        ok: false,
        state: match,
        roundCount,
        actionCount,
        profiles,
        playerStats,
        rounds,
        message: `Round ${roundCount} failed: ${simulated.message}`,
      };
    }

    if (simulated.state.phase.kind !== 'ended') {
      return {
        ok: false,
        state: match,
        roundCount,
        actionCount,
        profiles,
        playerStats,
        rounds,
        message: `Round ${roundCount} simulation returned without an ended result`,
      };
    }

    rounds.push({
      roundNumber: startRoundNumber,
      wind: startWind,
      hand: startHand,
      dealer: startDealer,
      honba: startHonba,
      startRiichiSticks,
      endRiichiSticks: simulated.state.riichiSticks,
      startPoints,
      endPoints: roundPoints(simulated.state),
      result: simulated.state.phase.result,
      actionCount: simulated.actionCount,
      actionCounts: { ...simulated.actionCounts },
    });

    accumulateRoundStats(playerStats, simulated.state);

    const nextRoundNumber = match.roundNumber + 1;
    const advanced = advanceMatch(
      match,
      createRNG(matchRoundSeed(normalizedSeed, nextRoundNumber)),
    );
    if (!advanced.ok) {
      return {
        ok: false,
        state: match,
        roundCount,
        actionCount,
        profiles,
        playerStats,
        rounds,
        message: `Match advance after round ${roundCount} failed: ${advanced.error}`,
      };
    }
    match = advanced.state;
    if (match.status === 'ended') {
      return { ok: true, state: match, roundCount, actionCount, profiles, playerStats, rounds };
    }
  }

  return {
    ok: false,
    state: match,
    roundCount,
    actionCount,
    profiles,
    playerStats,
    rounds,
    message: `Bot match exceeded ${maxRounds} rounds`,
  };
}
