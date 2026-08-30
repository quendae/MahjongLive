import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction, getLegalActions } from './round';
import type {
  RoundDiscard,
  RoundPhase,
  RoundPlayerState,
  RoundState,
} from './types';

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
    wall: { liveWall: [], deadWall: [], doraIndicators: [] },
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

function pinfuHand(startId = 0): { complete: Tile[]; before: Tile[]; winningTile: Tile } {
  let id = startId;
  const t = (tile: Tile) => physical(tile, id++);
  const winningTile = t(suited('pin', 4));
  const complete = [
    t(suited('man', 1)), t(suited('man', 2)), t(suited('man', 3)),
    winningTile, t(suited('pin', 5)), t(suited('pin', 6)),
    t(suited('sou', 2)), t(suited('sou', 3)), t(suited('sou', 4)),
    t(suited('man', 6)), t(suited('man', 7)), t(suited('man', 8)),
    t(suited('sou', 5)), t(suited('sou', 5)),
  ];
  return { complete, before: complete.filter((tile) => tile !== winningTile), winningTile };
}

function ronState(
  claimantHands: Array<{ playerIndex: 1 | 2 | 3; before: Tile[] }>,
  winningTile: Tile,
  wasLastLiveDraw = false,
  overrides: Partial<RoundState> = {},
): RoundState {
  const discard: RoundDiscard = {
    tile: winningTile,
    tileId: winningTile.id!,
    tsumogiri: false,
    wasLastLiveDraw,
  };
  const players: RoundState['players'] = [
    player([], { discards: [discard], discardCount: 1 }),
    player(),
    player(),
    player(),
  ];
  const mutable = [...players] as RoundPlayerState[];
  for (const claimant of claimantHands) {
    mutable[claimant.playerIndex] = player(claimant.before, { drawCount: 1 });
  }
  return stateWith(
    [mutable[0], mutable[1], mutable[2], mutable[3]],
    { kind: 'reactions', discarder: 0, discardIndex: 0, ronClaims: [] },
    overrides,
  );
}

