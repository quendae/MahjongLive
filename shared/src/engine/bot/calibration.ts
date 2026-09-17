import type { MatchPlacement } from '../match/types';
import type { BotDifficulty } from './difficulty';
import { simulateBotMatch } from './simulate';

export type BotSeatProfiles = readonly [BotDifficulty, BotDifficulty, BotDifficulty, BotDifficulty];

export type BotCalibrationCase = {
  seed: number;
  rotation: number;
  profiles: BotSeatProfiles;
};

export type BotCalibrationPlayerStats = {
  roundsPlayed: number;
  wins: number;
  dealIns: number;
  riichiDeclarations: number;
  calls: number;
};

export type BotCalibrationMatchRecord = BotCalibrationCase & {
  roundCount: number;
  actionCount: number;
  placements: readonly MatchPlacement[];
  playerStats: readonly BotCalibrationPlayerStats[];
};

export type BotProfileCalibrationSummary = {
  samples: number;
  seatExposure: readonly [number, number, number, number];
  placementCounts: readonly [number, number, number, number];
  averagePlacement: number;
  averageFinalPoints: number;
  roundsPlayed: number;
  wins: number;
  dealIns: number;
  riichiDeclarations: number;
  calls: number;
};

export type BotCalibrationSummary = {
  matches: number;
  totalRounds: number;
  totalActions: number;
  averageRoundsPerMatch: number;
  averageActionsPerMatch: number;
  profiles: Record<BotDifficulty, BotProfileCalibrationSummary>;
};

export type BotCalibrationRunOptions = {
  seeds: readonly number[];
  lineups: readonly BotSeatProfiles[];
  /** Optional subset of the four seat rotations. Defaults to all four. */
  rotations?: readonly number[];
  maxRounds?: number;
  maxActionsPerRound?: number;
};

export type BotCalibrationRunResult = {
  records: readonly BotCalibrationMatchRecord[];
  summary: BotCalibrationSummary;
};

type ProfileAccumulator = {
  samples: number;
  seatExposure: [number, number, number, number];
  placementCounts: [number, number, number, number];
  placementTotal: number;
  finalPointsTotal: number;
  roundsPlayed: number;
  wins: number;
  dealIns: number;
  riichiDeclarations: number;
  calls: number;
};

const PROFILE_ORDER: readonly BotDifficulty[] = ['casual', 'standard', 'expert'];
const PROFILE_LABEL: Record<BotDifficulty, string> = {
  casual: 'Casual',
  standard: 'Standard',
  expert: 'Expert',
};
const numberFormat = new Intl.NumberFormat('en-US');

function rotateProfiles(lineup: BotSeatProfiles, rotation: number): BotSeatProfiles {
  const offset = ((rotation % 4) + 4) % 4;
  return [
    lineup[(4 - offset) % 4],
    lineup[(5 - offset) % 4],
    lineup[(6 - offset) % 4],
    lineup[(7 - offset) % 4],
  ];
}

/**
 * Expands each deterministic seed/lineup pair into four seat rotations so profile results are not
 * accidentally tied to East/South/West/North position. Duplicate profiles remain duplicated.
 */
export function buildBotCalibrationCases(
  seeds: readonly number[],
  lineups: readonly BotSeatProfiles[],
): BotCalibrationCase[] {
  const cases: BotCalibrationCase[] = [];
  for (const seed of seeds) {
    for (const lineup of lineups) {
      for (let rotation = 0; rotation < 4; rotation += 1) {
        cases.push({
          seed: Math.trunc(seed) >>> 0,
          rotation,
          profiles: rotateProfiles(lineup, rotation),
        });
      }
    }
  }
  return cases;
}

function emptyAccumulator(): ProfileAccumulator {
  return {
    samples: 0,
    seatExposure: [0, 0, 0, 0],
    placementCounts: [0, 0, 0, 0],
    placementTotal: 0,
    finalPointsTotal: 0,
    roundsPlayed: 0,
    wins: 0,
    dealIns: 0,
    riichiDeclarations: 0,
    calls: 0,
  };
}

function finalizeAccumulator(value: ProfileAccumulator): BotProfileCalibrationSummary {
  return {
    samples: value.samples,
    seatExposure: value.seatExposure,
    placementCounts: value.placementCounts,
    averagePlacement: value.samples === 0 ? 0 : value.placementTotal / value.samples,
    averageFinalPoints: value.samples === 0 ? 0 : value.finalPointsTotal / value.samples,
    roundsPlayed: value.roundsPlayed,
    wins: value.wins,
    dealIns: value.dealIns,
    riichiDeclarations: value.riichiDeclarations,
    calls: value.calls,
  };
}

