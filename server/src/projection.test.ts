import { describe, expect, it } from 'vitest';
import { applyAction, createRound, getLegalActions } from '@mahjong-live/shared/rules';
import type { PlayerIndex, RoundEvent, RoundState } from '@mahjong-live/shared/rules';
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

const SEATS: readonly PlayerIndex[] = [0, 1, 2, 3];

/** Plays the round forward with the dullest legal choice so the sweep runs on a mid-round state. */
function advance(state: RoundState, plies: number): RoundState {
  let current = state;
  for (let step = 0; step < plies && current.phase.kind !== 'ended'; step++) {
    if (current.phase.kind === 'reactions' || current.phase.kind === 'kan-reactions') {
      const resolved = applyAction(current, { type: 'resolve-reactions' });
      if (!resolved.ok) break;
      current = resolved.state;
      continue;
    }
    const seat = current.phase.player;
    const actions = getLegalActions(current, seat);
    const draw = actions.find((action) => action.type === 'draw');
    if (draw) {
      const result = applyAction(current, { type: 'draw', player: seat });
      if (!result.ok) break;
      current = result.state;
      continue;
    }
    const discard = actions.find((action) => action.type === 'discard');
    if (!discard || discard.type !== 'discard') break;
    const result = applyAction(current, { type: 'discard', player: seat, tileId: discard.tileIds[0] });
    if (!result.ok) break;
    current = result.state;
  }
  return current;
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

  it('never leaks another seat, the live wall or an unrevealed dead-wall tile mid-round', () => {
    const round = advance(createRound(createRNG(2026)), 80);
    expect(round.players.some((seat) => seat.discards.length > 0)).toBe(true);

    for (const viewer of SEATS) {
      const exposedIds = collectPhysicalIds(projectRound(round, viewer));
      for (const seat of SEATS) {
        if (seat === viewer) continue;
        for (const tile of round.players[seat].concealed) expect(exposedIds.has(tile.id!)).toBe(false);
      }
      for (const tile of round.wall.liveWall) expect(exposedIds.has(tile.id!)).toBe(false);
      const publicDoraIds = new Set(round.wall.doraIndicators.map((tile) => tile.id));
      for (const tile of round.wall.deadWall) {
        if (!publicDoraIds.has(tile.id)) expect(exposedIds.has(tile.id!)).toBe(false);
      }
    }
  });

  it('publishes the Riichi declaration marker on a discard to every seat', () => {
    const initial = advance(createRound(createRNG(31)), 6);
    const declared = initial.players[0].discards[0];
    expect(declared).toBeDefined();
    const round = replacePlayer(initial, 0, {
      ...initial.players[0],
      riichi: 'riichi',
      discards: [{ ...declared, riichiDeclaration: true }],
    });

    for (const viewer of SEATS) {
      const view = projectRound(round, viewer);
      expect(view.players[0].riichi).toBe('riichi');
      expect(view.players[0].discards[0].riichiDeclaration).toBe(true);
    }
    expect(projectRound(round, 1).players[0].concealed).toBeNull();
  });
});

/**
 * The allowlist is safe in the leak direction and unsafe in the other: a new per-seat
 * field silently missing from the view leads the client to guess it locally. These
 * declared key sets turn "field dropped" into a failing test.
 */
describe('projected key sets are declared, not inferred', () => {
  const ROUND_KEYS = [
    'callsMade',
    'currentPlayer',
    'dealer',
    'honba',
    'legalActions',
    'phase',
    'players',
    'riichiSticks',
    'roundWind',
    'wall',
  ];
  const PLAYER_KEYS = [
    'concealed',
    'concealedCount',
    'discardCount',
    'discards',
    'drawCount',
    'melds',
    'points',
    'riichi',
    'seat',
  ];
  const WALL_KEYS = ['doraIndicators', 'remainingLiveTiles'];

  const keys = (value: object): string[] => Object.keys(value).sort();

  it('emits exactly the declared round, wall and player keys', () => {
    const view = projectRound(createRound(createRNG(5)), 1);
    expect(keys(view)).toEqual(ROUND_KEYS);
    expect(keys(view.wall)).toEqual(WALL_KEYS);
    for (const seat of SEATS) {
      const expected = seat === 1 ? [...PLAYER_KEYS, 'privateState'].sort() : PLAYER_KEYS;
      expect(keys(view.players[seat])).toEqual(expected);
    }
  });

  it('emits exactly the declared keys for every phase a viewer can observe', () => {
    const drawn = applyAction(createRound(createRNG(9)), { type: 'draw', player: 0 });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    expect(keys(projectRound(drawn.state, 0).phase)).toEqual([
      'drawnTileId',
      'isRinshan',
      'kind',
      'pendingKanDora',
      'player',
      'wasLastLiveDraw',
    ]);
    expect(keys(projectRound(createRound(createRNG(9)), 0).phase)).toEqual(['kind', 'player']);

    const discardable = getLegalActions(drawn.state, 0).find((action) => action.type === 'discard');
    expect(discardable?.type).toBe('discard');
    if (discardable?.type !== 'discard') return;
    const discarded = applyAction(drawn.state, {
      type: 'discard',
      player: 0,
      tileId: discardable.tileIds[0],
    });
    expect(discarded.ok).toBe(true);
    if (!discarded.ok) return;
    expect(discarded.state.phase.kind).toBe('reactions');
    expect(keys(projectRound(discarded.state, 1).phase)).toEqual([
      'discardIndex',
      'discarder',
      'kind',
    ]);
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
