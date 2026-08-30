import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction, getLegalActions } from './round';
import type { RoundDiscard, RoundPlayerState, RoundState } from './types';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

function player(
  concealed: readonly Tile[] = [],
  overrides: Partial<RoundPlayerState> = {},
): RoundPlayerState {
  return {
    points: 25_000,
    concealed,
    melds: [],
    discards: [],
    riichi: 'none',
    ippatsuEligible: false,
    temporaryFuriten: false,
    riichiFuriten: false,
    drawCount: 1,
    discardCount: 0,
    ...overrides,
  };
}

function pinfuWait4p(startId = 0): Tile[] {
  let id = startId;
  const t = (tile: Tile) => physical(tile, id++);
  return [
    t(suited('man', 1)), t(suited('man', 2)), t(suited('man', 3)),
    t(suited('pin', 5)), t(suited('pin', 6)),
    t(suited('sou', 2)), t(suited('sou', 3)), t(suited('sou', 4)),
    t(suited('man', 6)), t(suited('man', 7)), t(suited('man', 8)),
    t(suited('sou', 5)), t(suited('sou', 5)),
  ];
}

function reactionForPlayer1(
  p1: RoundPlayerState,
  discard = physical(suited('pin', 4), 900),
): RoundState {
  const record: RoundDiscard = {
    tile: discard,
    tileId: discard.id!,
    tsumogiri: false,
    wasLastLiveDraw: false,
  };
  return {
    wall: {
      liveWall: [physical(suited('man', 9), 901), physical(suited('sou', 9), 902)],
      deadWall: [],
      doraIndicators: [],
    },
    players: [
      player([], { discards: [record], discardCount: 1 }),
      p1,
      player(),
      player(),
    ],
    dealer: 0,
    roundWind: 'east',
    honba: 0,
    riichiSticks: 0,
    currentPlayer: 0,
    callsMade: 0,
    phase: {
      kind: 'reactions',
      discarder: 0,
      discardIndex: 0,
      ronClaims: [],
      callClaims: [],
    },
  };
}

describe('permanent discard Furiten', () => {
  it('blocks Ron on every current wait when the player previously discarded one of them', () => {
    const ownWaitDiscard = physical(suited('pin', 7), 800);
    const p1 = player(pinfuWait4p(100), {
      discards: [{ tile: ownWaitDiscard, tileId: ownWaitDiscard.id!, tsumogiri: false, wasLastLiveDraw: false }],
      discardCount: 1,
    });
    const state = reactionForPlayer1(p1);
    expect(getLegalActions(state, 1).some((action) => action.type === 'ron')).toBe(false);
    expect(applyAction(state, { type: 'ron', player: 1 })).toMatchObject({
      ok: false,
      error: { code: 'FURITEN' },
    });
  });

  it('does not block Tsumo', () => {
    const winningTile = physical(suited('pin', 4), 500);
    const ownWaitDiscard = physical(suited('pin', 7), 501);
    const complete = [...pinfuWait4p(510), winningTile];
    const p1 = player(complete, {
      discards: [{ tile: ownWaitDiscard, tileId: ownWaitDiscard.id!, tsumogiri: false, wasLastLiveDraw: false }],
      discardCount: 1,
      drawCount: 2,
    });
    const state: RoundState = {
      wall: { liveWall: [], deadWall: [], doraIndicators: [] },
      players: [player(), p1, player(), player()],
      dealer: 0,
      roundWind: 'east',
      honba: 0,
      riichiSticks: 0,
      currentPlayer: 1,
      callsMade: 0,
      phase: { kind: 'awaiting-discard', player: 1, drawnTileId: winningTile.id!, wasLastLiveDraw: false },
    };
    expect(getLegalActions(state, 1).some((action) => action.type === 'tsumo')).toBe(true);
    expect(applyAction(state, { type: 'tsumo', player: 1 }).ok).toBe(true);
  });
});

describe('temporary Furiten', () => {
  it('is set when a legal Ron is passed and clears on the player next normal draw', () => {
    const state = reactionForPlayer1(player(pinfuWait4p(200)));
    expect(getLegalActions(state, 1).some((action) => action.type === 'ron')).toBe(true);
    const passed = applyAction(state, { type: 'resolve-reactions' });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    expect(passed.state.players[1].temporaryFuriten).toBe(true);
    expect(passed.state.phase).toEqual({ kind: 'awaiting-draw', player: 1 });

    const draw = applyAction(passed.state, { type: 'draw', player: 1 });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    expect(draw.state.players[1].temporaryFuriten).toBe(false);
  });
});

describe('Riichi Furiten', () => {
  it('becomes persistent when a Riichi player passes Ron and survives the next draw', () => {
    const state = reactionForPlayer1(player(pinfuWait4p(300), { riichi: 'riichi' }));
    expect(getLegalActions(state, 1).some((action) => action.type === 'ron')).toBe(true);
    const passed = applyAction(state, { type: 'resolve-reactions' });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    expect(passed.state.players[1].riichiFuriten).toBe(true);

    const draw = applyAction(passed.state, { type: 'draw', player: 1 });
    expect(draw.ok).toBe(true);
    if (!draw.ok) return;
    expect(draw.state.players[1].riichiFuriten).toBe(true);
    expect(draw.state.players[1].temporaryFuriten).toBe(false);
  });
});
