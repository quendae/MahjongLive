import type { MatchEndReason, MatchHand, MatchWind } from '../match/types';
import type { PlayerIndex, PointDeltaTuple, RoundEndResult } from '../rules/types';
import { simulateBotMatch, type BotMatchSimulation, type BotRoundTrace } from './simulate';

export const RULE_REGRESSION_SEEDS = [
  20260916,
  20260917,
  20260918,
  20260919,
  20260920,
  20260921,
] as const;

export type RulesAuditCoverage = {
  tsumo: number;
  ron: number;
  exhaustiveDraw: number;
  dealerRepeats: number;
  dealerAdvances: number;
  riichiDeclarations: number;
  calls: number;
  kans: number;
};

export type RulesAuditRecord = {
  seed: number;
  roundCount: number;
  actionCount: number;
  endReason: MatchEndReason;
  finalPoints: PointDeltaTuple;
  coverage: RulesAuditCoverage;
};

export type DeterministicRulesAudit = {
  records: readonly RulesAuditRecord[];
  coverage: RulesAuditCoverage;
};

export type RulesAuditOptions = {
  seeds?: readonly number[];
  maxRounds?: number;
  maxActionsPerRound?: number;
};

function emptyCoverage(): RulesAuditCoverage {
  return {
    tsumo: 0,
    ron: 0,
    exhaustiveDraw: 0,
    dealerRepeats: 0,
    dealerAdvances: 0,
    riichiDeclarations: 0,
    calls: 0,
    kans: 0,
  };
}

function addCoverage(target: RulesAuditCoverage, source: RulesAuditCoverage): void {
  target.tsumo += source.tsumo;
  target.ron += source.ron;
  target.exhaustiveDraw += source.exhaustiveDraw;
  target.dealerRepeats += source.dealerRepeats;
  target.dealerAdvances += source.dealerAdvances;
  target.riichiDeclarations += source.riichiDeclarations;
  target.calls += source.calls;
  target.kans += source.kans;
}

function fail(seed: number, message: string): never {
  throw new Error(`Rules audit seed ${seed}: ${message}`);
}

function sumPoints(points: readonly number[]): number {
  return points.reduce((sum, value) => sum + value, 0);
}