/** Pure aggregation layer for completed deterministic benchmark records. */
export function summarizeBotCalibration(
  records: readonly BotCalibrationMatchRecord[],
): BotCalibrationSummary {
  const accumulators: Record<BotDifficulty, ProfileAccumulator> = {
    casual: emptyAccumulator(),
    standard: emptyAccumulator(),
    expert: emptyAccumulator(),
  };
  let totalRounds = 0;
  let totalActions = 0;

  for (const record of records) {
    totalRounds += record.roundCount;
    totalActions += record.actionCount;

    for (let seat = 0; seat < 4; seat += 1) {
      const profile = record.profiles[seat];
      const placement = record.placements.find((entry) => entry.player === seat);
      const stats = record.playerStats[seat];
      if (!placement) throw new Error(`Missing placement for player ${seat}`);
      if (!stats) throw new Error(`Missing calibration stats for player ${seat}`);

      const accumulator = accumulators[profile];
      accumulator.samples += 1;
      accumulator.seatExposure[seat] += 1;
      accumulator.placementCounts[placement.place - 1] += 1;
      accumulator.placementTotal += placement.place;
      accumulator.finalPointsTotal += placement.points;
      accumulator.roundsPlayed += stats.roundsPlayed;
      accumulator.wins += stats.wins;
      accumulator.dealIns += stats.dealIns;
      accumulator.riichiDeclarations += stats.riichiDeclarations;
      accumulator.calls += stats.calls;
    }
  }

  const matches = records.length;
  const profiles = {} as Record<BotDifficulty, BotProfileCalibrationSummary>;
  for (const profile of PROFILE_ORDER) profiles[profile] = finalizeAccumulator(accumulators[profile]);

  return {
    matches,
    totalRounds,
    totalActions,
    averageRoundsPerMatch: matches === 0 ? 0 : totalRounds / matches,
    averageActionsPerMatch: matches === 0 ? 0 : totalActions / matches,
    profiles,
  };
}

/** Executes deterministic profile matchups and returns raw records plus an aggregate summary. */
export function runBotCalibration(options: BotCalibrationRunOptions): BotCalibrationRunResult {
  const selectedRotations = new Set(
    (options.rotations ?? [0, 1, 2, 3]).map((rotation) => ((Math.trunc(rotation) % 4) + 4) % 4),
  );
  const cases = buildBotCalibrationCases(options.seeds, options.lineups)
    .filter((entry) => selectedRotations.has(entry.rotation));
  const records: BotCalibrationMatchRecord[] = [];

  for (const entry of cases) {
    const simulation = simulateBotMatch(
      entry.seed,
      options.maxRounds ?? 64,
      options.maxActionsPerRound ?? 2048,
      entry.profiles,
    );
    if (!simulation.ok) {
      throw new Error(
        `Calibration match failed for seed ${entry.seed}, rotation ${entry.rotation}: ${simulation.message}`,
      );
    }
    const result = simulation.state.result;
    if (!result) {
      throw new Error(`Calibration match ended without a final result for seed ${entry.seed}`);
    }

    records.push({
      ...entry,
      roundCount: simulation.roundCount,
      actionCount: simulation.actionCount,
      placements: result.placements,
      playerStats: simulation.playerStats,
    });
  }

  return {
    records,
    summary: summarizeBotCalibration(records),
  };
}

function percentage(count: number, roundsPlayed: number): string {
  return `${(roundsPlayed === 0 ? 0 : (count / roundsPlayed) * 100).toFixed(1)}%`;
}

/** Human-readable benchmark output; deliberately reports measurements without declaring a winner. */
export function formatBotCalibrationReport(summary: BotCalibrationSummary): string {
  const lines = [
    'Mahjong Live bot calibration',
    `Matches: ${summary.matches} | Rounds: ${summary.totalRounds} | Actions: ${summary.totalActions}`,
    `Average match: ${summary.averageRoundsPerMatch.toFixed(2)} rounds | ${summary.averageActionsPerMatch.toFixed(2)} actions`,
    '',
    'Profile  Samples  Avg place  Avg points  Win%  Deal-in%  Riichi%  Calls/rnd  Placements  Seats(E/S/W/N)',
  ];

  for (const profile of PROFILE_ORDER) {
    const value = summary.profiles[profile];
    lines.push([
      PROFILE_LABEL[profile].padEnd(8),
      String(value.samples).padStart(7),
      value.averagePlacement.toFixed(2).padStart(10),
      numberFormat.format(Math.round(value.averageFinalPoints)).padStart(10),
      percentage(value.wins, value.roundsPlayed).padStart(6),
      percentage(value.dealIns, value.roundsPlayed).padStart(9),
      percentage(value.riichiDeclarations, value.roundsPlayed).padStart(8),
      (value.roundsPlayed === 0 ? 0 : value.calls / value.roundsPlayed).toFixed(2).padStart(9),
      value.placementCounts.join('/').padStart(10),
      value.seatExposure.join('/').padStart(14),
    ].join('  '));
  }

  return lines.join('\n');
}
