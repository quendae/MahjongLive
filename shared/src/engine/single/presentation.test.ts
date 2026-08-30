import { describe, expect, it } from 'vitest';
import { applyHumanDecision, createSingleGame, driveSingleGame } from './single';

describe('single-player presentation frames', () => {
  it('keeps frame order aligned with trace order and reaches the authoritative final state', () => {
    const result = driveSingleGame(createSingleGame(133701, 0));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.frames).toHaveLength(result.trace.length);
    expect(result.frames.map((frame) => frame.trace)).toEqual(result.trace);
    expect(result.frames.flatMap((frame) => frame.events)).toEqual(result.events);
    expect(result.frames.at(-1)?.state).toEqual(result.state);
  });

  it('includes the human action and subsequent automated actions without changing save state shape', () => {
    const first = driveSingleGame(createSingleGame(133702, 0));
    expect(first.ok).toBe(true);
    if (!first.ok || first.prompt.kind !== 'turn') return;
    const discard = first.prompt.legalActions.find((action) => action.type === 'discard');
    expect(discard?.type).toBe('discard');
    if (!discard || discard.type !== 'discard') return;

    const result = applyHumanDecision(first.state, {
      type: 'action',
      action: { type: 'discard', player: 0, tileId: discard.tileIds[0] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.frames).toHaveLength(result.trace.length);
    expect(result.frames[0]?.trace).toMatchObject({ source: 'human', action: { type: 'discard' } });
    expect(result.frames.at(-1)?.state).toEqual(result.state);
    expect(JSON.stringify(result.state)).not.toContain('frames');
  });
});
