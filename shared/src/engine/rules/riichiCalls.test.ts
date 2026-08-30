import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction, getLegalActions } from './round';
import type { RoundDiscard, RoundPhase, RoundPlayerState, RoundState } from './types';

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
    drawCount: 0,
    discardCount: 0,
    ...overrides,
  };
}

function stateWith(
  players: RoundState['players'],
  phase: RoundPhase,
  overrides: Partial<RoundState> = {},
): RoundState {
  const currentPlayer = phase.kind === 'awaiting-draw' || phase.kind === 'awaiting-discard'
    ? phase.player
    : phase.kind === 'reactions'
      ? phase.discarder
      : 0;
  return {
    wall: {
      liveWall: [
        physical(suited('man', 9), 9000),
        physical(suited('pin', 9), 9001),
        physical(suited('sou', 9), 9002),
        physical(suited('man', 8), 9003),
        physical(suited('pin', 8), 9004),
      ],
      deadWall: [],
      doraIndicators: [],
    },
    players,
    dealer: 0,
    roundWind: 'east',
    honba: 0,
    riichiSticks: 0,
    currentPlayer,
    callsMade: 0,
    phase,
    ...overrides,
  };
}

function riichiReady(startId = 0, extra = suited('sou', 9)): { tiles: Tile[]; extra: Tile } {
  let id = startId;
  const t = (tile: Tile) => physical(tile, id++);
  const extraTile = t(extra);
  const tiles = [
    t(suited('man', 1)), t(suited('man', 2)), t(suited('man', 3)),
    t(suited('man', 4)), t(suited('man', 5)), t(suited('man', 6)),
    t(suited('pin', 7)), t(suited('pin', 8)), t(suited('pin', 9)),
    t(suited('sou', 2)), t(suited('sou', 3)),
    t(suited('pin', 5)), t(suited('pin', 5)),
    extraTile,
  ];
  return { tiles, extra: extraTile };
}

