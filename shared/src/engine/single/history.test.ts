import { describe, expect, it } from 'vitest';

import {
  appendSingleDriveHistory,
  createMatchHistory,
  parseMatchHistory,
  replayMatchHistory,
} from './history';
import { createSingleGame, driveSingleGame } from './single';

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

  it('rejects unsupported or malformed history payloads without affecting legacy saves', () => {
    expect(parseMatchHistory('not json')).toBeNull();
    expect(parseMatchHistory(JSON.stringify({ version: 0, entries: [] }))).toBeNull();
    expect(parseMatchHistory(JSON.stringify({ version: 1, seed: 1, humanSeat: 0 }))).toBeNull();
  });
});
