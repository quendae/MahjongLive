import { describe, expect, it } from 'vitest';
import { createRNG } from '../wall/prng';
import { applyAction, createRound, getLegalActions, seatWindFor } from './round';
import type { RoundState } from './types';

describe('createRound', () => {
  it('deals 13 tiles each and keeps every physical tile ID exactly once across ownership zones', () => {
    const state = createRound(createRNG(42), { dealer: 2 });
    expect(state.players.map((player) => player.concealed.length)).toEqual([13, 13, 13, 13]);
    expect(state.wall.liveWall.length).toBe(70);
    expect(state.wall.deadWall.length).toBe(14);
    expect(state.phase).toEqual({ kind: 'awaiting-draw', player: 2 });

    const physicalTiles = [
      ...state.wall.liveWall,
      ...state.wall.deadWall,
      ...state.players.flatMap((player) => player.concealed),
    ];
    expect(physicalTiles).toHaveLength(136);
    expect(new Set(physicalTiles.map((tile) => tile.id)).size).toBe(136);
  });

  it('maps seat winds relative to the current dealer', () => {
    expect(seatWindFor(2, 2)).toBe('east');
    expect(seatWindFor(3, 2)).toBe('south');
    expect(seatWindFor(0, 2)).toBe('west');
    expect(seatWindFor(1, 2)).toBe('north');
  });

  it('round-trips through JSON and remains actionable by physical tile ID', () => {
    const original = createRound(createRNG(3));
    const state = JSON.parse(JSON.stringify(original)) as RoundState;
    const result = applyAction(state, { type: 'draw', player: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].concealed).toHaveLength(14);
    expect(result.state.phase.kind).toBe('awaiting-discard');
  });
});

describe('basic draw/discard/reaction flow', () => {
  it('draws, discards the exact physical tile, resolves no claim, then advances clockwise', () => {
    const initial = createRound(createRNG(7));
    expect(getLegalActions(initial, 0)).toEqual([{ type: 'draw' }]);
    expect(getLegalActions(initial, 1)).toEqual([]);

    const draw = applyAction(initial, { type: 'draw', player: 0 });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    expect(initial.players[0].concealed).toHaveLength(13);
    expect(draw.state.players[0].concealed).toHaveLength(14);
    expect(draw.state.wall.liveWall).toHaveLength(initial.wall.liveWall.length - 1);
    expect(draw.events[0]?.type).toBe('TileDrawn');

    expect(draw.state.phase.kind).toBe('awaiting-discard');
    if (draw.state.phase.kind !== 'awaiting-discard') return;
    const drawnTileId = draw.state.phase.drawnTileId;
    expect(drawnTileId).not.toBeNull();
    if (drawnTileId === null) return;
    const discard = applyAction(draw.state, { type: 'discard', player: 0, tileId: drawnTileId });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    expect(discard.state.players[0].concealed).toHaveLength(13);
    expect(discard.state.players[0].discards).toHaveLength(1);
    expect(discard.state.players[0].discards[0].tileId).toBe(drawnTileId);
    expect(discard.state.players[0].discards[0].tsumogiri).toBe(true);
    expect(discard.state.phase.kind).toBe('reactions');

    const resolve = applyAction(discard.state, { type: 'resolve-reactions' });
    expect(resolve.ok).toBe(true);
    if (!resolve.ok) return;
    expect(resolve.state.phase).toEqual({ kind: 'awaiting-draw', player: 1 });
    expect(resolve.state.currentPlayer).toBe(1);
  });

  it('returns errors without mutating state for wrong-turn and unknown-tile actions', () => {
    const initial = createRound(createRNG(11));
    const wrongDraw = applyAction(initial, { type: 'draw', player: 1 });
    expect(wrongDraw).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });
    expect(initial.phase).toEqual({ kind: 'awaiting-draw', player: 0 });

    const draw = applyAction(initial, { type: 'draw', player: 0 });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    const before = draw.state.players[0].concealed;
    const invalidDiscard = applyAction(draw.state, { type: 'discard', player: 0, tileId: 9999 });
    expect(invalidDiscard).toMatchObject({ ok: false, error: { code: 'TILE_NOT_FOUND' } });
    expect(draw.state.players[0].concealed).toBe(before);
  });
});
