import type { BotDifficulty as PersistedBotDifficulty } from '../bot/difficulty';
import type { MatchResult, MatchState } from '../match/types';
import type {
  LegalAction,
  PlayerIndex,
  RoundAction,
  RoundEndResult,
  RoundEvent,
} from '../rules/types';

export type { BotDifficulty } from '../bot/difficulty';

export interface SingleGameState {
  /** Stable base seed. Every round derives its own seed from this plus match.roundNumber. */
  seed: number;
  humanSeat: PlayerIndex;
  /**
   * Optional for backwards-compatible JSON saves created before Plan 12. Missing resolves to Expert,
   * which preserves the bot behaviour those saves previously used.
   */
  botDifficulty?: PersistedBotDifficulty;
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

/**
 * Transient UI metadata: the authoritative state immediately after one accepted reducer action.
 * Frames are intentionally outside `SingleGameState`, so autosaves never persist presentation
 * progress and a reload always resumes from the fully resolved authoritative state.
 */
export interface SinglePresentationFrame {
  state: SingleGameState;
  events: readonly RoundEvent[];
  trace: SingleActionTrace;
}

export interface SingleDriveSuccess {
  ok: true;
  state: SingleGameState;
  prompt: HumanPrompt;
  events: readonly RoundEvent[];
  trace: readonly SingleActionTrace[];
  frames: readonly SinglePresentationFrame[];
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
  frames: readonly SinglePresentationFrame[];
}

export type SingleDriveResult = SingleDriveSuccess | SingleDriveFailure;
