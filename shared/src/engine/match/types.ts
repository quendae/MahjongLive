import type { PlayerIndex, PointDeltaTuple, RoundState } from '../rules/types';

export type MatchWind = 'east' | 'south' | 'west';
export type MatchHand = 1 | 2 | 3 | 4;
export type MatchStatus = 'playing' | 'ended';

export type MatchEndReason =
  | 'bankruptcy'
  | 'agari-yame'
  | 'tenpai-yame'
  | 'all-last'
  | 'sudden-death'
  | 'west-limit';

export interface MatchPlacement {
  player: PlayerIndex;
  place: 1 | 2 | 3 | 4;
  points: number;
}

export interface MatchResult {
  reason: MatchEndReason;
  placements: readonly [MatchPlacement, MatchPlacement, MatchPlacement, MatchPlacement];
  finalPoints: PointDeltaTuple;
  /** Remaining table sticks are awarded to first place at game end. */
  riichiStickWinner: PlayerIndex | null;
}

export interface MatchState {
  status: MatchStatus;
  initialDealer: PlayerIndex;
  wind: MatchWind;
  hand: MatchHand;
  targetPoints: number;
  roundNumber: number;
  round: RoundState;
  result?: MatchResult;
}

export interface MatchOptions {
  initialDealer?: PlayerIndex;
  startingPoints?: number | PointDeltaTuple;
  targetPoints?: number;
}

export type MatchAdvanceResult =
  | { ok: true; state: MatchState; startedNextRound: boolean }
  | { ok: false; error: 'ROUND_NOT_ENDED' | 'MATCH_ALREADY_ENDED'; message: string };