function samePoints(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function dealerWouldRepeat(result: RoundEndResult, dealer: PlayerIndex): boolean {
  if (result.type === 'tsumo') return result.winner === dealer;
  if (result.type === 'ron') return result.winners.some((winner) => winner.player === dealer);
  return result.tenpaiPlayers.includes(dealer);
}

function nextPosition(wind: MatchWind, hand: MatchHand): { wind: MatchWind; hand: MatchHand } {
  if (hand < 4) return { wind, hand: (hand + 1) as MatchHand };
  if (wind === 'east') return { wind: 'south', hand: 1 };
  if (wind === 'south') return { wind: 'west', hand: 1 };
  return { wind: 'west', hand: 4 };
}

function expectedHonba(trace: BotRoundTrace, repeats: boolean): number {
  if (trace.result.type === 'exhaustive-draw') return trace.honba + 1;
  return repeats ? trace.honba + 1 : 0;
}

function auditRoundLedger(seed: number, round: BotRoundTrace): void {
  const startLedger = sumPoints(round.startPoints) + round.startRiichiSticks * 1000;
  if (startLedger !== 100_000) {
    fail(seed, `round ${round.roundNumber} start ledger is ${startLedger}, expected 100000`);
  }
  const endLedger = sumPoints(round.endPoints) + round.endRiichiSticks * 1000;
  if (endLedger !== 100_000) {
    fail(seed, `round ${round.roundNumber} end ledger is ${endLedger}, expected 100000`);
  }
}

function auditTransition(seed: number, current: BotRoundTrace, next: BotRoundTrace): void {
  if (next.roundNumber !== current.roundNumber + 1) {
    fail(seed, `round number jumped ${current.roundNumber} -> ${next.roundNumber}`);
  }
  if (!samePoints(next.startPoints, current.endPoints)) {
    fail(seed, `points changed between rounds ${current.roundNumber} and ${next.roundNumber}`);
  }
  if (next.startRiichiSticks !== current.endRiichiSticks) {
    fail(seed, `riichi sticks changed between rounds ${current.roundNumber} and ${next.roundNumber}`);
  }

  const repeats = dealerWouldRepeat(current.result, current.dealer);
  const expectedPosition = repeats
    ? { wind: current.wind, hand: current.hand }
    : nextPosition(current.wind, current.hand);
  const expectedDealer = repeats
    ? current.dealer
    : (((current.dealer + 1) % 4) as PlayerIndex);
  const honba = expectedHonba(current, repeats);

  if (next.wind !== expectedPosition.wind || next.hand !== expectedPosition.hand) {
    fail(
      seed,
      `position after round ${current.roundNumber} is ${next.wind}${next.hand}, expected ${expectedPosition.wind}${expectedPosition.hand}`,
    );
  }
  if (next.dealer !== expectedDealer) {
    fail(seed, `dealer after round ${current.roundNumber} is ${next.dealer}, expected ${expectedDealer}`);
  }
  if (next.honba !== honba) {
    fail(seed, `honba after round ${current.roundNumber} is ${next.honba}, expected ${honba}`);
  }
}

function coverageForRound(round: BotRoundTrace): RulesAuditCoverage {
  const coverage = emptyCoverage();
  if (round.result.type === 'tsumo') coverage.tsumo += 1;
  else if (round.result.type === 'ron') coverage.ron += 1;
  else coverage.exhaustiveDraw += 1;

  if (dealerWouldRepeat(round.result, round.dealer)) coverage.dealerRepeats += 1;
  else coverage.dealerAdvances += 1;

  coverage.riichiDeclarations += round.actionCounts['riichi-discard'] ?? 0;
  coverage.calls +=
    (round.actionCounts.chi ?? 0) +
    (round.actionCounts.pon ?? 0) +
    (round.actionCounts.daiminkan ?? 0);
  coverage.kans +=
    (round.actionCounts.ankan ?? 0) +
    (round.actionCounts.shouminkan ?? 0) +
    (round.actionCounts.daiminkan ?? 0);
  return coverage;
}

export function auditBotMatchSimulation(seed: number, simulation: BotMatchSimulation): RulesAuditRecord {
  if (!simulation.ok) fail(seed, simulation.message);
  if (simulation.state.status !== 'ended' || !simulation.state.result) {
    fail(seed, 'simulation did not finish with a match result');
  }
  if (simulation.rounds.length !== simulation.roundCount) {
    fail(seed, `trace has ${simulation.rounds.length} rounds but roundCount is ${simulation.roundCount}`);
  }
  if (simulation.rounds.length === 0) fail(seed, 'simulation produced no completed rounds');

  const coverage = emptyCoverage();
  for (let index = 0; index < simulation.rounds.length; index += 1) {
    const round = simulation.rounds[index];
    auditRoundLedger(seed, round);
    addCoverage(coverage, coverageForRound(round));
    const next = simulation.rounds[index + 1];
    if (next) auditTransition(seed, round, next);
  }

  const matchResult = simulation.state.result;
  const places = matchResult.placements.map((placement) => placement.place);
  if (places.join(',') !== '1,2,3,4') {
    fail(seed, `final places are ${places.join(',')}, expected 1,2,3,4`);
  }
  const players = matchResult.placements.map((placement) => placement.player);
  if (new Set(players).size !== 4) fail(seed, 'final placements do not contain four unique players');
  for (const placement of matchResult.placements) {
    if (placement.points !== matchResult.finalPoints[placement.player]) {
      fail(seed, `placement points disagree with finalPoints for player ${placement.player}`);
    }
  }
  if (sumPoints(matchResult.finalPoints) !== 100_000) {
    fail(seed, `final point total is ${sumPoints(matchResult.finalPoints)}, expected 100000`);
  }

  return {
    seed,
    roundCount: simulation.roundCount,
    actionCount: simulation.actionCount,
    endReason: matchResult.reason,
    finalPoints: matchResult.finalPoints,
    coverage,
  };
}

export function runDeterministicRulesAudit(
  options: RulesAuditOptions = {},
): DeterministicRulesAudit {
  const seeds = options.seeds ?? RULE_REGRESSION_SEEDS;
  const maxRounds = options.maxRounds ?? 64;
  const maxActionsPerRound = options.maxActionsPerRound ?? 2048;
  const coverage = emptyCoverage();
  const records: RulesAuditRecord[] = [];

  for (const seed of seeds) {
    const simulation = simulateBotMatch(seed, maxRounds, maxActionsPerRound);
    const record = auditBotMatchSimulation(seed, simulation);
    records.push(record);
    addCoverage(coverage, record.coverage);
  }

  return { records, coverage };
}
