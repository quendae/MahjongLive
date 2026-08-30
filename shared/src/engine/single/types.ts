import type { MatchResult, MatchState } from '../match/types';
import type {
  LegalAction,
  PlayerIndex,
  RoundAction,
  RoundEndResult,
  RoundEvent,
} from '../rules/types';

export interface SingleGameState {
  /** Stable base seed. Every round derives its own seed from this plus match.roundNumber. */
  seed: number;
  humanSeat: PlayerIndex;
  match: MatchState;
}

export type HumanPrompt =
  | {
      kind: 'turn';
      player: PlayerIndex;
      legalActions: readonly LegalAction[];
    }
  | {
      kind: 'reaction';
      player: PlayerIndex;
      legalActions: readonly LegalAction[];
      canPass: true;
    }
  | {
      kind: 'round-ended';
      result: RoundEndResult;
    }
  | {
      kind: 'match-ended';
      result: MatchResult;
    };

export type HumanDecision =
  | { type: 'action'; action: RoundAction }
  | { type: 'pass' };

export interface SingleActionTrace {
  source: 'human' | 'bot' | 'system';
  player?: PlayerIndex;
  action: RoundAction;
}

export interface SingleDriveSuccess {
  ok: true;
  state: SingleGameState;
  prompt: HumanPrompt;
  events: readonly RoundEvent[];
  trace: readonly SingleActionTrace[];
}

export interface SingleDriveFailure {
  ok: false;
  state: SingleGameState;
  code:
    | 'ILLEGAL_HUMAN_ACTION'
    | 'INVALID_HUMAN_PASS'
    | 'ROUND_NOT_ENDED'
    | 'AUTOMATION_STALLED'
    | 'SAFETY_CAP';
  message: string;
  events: readonly RoundEvent[];
  trace: readonly SingleActionTrace[];
}

export type SingleDriveResult = SingleDriveSuccess | SingleDriveFailure;
