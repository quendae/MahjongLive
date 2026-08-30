import { describe, expect, it } from 'vitest';
import { applyAction, createRound } from '@mahjong-live/shared/rules';
import type { RoundEvent, RoundState } from '@mahjong-live/shared/rules';
import { createRNG } from '@mahjong-live/shared/prng';
import { projectEngineEvent, projectRound } from './projection';

function collectPhysicalIds(value: unknown, ids = new Set<number>()): Set<number> {
  if (Array.isArray(value)) {
    for (const item of value) collectPhysicalIds(item, ids);
    return ids;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'id' && typeof nested === 'number') ids.add(nested);
      else collectPhysicalIds(nested, ids);
    }
  }
  return ids;
}

function replacePlayer(
  state: RoundState,
  seat: 0 | 1 | 2 | 3,
  replacement: RoundState['players'][number],
): RoundState {
  const players = [...state.players] as Array<RoundState['players'][number]>;
  players[seat] = replacement;
  return {
    ...state,
    players: [players[0], players[1], players[2], players[3]],
  };
}

describe('viewer-safe round projection', () => {
  it('shows exact concealed tiles only to their owner and never exposes hidden wall tiles', () => {
    const round = createRound(createRNG(42));
    const view = projectRound(round, 0);
    const exposedIds = collectPhysicalIds(view);

    for (const tile of round.players[0].concealed) expect(exposedIds.has(tile.id!)).toBe(true);
    for (const tile of round.players[1].concealed) expect(exposedIds.has(tile.id!)).toBe(false);
    expect(view.players[1].concealed).toBeNull();
    expect(view.players[1].concealedCount).toBe(13);

    const publicDoraIds = new Set(round.wall.doraIndicators.map((tile) => tile.id));
    for (const tile of round.wall.liveWall) expect(exposedIds.has(tile.id!)).toBe(false);
    for (const tile of round.wall.deadWall) {
      if (!publicDoraIds.has(tile.id)) expect(exposedIds.has(tile.id!)).toBe(false);
    }
    expect(view.wall.remainingLiveTiles).toBe(round.wall.liveWall.length);
  });

  it('gives spectators concealed counts but no exact hand to any seat', () => {
    const round = createRound(createRNG(7));
    const view = projectRound(round, null);
    expect(view.players.every((player) => player.concealed === null)).toBe(true);
    expect(view.players.map((player) => player.concealedCount)).toEqual([13, 13, 13, 13]);
    expect(view.legalActions).toEqual([]);
  });

  it('hides the drawn physical tile ID from opponents', () => {
    const initial = createRound(createRNG(9));
    const draw = applyAction(initial, { type: 'draw', player: 0 });
    expect(draw.ok).toBe(true);
    if (!draw.ok || draw.state.phase.kind !== 'awaiting-discard') return;

    const own = projectRound(draw.state, 0);
    const opponent = projectRound(draw.state, 1);
    expect(own.phase.kind).toBe('awaiting-discard');
    expect(opponent.phase.kind).toBe('awaiting-discard');
    if (own.phase.kind !== 'awaiting-discard' || opponent.phase.kind !== 'awaiting-discard') return;
    expect(own.phase.drawnTileId).toBe(draw.state.phase.drawnTileId);
    expect(opponent.phase.drawnTileId).toBeNull();
  });

  it('keeps Furiten and Ippatsu eligibility private to the owning viewer', () => {
    const initial = createRound(createRNG(11));
    const player0 = {
      ...initial.players[0],
      temporaryFuriten: true,
      riichiFuriten: true,
      ippatsuEligible: true,
    };
    const round = replacePlayer(initial, 0, player0);
    const own = projectRound(round, 0);
    const opponent = projectRound(round, 1);
    expect(own.players[0].privateState).toEqual({
      ippatsuEligible: true,
      temporaryFuriten: true,
      riichiFuriten: true,
    });
    expect(opponent.players[0].privateState).toBeUndefined();
  });
});

describe('event projection', () => {
  it('reveals a draw tile only to the drawing seat', () => {
    const round = createRound(createRNG(13));
    const tile = round.wall.liveWall[0];
    const event: RoundEvent = {
      type: 'TileDrawn',
      player: 0,
      tile,
      wasLastLiveDraw: false,
    };
    expect(projectEngineEvent(event, 0)).toEqual(event);
    expect(projectEngineEvent(event, 1)).toEqual({
      type: 'TileDrawn',
      player: 0,
      wasLastLiveDraw: false,
    });
  });

  it('does not publish claim events before the reaction barrier resolves', () => {
    const round = createRound(createRNG(17));
    const tile = round.players[0].concealed[0];
    const ron: RoundEvent = { type: 'RonClaimed', player: 1, discarder: 0, tile };
    const call: RoundEvent = { type: 'CallClaimed', player: 1, kind: 'pon', discarder: 0 };
    expect(projectEngineEvent(ron, 0)).toBeNull();
    expect(projectEngineEvent(call, 0)).toBeNull();
  });
});
