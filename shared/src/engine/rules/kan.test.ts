import { describe, expect, it } from 'vitest';
import { suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction, getLegalActions } from './round';
import type { PlayerMeld, RoundDiscard, RoundPlayerState, RoundState } from './types';

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

function wall(rinshan?: Tile) {
  const dead = Array.from({ length: 14 }, (_, i) => physical(suited('man', ((i % 9) + 1) as 1|2|3|4|5|6|7|8|9), 8000 + i));
  if (rinshan) dead[10] = rinshan;
  return {
    liveWall: [physical(suited('sou', 1), 9000), physical(suited('sou', 2), 9001), physical(suited('sou', 3), 9002)],
    deadWall: dead,
    doraIndicators: [dead[0]],
  };
}

function stateWith(
  players: RoundState['players'],
  phase: RoundState['phase'],
  overrides: Partial<RoundState> = {},
): RoundState {
  return {
    wall: wall(),
    players,
    dealer: 0,
    roundWind: 'east',
    honba: 0,
    riichiSticks: 0,
    currentPlayer: phase.kind === 'awaiting-discard' || phase.kind === 'awaiting-draw' ? phase.player : 0,
    callsMade: 0,
    phase,
    ...overrides,
  };
}

function arbitraryTiles(start = 100): Tile[] {
  return [
    physical(suited('man', 2), start), physical(suited('man', 3), start + 1),
    physical(suited('pin', 2), start + 2), physical(suited('pin', 3), start + 3),
    physical(suited('pin', 4), start + 4), physical(suited('sou', 4), start + 5),
    physical(suited('sou', 5), start + 6), physical(suited('sou', 6), start + 7),
    physical(suited('man', 7), start + 8), physical(suited('man', 7), start + 9),
  ];
}

