import type { BotDifficulty } from '../bot/difficulty';
import { advanceMatch } from '../match/match';
import { applyAction } from '../rules/round';
import type { PlayerIndex, RoundAction } from '../rules/types';
import { createRNG } from '../wall/prng';
import { createSingleGame, deriveSingleRoundSeed } from './single';
import type { SingleActionTrace, SingleDriveSuccess, SingleGameState } from './types';

export const MATCH_HISTORY_VERSION = 1 as const;

export interface MatchHistoryActionEntry {
  kind: 'action';
  roundNumber: number;
  source: SingleActionTrace['source'];
  player?: PlayerIndex;
  action: RoundAction;
}

export interface MatchHistoryRoundAdvanceEntry {
  kind: 'round-advance';
  roundNumber: number;
}

export type MatchHistoryEntry = MatchHistoryActionEntry | MatchHistoryRoundAdvanceEntry;

export interface MatchHistoryRecord {
  version: typeof MATCH_HISTORY_VERSION;
  seed: number;
  humanSeat: PlayerIndex;
  botDifficulty: BotDifficulty;
  entries: readonly MatchHistoryEntry[];
}

export type MatchHistoryReplayResult =
  | { ok: true; state: SingleGameState; appliedEntries: number }
  | { ok: false; state: SingleGameState; appliedEntries: number; message: string };

const BOT_DIFFICULTIES = new Set<BotDifficulty>(['casual', 'standard', 'expert']);
const TRACE_SOURCES = new Set<SingleActionTrace['source']>(['human', 'bot', 'system']);

function isPlayerIndex(value: unknown): value is PlayerIndex {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isRoundAction(value: unknown): value is RoundAction {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && type.length > 0;
}

function isHistoryEntry(value: unknown): value is MatchHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  if (!Number.isInteger(entry.roundNumber) || (entry.roundNumber as number) < 1) return false;
  if (entry.kind === 'round-advance') return true;
  if (entry.kind !== 'action') return false;
  if (!TRACE_SOURCES.has(entry.source as SingleActionTrace['source'])) return false;
  if (entry.player !== undefined && !isPlayerIndex(entry.player)) return false;
  return isRoundAction(entry.action);
}

function isMatchHistoryRecord(value: unknown): value is MatchHistoryRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.version !== MATCH_HISTORY_VERSION) return false;
  if (!Number.isInteger(record.seed) || (record.seed as number) < 0) return false;
  if (!isPlayerIndex(record.humanSeat)) return false;
  if (!BOT_DIFFICULTIES.has(record.botDifficulty as BotDifficulty)) return false;
  return Array.isArray(record.entries) && record.entries.every(isHistoryEntry);
}

export function createMatchHistory(state: SingleGameState): MatchHistoryRecord {
  return {
    version: MATCH_HISTORY_VERSION,
    seed: state.seed >>> 0,
    humanSeat: state.humanSeat,
    botDifficulty: state.botDifficulty ?? 'expert',
    entries: [],
  };
}

export function appendSingleDriveHistory(
  history: MatchHistoryRecord,
  result: SingleDriveSuccess,
): MatchHistoryRecord {
  if (result.frames.length === 0) return history;
  const additions: MatchHistoryActionEntry[] = result.frames.map((frame) => ({
    kind: 'action',
    roundNumber: frame.state.match.roundNumber,
    source: frame.trace.source,
    ...(frame.trace.player === undefined ? {} : { player: frame.trace.player }),
    action: frame.trace.action,
  }));
  return { ...history, entries: [...history.entries, ...additions] };
}

export function parseMatchHistory(raw: string): MatchHistoryRecord | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMatchHistoryRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function replayMatchHistory(
  history: MatchHistoryRecord,
  entryCount = history.entries.length,
): MatchHistoryReplayResult {
  const limit = Math.max(0, Math.min(history.entries.length, Math.trunc(entryCount)));
  let state = createSingleGame(history.seed, history.humanSeat, history.botDifficulty);

  for (let index = 0; index < limit; index++) {
    const entry = history.entries[index];
    if (entry.roundNumber !== state.match.roundNumber) {
      return {
        ok: false,
        state,
        appliedEntries: index,
        message: `History entry ${index} targets round ${entry.roundNumber}, current round is ${state.match.roundNumber}`,
      };
    }

    if (entry.kind === 'action') {
      const applied = applyAction(state.match.round, entry.action);
      if (!applied.ok) {
        return {
          ok: false,
          state,
          appliedEntries: index,
          message: `History entry ${index} rejected: ${applied.error.code}`,
        };
      }
      state = { ...state, match: { ...state.match, round: applied.state } };
      continue;
    }

    const nextRoundNumber = state.match.roundNumber + 1;
    const advanced = advanceMatch(
      state.match,
      createRNG(deriveSingleRoundSeed(state.seed, nextRoundNumber)),
    );
    if (!advanced.ok) {
      return {
        ok: false,
        state,
        appliedEntries: index,
        message: `History round advance ${index} rejected: ${advanced.error}`,
      };
    }
    state = { ...state, match: advanced.state };
  }

  return { ok: true, state, appliedEntries: limit };
}