describe('Tsumo settlement', () => {
  it('scores a normal closed Tsumo and transfers points without changing total player points', () => {
    const hand = pinfuHand(10);
    const players: RoundState['players'] = [
      player(),
      player(hand.complete, { drawCount: 2, discardCount: 1 }),
      player(),
      player(),
    ];
    const state = stateWith(players, {
      kind: 'awaiting-discard',
      player: 1,
      drawnTileId: hand.winningTile.id!,
      wasLastLiveDraw: false,
    });

    expect(getLegalActions(state, 1).some((action) => action.type === 'tsumo')).toBe(true);
    const result = applyAction(state, { type: 'tsumo', player: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'ended') return;
    expect(result.state.phase.result.type).toBe('tsumo');
    if (result.state.phase.result.type !== 'tsumo') return;
    expect(result.state.phase.result.score.scoringYaku.map((yaku) => yaku.name)).toContain('Menzen Tsumo');
    expect(result.state.players[1].points).toBeGreaterThan(25_000);
    expect(result.state.players.reduce((sum, p) => sum + p.points, 0)).toBe(100_000);
  });

  it('derives Tenhou for the dealer winning on the first draw', () => {
    const hand = pinfuHand(100);
    const players: RoundState['players'] = [
      player(hand.complete, { drawCount: 1 }), player(), player(), player(),
    ];
    const state = stateWith(players, {
      kind: 'awaiting-discard',
      player: 0,
      drawnTileId: hand.winningTile.id!,
      wasLastLiveDraw: false,
    });
    const result = applyAction(state, { type: 'tsumo', player: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'ended') return;
    const end = result.state.phase.result;
    expect(end.type).toBe('tsumo');
    if (end.type !== 'tsumo') return;
    expect(end.score.scoringYaku.map((yaku) => yaku.name)).toContain('Tenhou');
    expect(end.score.yakuman).toBe(1);
  });

  it('derives Chiihou for a non-dealer winning on that player first draw with no calls', () => {
    const hand = pinfuHand(200);
    const earlierDiscard: RoundDiscard = {
      tile: physical(suited('man', 9), 999),
      tileId: 999,
      tsumogiri: false,
      wasLastLiveDraw: false,
    };
    const players: RoundState['players'] = [
      player([], { discards: [earlierDiscard], discardCount: 1 }),
      player(hand.complete, { drawCount: 1 }),
      player(),
      player(),
    ];
    const state = stateWith(players, {
      kind: 'awaiting-discard',
      player: 1,
      drawnTileId: hand.winningTile.id!,
      wasLastLiveDraw: false,
    });
    const result = applyAction(state, { type: 'tsumo', player: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'ended') return;
    const end = result.state.phase.result;
    expect(end.type).toBe('tsumo');
    if (end.type !== 'tsumo') return;
    expect(end.score.scoringYaku.map((yaku) => yaku.name)).toContain('Chiihou');
  });

  it('derives Haitei from a Tsumo on the last live-wall draw', () => {
    const hand = pinfuHand(300);
    const players: RoundState['players'] = [
      player(),
      player(hand.complete, { drawCount: 2, discardCount: 1 }),
      player(),
      player(),
    ];
    const state = stateWith(players, {
      kind: 'awaiting-discard',
      player: 1,
      drawnTileId: hand.winningTile.id!,
      wasLastLiveDraw: true,
    });
    const result = applyAction(state, { type: 'tsumo', player: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'ended') return;
    const end = result.state.phase.result;
    expect(end.type).toBe('tsumo');
    if (end.type !== 'tsumo') return;
    expect(end.score.yaku.map((yaku) => yaku.name)).toContain('Haitei');
  });
});

describe('Ron reaction window', () => {
  it('validates Ron against the exact discard object, then settles on resolve-reactions', () => {
    const hand = pinfuHand(400);
    const state = ronState([{ playerIndex: 1, before: hand.before }], hand.winningTile);
    expect(getLegalActions(state, 1)).toEqual([{ type: 'ron' }]);
    expect(getLegalActions(state, 0)).toEqual([]);

    const claim = applyAction(state, { type: 'ron', player: 1 });
    expect(claim.ok).toBe(true);
    if (!claim.ok || claim.state.phase.kind !== 'reactions') return;
    expect(claim.state.phase.ronClaims).toHaveLength(1);
    expect(claim.state.phase.ronClaims[0].score.scoringYaku.map((yaku) => yaku.name)).toContain('Pinfu');
    expect(claim.state.players[0].points).toBe(25_000); // claim alone does not settle

    const resolved = applyAction(claim.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'ended') return;
    expect(resolved.state.phase.result.type).toBe('ron');
    expect(resolved.state.players[0].points).toBeLessThan(25_000);
    expect(resolved.state.players[1].points).toBeGreaterThan(25_000);
  });

  it('collects and settles two simultaneous Ron winners against one discarder', () => {
    const first = pinfuHand(500);
    const second = pinfuHand(600);
    // Both waits require the same 4p tile type; the actual winning object is the one discard.
    const state = ronState([
      { playerIndex: 1, before: first.before },
      { playerIndex: 2, before: second.before },
    ], first.winningTile);

    const claim1 = applyAction(state, { type: 'ron', player: 1 });
    expect(claim1.ok).toBe(true);
    if (!claim1.ok) return;
    const claim2 = applyAction(claim1.state, { type: 'ron', player: 2 });
    expect(claim2.ok).toBe(true);
    if (!claim2.ok || claim2.state.phase.kind !== 'reactions') return;
    expect(claim2.state.phase.ronClaims.map((claim) => claim.player)).toEqual([1, 2]);

    const resolved = applyAction(claim2.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'ended') return;
    const end = resolved.state.phase.result;
    expect(end.type).toBe('ron');
    if (end.type !== 'ron') return;
    expect(end.winners).toHaveLength(2);
    expect(resolved.state.players[0].points).toBeLessThan(25_000);
    expect(resolved.state.players[1].points).toBeGreaterThan(25_000);
    expect(resolved.state.players[2].points).toBeGreaterThan(25_000);
  });

  it('derives Houtei from Ron on the discard following the last live draw', () => {
    const hand = pinfuHand(700);
    const state = ronState([{ playerIndex: 1, before: hand.before }], hand.winningTile, true);
    const claim = applyAction(state, { type: 'ron', player: 1 });
    expect(claim.ok).toBe(true);
    if (!claim.ok || claim.state.phase.kind !== 'reactions') return;
    expect(claim.state.phase.ronClaims[0].score.yaku.map((yaku) => yaku.name)).toContain('Houtei');
  });

  it('ends as exhaustive draw after the last-live discard when nobody claims Ron and keeps the pot', () => {
    const discardTile = physical(suited('man', 9), 800);
    const state = ronState([], discardTile, true, { riichiSticks: 2 });
    const resolved = applyAction(state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'ended') return;
    expect(resolved.state.phase.result).toEqual({ type: 'exhaustive-draw' });
    expect(resolved.state.riichiSticks).toBe(2);
  });
});