describe('Ankan', () => {
  it('completes immediately, reveals Kan-Dora and draws Rinshan while preserving dead wall size', () => {
    const east = [0, 1, 2, 3].map((n) => physical(wind('east'), 10 + n));
    const concealed = [...east, ...arbitraryTiles(100)];
    const state = stateWith(
      [player(concealed), player(), player(), player()],
      { kind: 'awaiting-discard', player: 0, drawnTileId: east[3].id!, wasLastLiveDraw: false },
    );
    const option = getLegalActions(state, 0).find((action) => action.type === 'ankan');
    expect(option?.type).toBe('ankan');
    if (!option || option.type !== 'ankan') return;

    const result = applyAction(state, { type: 'ankan', player: 0, tileIds: option.options[0] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].melds[0]).toMatchObject({ type: 'quad', isOpen: false });
    expect(result.state.wall.doraIndicators).toHaveLength(2);
    expect(result.state.wall.deadWall).toHaveLength(14);
    expect(result.state.wall.liveWall).toHaveLength(state.wall.liveWall.length - 1);
    expect(result.state.phase).toMatchObject({ kind: 'awaiting-discard', player: 0, isRinshan: true, pendingKanDora: false });
  });

  it('forbids Riichi okuri-kan when the newly drawn tile is not one of the four tiles', () => {
    const east = [0, 1, 2, 3].map((n) => physical(wind('east'), 300 + n));
    const drawn = physical(suited('pin', 9), 399);
    const concealed = [...east, ...arbitraryTiles(400).slice(0, 9), drawn];
    const state = stateWith(
      [player(concealed, { riichi: 'riichi' }), player(), player(), player()],
      { kind: 'awaiting-discard', player: 0, drawnTileId: drawn.id!, wasLastLiveDraw: false },
    );
    expect(getLegalActions(state, 0).some((action) => action.type === 'ankan')).toBe(false);
  });

  it('allows Riichi Ankan when the drawn fourth copy preserves the exact structural wait set', () => {
    const ones = [0, 1, 2, 3].map((n) => physical(suited('man', 1), 430 + n));
    const rest = [
      physical(suited('pin', 2), 440), physical(suited('pin', 3), 441), physical(suited('pin', 4), 442),
      physical(suited('pin', 5), 443), physical(suited('pin', 6), 444), physical(suited('pin', 7), 445),
      physical(suited('sou', 7), 446), physical(suited('sou', 8), 447),
      physical(suited('sou', 9), 448), physical(suited('sou', 9), 449),
    ];
    const state = stateWith(
      [player([...ones, ...rest], { riichi: 'riichi' }), player(), player(), player()],
      { kind: 'awaiting-discard', player: 0, drawnTileId: ones[3].id!, wasLastLiveDraw: false },
    );
    const action = getLegalActions(state, 0).find((candidate) => candidate.type === 'ankan');
    expect(action?.type).toBe('ankan');
    if (!action || action.type !== 'ankan') return;
    expect(action.options).toContainEqual(ones.map((tile) => tile.id));

    const result = applyAction(state, { type: 'ankan', player: 0, tileIds: action.options[0] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].melds[0]).toMatchObject({ type: 'quad', isOpen: false });
  });

  it('can win on the replacement tile with Rinshan Kaihou', () => {
    const east = [0, 1, 2, 3].map((n) => physical(wind('east'), 500 + n));
    const winning = physical(suited('sou', 8), 599);
    const ten = [
      physical(suited('man', 1), 510), physical(suited('man', 2), 511), physical(suited('man', 3), 512),
      physical(suited('pin', 2), 513), physical(suited('pin', 3), 514), physical(suited('pin', 4), 515),
      physical(suited('sou', 6), 516), physical(suited('sou', 7), 517),
      physical(suited('pin', 5), 518), physical(suited('pin', 5), 519),
    ];
    const customWall = wall(winning);
    const state = stateWith(
      [player([...east, ...ten]), player(), player(), player()],
      { kind: 'awaiting-discard', player: 0, drawnTileId: east[3].id!, wasLastLiveDraw: false },
      { wall: customWall },
    );
    const ankan = getLegalActions(state, 0).find((action) => action.type === 'ankan');
    expect(ankan?.type).toBe('ankan');
    if (!ankan || ankan.type !== 'ankan') return;
    const afterKan = applyAction(state, { type: 'ankan', player: 0, tileIds: ankan.options[0] });
    expect(afterKan.ok).toBe(true);
    if (!afterKan.ok) return;
    expect(getLegalActions(afterKan.state, 0).some((action) => action.type === 'tsumo')).toBe(true);
    const win = applyAction(afterKan.state, { type: 'tsumo', player: 0 });
    expect(win.ok).toBe(true);
    if (!win.ok || win.state.phase.kind !== 'ended' || win.state.phase.result.type !== 'tsumo') return;
    expect(win.state.phase.result.score.yaku.map((yaku) => yaku.name)).toContain('Rinshan Kaihou');
  });
});

