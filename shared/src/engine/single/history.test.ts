import { describe, expect, it } from 'vitest';

import type { HumanDecision } from './types';
import {
  appendRoundAdvanceHistory,
  appendSingleDriveHistory,
  createMatchHistory,
  parseMatchHistory,
  replayMatchHistory,
} from './history';
import {
  applyHumanDecision,
  continueSingleGame,
  createSingleGame,
  driveSingleGame,
} from './single';

function chooseProgressDecision(result: ReturnType<typeof driveSingleGame>): HumanDecision {
  if (!result.ok) throw new Error(result.message);
  const prompt = result.prompt;
  if (prompt.kind === 'reaction') {
    const ron = prompt.legalActions.find((action) => action.type === 'ron');
    return ron ? { type: 'action', action: { type: 'ron', player: prompt.player } } : { type: 'pass' };
  }
  if (prompt.kind !== 'turn') throw new Error(`Expected a human choice, got ${prompt.kind}`);

  const tsumo = prompt.legalActions.find((action) => action.type === 'tsumo');
  if (tsumo) return { type: 'action', action: { type: 'tsumo', player: prompt.player } };
  const discard = prompt.legalActions.find((action) => action.type === 'discard');
  if (!discard || discard.type !== 'discard' || discard.tileIds.length === 0) {
    throw new Error('Expected at least one legal discard');
  }
  return { type: 'action', action: { type: 'discard', player: prompt.player, tileId: discard.tileIds[0] } };
}

describe('single-player match history', () => {
  it('round-trips a versioned history and deterministically replays accepted actions', () => {
    const initial = createSingleGame(0x1234abcd, 0, 'standard');
    const driven = driveSingleGame(initial);
    if (!driven.ok) throw new Error(driven.message);

    const history = appendSingleDriveHistory(createMatchHistory(initial), driven);

    expect(history.version).toBe(1);
    expect(history.seed).toBe(initial.seed);
    expect(history.humanSeat).toBe(initial.humanSeat);
    expect(history.botDifficulty).toBe('standard');
    expect(history.entries).toHaveLength(driven.frames.length);
    expect(history.entries.every((entry) => entry.kind === 'action')).toBe(true);

    const parsed = parseMatchHistory(JSON.stringify(history));
    expect(parsed).toEqual(history);

    const replayed = replayMatchHistory(history);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.appliedEntries).toBe(history.entries.length);
    expect(replayed.state.match).toEqual(driven.state.match);
  });

  it('replays an explicit round advance and the first actions of the next hand', () => {
    const initial = createSingleGame(0x5eed1234, 0, 'expert');
    let history = createMatchHistory(initial);
    let driven = driveSingleGame(initial);
    if (!driven.ok) throw new Error(driven.message);
    history = appendSingleDriveHistory(history, driven);

    for (let guard = 0; guard < 300 && driven.prompt.kind !== 'round-ended'; guard++) {
      if (driven.prompt.kind === 'match-ended') throw new Error('Match ended before first round transition');
      const next = applyHumanDecision(driven.state, chooseProgressDecision(driven));
      if (!next.ok) throw new Error(next.message);
      driven = next;
      history = appendSingleDriveHistory(history, driven);
    }

    expect(driven.prompt.kind).toBe('round-ended');
    if (driven.prompt.kind !== 'round-ended') return;
    const endedState = driven.state;

    const advanced = continueSingleGame(endedState);
    if (!advanced.ok) throw new Error(advanced.message);
    history = appendRoundAdvanceHistory(history, endedState);
    history = appendSingleDriveHistory(history, advanced);

    const replayed = replayMatchHistory(history);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.state.match).toEqual(advanced.state.match);
    expect(history.entries.some((entry) => entry.kind === 'round-advance')).toBe(true);
  });

  it('rejects unsupported or malformed history payloads without affecting legacy saves', () => {
    expect(parseMatchHistory('not json')).toBeNull();
    expect(parseMatchHistory(JSON.stringify({ version: 0, entries: [] }))).toBeNull();
    expect(parseMatchHistory(JSON.stringify({ version: 1, seed: 1, humanSeat: 0 }))).toBeNull();
  });
});