function pinfuWait4p(startId = 100): Tile[] {
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

function reactionState(
  discard: Tile,
  players: RoundState['players'],
  overrides: Partial<RoundState> = {},
): RoundState {
  const record: RoundDiscard = {
    tile: discard,
    tileId: discard.id!,
    tsumogiri: false,
    wasLastLiveDraw: false,
  };
  const discarder = { ...players[0], discards: [record], discardCount: 1 };
  return stateWith(
    [discarder, players[1], players[2], players[3]],
    { kind: 'reactions', discarder: 0, discardIndex: 0, ronClaims: [], callClaims: [] },
    overrides,
  );
}

describe('Riichi declaration lifecycle', () => {
  it('keeps Riichi pending until the declaration discard survives Ron, then pays exactly 1000', () => {
    const ready = riichiReady(10);
    const players: RoundState['players'] = [player(ready.tiles), player(), player(), player()];
    const state = stateWith(players, {
      kind: 'awaiting-discard',
      player: 0,
      drawnTileId: ready.extra.id!,
      wasLastLiveDraw: false,
    });

    const legal = getLegalActions(state, 0).find((action) => action.type === 'riichi-discard');
    expect(legal?.type).toBe('riichi-discard');
    if (!legal || legal.type !== 'riichi-discard') return;
    expect(legal.tileIds).toContain(ready.extra.id!);

    const declared = applyAction(state, { type: 'riichi-discard', player: 0, tileId: ready.extra.id! });
    expect(declared.ok).toBe(true);
    if (!declared.ok || declared.state.phase.kind !== 'reactions') return;
    expect(declared.state.players[0].points).toBe(25_000);
    expect(declared.state.players[0].riichi).toBe('none');
    expect(declared.state.riichiSticks).toBe(0);
    expect(declared.state.phase.pendingRiichi?.doubleRiichi).toBe(true);

    const resolved = applyAction(declared.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[0].points).toBe(24_000);
    expect(resolved.state.players[0].riichi).toBe('double-riichi');
    expect(resolved.state.players[0].ippatsuEligible).toBe(true);
    expect(resolved.state.riichiSticks).toBe(1);
    expect(resolved.events).toContainEqual({
      type: 'RiichiDeclared',
      player: 0,
      doubleRiichi: true,
      tileId: ready.extra.id!,
    });
  });

  it('does not pay or activate Riichi when the declaration discard is won by Ron', () => {
    const ready = riichiReady(50, suited('pin', 4));
    const players: RoundState['players'] = [
      player(ready.tiles),
      player(pinfuWait4p(100)),
      player(),
      player(),
    ];
    const state = stateWith(players, {
      kind: 'awaiting-discard',
      player: 0,
      drawnTileId: ready.extra.id!,
      wasLastLiveDraw: false,
    });
    const declaration = applyAction(state, {
      type: 'riichi-discard',
      player: 0,
      tileId: ready.extra.id!,
    });
    expect(declaration.ok).toBe(true);
    if (!declaration.ok) return;
    const ron = applyAction(declaration.state, { type: 'ron', player: 1 });
    expect(ron.ok).toBe(true);
    if (!ron.ok || ron.state.phase.kind !== 'reactions') return;
    const payment = ron.state.phase.ronClaims[0].score.payments;
    expect(payment.type).toBe('ron');
    if (payment.type !== 'ron') return;

    const resolved = applyAction(ron.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[0].riichi).toBe('none');
    expect(resolved.state.riichiSticks).toBe(0);
    expect(resolved.state.players[0].points).toBe(25_000 - payment.fromDiscarder);
  });

  it('derives ordinary Riichi rather than Double Riichi after any earlier resolved call', () => {
    const ready = riichiReady(200);
    const state = stateWith(
      [player(ready.tiles), player(), player(), player()],
      { kind: 'awaiting-discard', player: 0, drawnTileId: ready.extra.id!, wasLastLiveDraw: false },
      { callsMade: 1 },
    );
    const declared = applyAction(state, { type: 'riichi-discard', player: 0, tileId: ready.extra.id! });
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    const resolved = applyAction(declared.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[0].riichi).toBe('riichi');
  });

  it('locks an active Riichi hand to tsumogiri on ordinary turns', () => {
    const ready = riichiReady(300);
    const drawn = ready.extra;
    const state = stateWith(
      [player(ready.tiles, { riichi: 'riichi' }), player(), player(), player()],
      { kind: 'awaiting-discard', player: 0, drawnTileId: drawn.id!, wasLastLiveDraw: false },
    );
    const otherId = ready.tiles.find((tile) => tile.id !== drawn.id)!.id!;
    expect(getLegalActions(state, 0).find((action) => action.type === 'discard')).toEqual({
      type: 'discard',
      tileIds: [drawn.id!],
    });
    expect(applyAction(state, { type: 'discard', player: 0, tileId: otherId })).toMatchObject({
      ok: false,
      error: { code: 'ILLEGAL_RIICHI' },
    });
  });
});

describe('Chi/Pon arbitration', () => {
  it('resolves Pon over Chi and transfers the turn to the caller without a draw', () => {
    const discard = physical(suited('man', 3), 1000);
    const p1a = physical(suited('man', 1), 1001);
    const p1b = physical(suited('man', 2), 1002);
    const p2a = physical(suited('man', 3), 1003);
    const p2b = physical(suited('man', 3), 1004);
    const state = reactionState(discard, [
      player(),
      player([p1a, p1b]),
      player([p2a, p2b]),
      player([], { riichi: 'riichi', ippatsuEligible: true }),
    ]);

    const chi = applyAction(state, { type: 'chi', player: 1, tileIds: [p1a.id!, p1b.id!] });
    expect(chi.ok).toBe(true);
    if (!chi.ok) return;
    const pon = applyAction(chi.state, { type: 'pon', player: 2, tileIds: [p2a.id!, p2b.id!] });
    expect(pon.ok).toBe(true);
    if (!pon.ok) return;
    const resolved = applyAction(pon.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.phase).toMatchObject({
      kind: 'awaiting-discard',
      player: 2,
      drawnTileId: null,
    });
    expect(resolved.state.players[2].melds).toHaveLength(1);
    expect(resolved.state.players[2].melds[0].type).toBe('triplet');
    expect(resolved.state.players[0].discards[0].calledBy).toBe(2);
    expect(resolved.state.callsMade).toBe(1);
    expect(resolved.state.players.every((p) => !p.ippatsuEligible)).toBe(true);
  });

  it('resolves Ron over a competing Pon claim', () => {
    const discard = physical(suited('pin', 4), 1100);
    const p2a = physical(suited('pin', 4), 1101);
    const p2b = physical(suited('pin', 4), 1102);
    const state = reactionState(discard, [
      player(),
      player(pinfuWait4p(1200)),
      player([p2a, p2b]),
      player(),
    ]);
    const pon = applyAction(state, { type: 'pon', player: 2, tileIds: [p2a.id!, p2b.id!] });
    expect(pon.ok).toBe(true);
    if (!pon.ok) return;
    const ron = applyAction(pon.state, { type: 'ron', player: 1 });
    expect(ron.ok).toBe(true);
    if (!ron.ok) return;
    const resolved = applyAction(ron.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'ended') return;
    expect(resolved.state.phase.result.type).toBe('ron');
    expect(resolved.state.players[2].melds).toHaveLength(0);
    expect(resolved.state.callsMade).toBe(0);
  });

  it('keeps red and non-red physical fives as separate Chi options', () => {
    const discard = physical(suited('pin', 4), 1300);
    const p3 = physical(suited('pin', 3), 1301);
    const red5 = physical(suited('pin', 5, true), 1302);
    const normal5 = physical(suited('pin', 5), 1303);
    const state = reactionState(discard, [
      player(),
      player([p3, red5, normal5]),
      player(),
      player(),
    ]);
    const chi = getLegalActions(state, 1).find((action) => action.type === 'chi');
    expect(chi?.type).toBe('chi');
    if (!chi || chi.type !== 'chi') return;
    expect(chi.options).toContainEqual([p3.id!, red5.id!]);
    expect(chi.options).toContainEqual([p3.id!, normal5.id!]);
  });
});

describe('Ura Dora', () => {
  it('feeds hidden paired indicators into scoring for an active Riichi win', () => {
    let id = 2000;
    const t = (tile: Tile) => physical(tile, id++);
    const winningTile = t(suited('sou', 8));
    const tiles = [
      t(suited('man', 1)), t(suited('man', 1)),
      t(suited('man', 2)), t(suited('man', 2)),
      t(suited('pin', 4)), t(suited('pin', 4)),
      t(suited('pin', 5)), t(suited('pin', 5)),
      t(suited('sou', 7)), t(suited('sou', 7)),
      t(suited('pin', 9)), t(suited('pin', 9)),
      t(suited('sou', 8)), winningTile,
    ];
    const dead = [
      suited('man', 9), suited('man', 8), suited('man', 7), suited('man', 6), suited('man', 5),
      suited('sou', 6),
    ];
    const state = stateWith(
      [player(), player(tiles, { riichi: 'riichi', drawCount: 2, discardCount: 1 }), player(), player()],
      { kind: 'awaiting-discard', player: 1, drawnTileId: winningTile.id!, wasLastLiveDraw: false },
      { wall: { liveWall: [], deadWall: dead, doraIndicators: [dead[0]] } },
    );
    const result = applyAction(state, { type: 'tsumo', player: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'ended') return;
    const end = result.state.phase.result;
    expect(end.type).toBe('tsumo');
    if (end.type !== 'tsumo') return;
    expect(end.score.dora.uraDora).toBe(2);
  });
});