describe('Daiminkan immediate Kan-Dora', () => {
  it('reveals the new indicator when the Kan completes, before the Rinshan discard', () => {
    const discardTile = physical(suited('pin', 5), 1000);
    const record: RoundDiscard = { tile: discardTile, tileId: 1000, tsumogiri: false, wasLastLiveDraw: false };
    const matches = [1, 2, 3].map((n) => physical(suited('pin', 5, n === 1), 1000 + n));
    const state = stateWith(
      [player([], { discards: [record], discardCount: 1 }), player([...matches, ...arbitraryTiles(1100)]), player(), player()],
      { kind: 'reactions', discarder: 0, discardIndex: 0, ronClaims: [], callClaims: [] },
    );
    const legal = getLegalActions(state, 1).find((action) => action.type === 'daiminkan');
    expect(legal?.type).toBe('daiminkan');
    if (!legal || legal.type !== 'daiminkan') return;
    const claim = applyAction(state, { type: 'daiminkan', player: 1, tileIds: legal.options[0] });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    const resolved = applyAction(claim.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'awaiting-discard') return;
    expect(resolved.state.players[1].melds[0]).toMatchObject({ type: 'quad', isOpen: true });
    expect(resolved.state.wall.doraIndicators).toHaveLength(2);
    expect(resolved.state.phase.pendingKanDora).toBe(false);
    expect(resolved.events.some((event) => event.type === 'DoraIndicatorRevealed')).toBe(true);
    const drawnId = resolved.state.phase.drawnTileId!;
    const discard = applyAction(resolved.state, { type: 'discard', player: 1, tileId: drawnId });
    expect(discard.ok).toBe(true);
    if (!discard.ok) return;
    expect(discard.state.wall.doraIndicators).toHaveLength(2);
    expect(discard.events.some((event) => event.type === 'DoraIndicatorRevealed')).toBe(false);
  });

  it('keeps the immediately revealed Kan-Dora active for a Rinshan win', () => {
    const discardTile = physical(suited('pin', 5), 1300);
    const record: RoundDiscard = { tile: discardTile, tileId: 1300, tsumogiri: false, wasLastLiveDraw: false };
    const matches = [1, 2, 3].map((n) => physical(suited('pin', 5, n === 1), 1300 + n));
    const winning = physical(suited('sou', 8), 1399);
    const preWin = [
      physical(suited('man', 1), 1310), physical(suited('man', 2), 1311), physical(suited('man', 3), 1312),
      physical(suited('pin', 2), 1313), physical(suited('pin', 3), 1314), physical(suited('pin', 4), 1315),
      physical(suited('sou', 6), 1316), physical(suited('sou', 7), 1317),
      physical(suited('sou', 5), 1318), physical(suited('sou', 5), 1319),
    ];
    const state = stateWith(
      [player([], { discards: [record], discardCount: 1 }), player([...matches, ...preWin]), player(), player()],
      { kind: 'reactions', discarder: 0, discardIndex: 0, ronClaims: [], callClaims: [] },
      { wall: wall(winning) },
    );
    const legal = getLegalActions(state, 1).find((action) => action.type === 'daiminkan');
    expect(legal?.type).toBe('daiminkan');
    if (!legal || legal.type !== 'daiminkan') return;
    const claim = applyAction(state, { type: 'daiminkan', player: 1, tileIds: legal.options[0] });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    const resolved = applyAction(claim.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'awaiting-discard') return;
    expect(resolved.state.wall.doraIndicators).toHaveLength(2);
    expect(resolved.state.phase.pendingKanDora).toBe(false);
    expect(getLegalActions(resolved.state, 1).some((action) => action.type === 'tsumo')).toBe(true);

    const win = applyAction(resolved.state, { type: 'tsumo', player: 1 });
    expect(win.ok).toBe(true);
    if (!win.ok || win.state.phase.kind !== 'ended' || win.state.phase.result.type !== 'tsumo') return;
    expect(win.state.phase.result.score.yaku.map((yaku) => yaku.name)).toContain('Rinshan Kaihou');
    expect(win.state.wall.doraIndicators).toHaveLength(2);
  });

  it('keeps immediate Daiminkan Dora active and adds the chained Ankan Dora', () => {
    const discardTile = physical(suited('pin', 5), 1400);
    const record: RoundDiscard = { tile: discardTile, tileId: 1400, tsumogiri: false, wasLastLiveDraw: false };
    const matches = [1, 2, 3].map((n) => physical(suited('pin', 5, n === 1), 1400 + n));
    const east = [0, 1, 2, 3].map((n) => physical(wind('east'), 1410 + n));
    const state = stateWith(
      [
        player([], { discards: [record], discardCount: 1 }),
        player([...matches, ...east, ...arbitraryTiles(1420).slice(0, 6)]),
        player(),
        player(),
      ],
      { kind: 'reactions', discarder: 0, discardIndex: 0, ronClaims: [], callClaims: [] },
    );
    const daiminkan = getLegalActions(state, 1).find((action) => action.type === 'daiminkan');
    expect(daiminkan?.type).toBe('daiminkan');
    if (!daiminkan || daiminkan.type !== 'daiminkan') return;
    const claimed = applyAction(state, { type: 'daiminkan', player: 1, tileIds: daiminkan.options[0] });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    const firstKan = applyAction(claimed.state, { type: 'resolve-reactions' });
    expect(firstKan.ok).toBe(true);
    if (!firstKan.ok || firstKan.state.phase.kind !== 'awaiting-discard') return;
    expect(firstKan.state.wall.doraIndicators).toHaveLength(2);
    expect(firstKan.state.phase.pendingKanDora).toBe(false);

    const ankan = getLegalActions(firstKan.state, 1).find((action) => action.type === 'ankan');
    expect(ankan?.type).toBe('ankan');
    if (!ankan || ankan.type !== 'ankan') return;
    const chained = applyAction(firstKan.state, { type: 'ankan', player: 1, tileIds: ankan.options[0] });
    expect(chained.ok).toBe(true);
    if (!chained.ok) return;
    expect(chained.state.wall.doraIndicators).toHaveLength(3);
    expect(chained.events.filter((event) => event.type === 'DoraIndicatorRevealed')).toHaveLength(1);
  });

  it('is suppressed by a competing Ron claim', () => {
    const discardTile = physical(suited('pin', 4), 1200);
    const record: RoundDiscard = { tile: discardTile, tileId: 1200, tsumogiri: false, wasLastLiveDraw: false };
    const waits = [
      physical(suited('man', 1), 1210), physical(suited('man', 2), 1211), physical(suited('man', 3), 1212),
      physical(suited('pin', 5), 1213), physical(suited('pin', 6), 1214),
      physical(suited('sou', 2), 1215), physical(suited('sou', 3), 1216), physical(suited('sou', 4), 1217),
      physical(suited('man', 6), 1218), physical(suited('man', 7), 1219), physical(suited('man', 8), 1220),
      physical(suited('sou', 5), 1221), physical(suited('sou', 5), 1222),
    ];
    const kans = [1, 2, 3].map((n) => physical(suited('pin', 4), 1230 + n));
    const state = stateWith(
      [player([], { discards: [record], discardCount: 1 }), player(waits), player(kans), player()],
      { kind: 'reactions', discarder: 0, discardIndex: 0, ronClaims: [], callClaims: [] },
    );
    const kanAction = getLegalActions(state, 2).find((action) => action.type === 'daiminkan');
    expect(kanAction?.type).toBe('daiminkan');
    if (!kanAction || kanAction.type !== 'daiminkan') return;
    const kanClaim = applyAction(state, { type: 'daiminkan', player: 2, tileIds: kanAction.options[0] });
    expect(kanClaim.ok).toBe(true);
    if (!kanClaim.ok) return;
    const ron = applyAction(kanClaim.state, { type: 'ron', player: 1 });
    expect(ron.ok).toBe(true);
    if (!ron.ok) return;
    const resolved = applyAction(ron.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'ended') return;
    expect(resolved.state.phase.result.type).toBe('ron');
    expect(resolved.state.players[2].melds).toHaveLength(0);
  });
});

describe('Kan limit', () => {
  it('does not expose a fifth Kan after four completed quads', () => {
    const quad = (rank: 1|2|3|4): PlayerMeld => ({
      type: 'quad',
      tiles: [0, 1, 2, 3].map((n) => physical(suited('man', rank), 2000 + rank * 10 + n)),
      isOpen: false,
    });
    const east = [0, 1, 2, 3].map((n) => physical(wind('east'), 2100 + n));
    const state = stateWith(
      [player([...east, ...arbitraryTiles(2200)], { melds: [quad(1), quad(2), quad(3), quad(4)] }), player(), player(), player()],
      { kind: 'awaiting-discard', player: 0, drawnTileId: east[3].id!, wasLastLiveDraw: false },
    );
    expect(getLegalActions(state, 0).some((action) => action.type === 'ankan')).toBe(false);
  });
});
