import { describe, expect, it } from 'vitest';
import { suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction, getLegalActions } from './round';
import { completeShouminkan } from './kan';
import type { PlayerMeld, RoundPlayerState, RoundState } from './types';

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
    discardCount: 1,
    ...overrides,
  };
}

function wall() {
  const deadWall = Array.from({ length: 14 }, (_, index) =>
    physical(suited('pin', ((index % 9) + 1) as 1|2|3|4|5|6|7|8|9), 8000 + index),
  );
  return {
    liveWall: [
      physical(suited('sou', 1), 9000),
      physical(suited('sou', 2), 9001),
      physical(suited('sou', 3), 9002),
      physical(suited('sou', 4), 9003),
    ],
    deadWall,
    doraIndicators: [deadWall[0]],
  };
}

function state(
  p0: RoundPlayerState,
  drawnTileId: number,
  overrides: Partial<RoundState> = {},
): RoundState {
  return {
    wall: wall(),
    players: [p0, player(), player(), player()],
    dealer: 0,
    roundWind: 'east',
    honba: 0,
    riichiSticks: 0,
    currentPlayer: 0,
    callsMade: 0,
    phase: {
      kind: 'awaiting-discard',
      player: 0,
      drawnTileId,
      wasLastLiveDraw: false,
    },
    ...overrides,
  };
}

function concealedWaitWithFour1m(): { tiles: Tile[]; drawn: Tile } {
  const one = [0, 1, 2, 3].map((copy) => physical(suited('man', 1), 100 + copy));
  const drawn = one[3];
  return {
    drawn,
    tiles: [
      ...one,
      physical(suited('man', 2), 110), physical(suited('man', 3), 111), physical(suited('man', 4), 112),
      physical(suited('pin', 4), 113), physical(suited('pin', 5), 114), physical(suited('pin', 6), 115),
      physical(suited('sou', 7), 116), physical(suited('sou', 8), 117),
      physical(suited('sou', 9), 118), physical(suited('sou', 9), 119),
    ],
  };
}

describe('Riichi Ankan timing', () => {
  it('allows the drawn fourth copy when the structural wait set is unchanged and cancels Ippatsu', () => {
    const hand = concealedWaitWithFour1m();
    const round = state(player(hand.tiles, { riichi: 'riichi', ippatsuEligible: true }), hand.drawn.id!);
    const legal = getLegalActions(round, 0).find((action) => action.type === 'ankan');
    expect(legal?.type).toBe('ankan');
    if (!legal || legal.type !== 'ankan') return;

    const result = applyAction(round, { type: 'ankan', player: 0, tileIds: legal.options[0] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].melds[0]).toMatchObject({ type: 'quad', isOpen: false });
    expect(result.state.players[0].ippatsuEligible).toBe(false);
    expect(result.state.phase).toMatchObject({ kind: 'awaiting-discard', isRinshan: true });
  });

  it('flushes an older delayed Kan-Dora before an immediately chained Ankan', () => {
    const hand = concealedWaitWithFour1m();
    const round = state(player(hand.tiles), hand.drawn.id!);
    round.phase = {
      kind: 'awaiting-discard',
      player: 0,
      drawnTileId: hand.drawn.id!,
      wasLastLiveDraw: false,
      isRinshan: true,
      pendingKanDora: true,
    };
    const legal = getLegalActions(round, 0).find((action) => action.type === 'ankan');
    expect(legal?.type).toBe('ankan');
    if (!legal || legal.type !== 'ankan') return;
    const result = applyAction(round, { type: 'ankan', player: 0, tileIds: legal.options[0] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.wall.doraIndicators).toHaveLength(3);
    expect(result.events.filter((event) => event.type === 'DoraIndicatorRevealed')).toHaveLength(2);
  });
});


describe('completed Kan-Dora presentation timing', () => {
  it('reveals completed Shouminkan Kan-Dora immediately before the Rinshan draw', () => {
    const ponTiles = [0, 1, 2].map((copy) => physical(suited('man', 5), 5000 + copy));
    const addedTile = physical(suited('man', 5), 5003);
    const round = state(
      player([], { melds: [{ type: 'triplet', tiles: ponTiles, isOpen: true }] }),
      9999,
    );
    round.phase = {
      kind: 'kan-reactions',
      declarer: 0,
      meldIndex: 0,
      addedTile,
      ronClaims: [],
    };

    const result = completeShouminkan(round);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.state.wall.doraIndicators).toHaveLength(2);
    expect(result.state.phase).toMatchObject({ kind: 'awaiting-discard', isRinshan: true, pendingKanDora: false });
    expect(result.events.map((event) => event.type)).toEqual([
      'KanCompleted',
      'DoraIndicatorRevealed',
      'TileDrawn',
    ]);
  });
});

describe('fourth Kan boundary', () => {
  it('allows a fourth completed Kan when exactly three quads already exist', () => {
    const existing = (rank: 2|3|4): PlayerMeld => ({
      type: 'quad',
      tiles: [0, 1, 2, 3].map((copy) => physical(suited('pin', rank), 3000 + rank * 10 + copy)),
      isOpen: false,
    });
    const east = [0, 1, 2, 3].map((copy) => physical(wind('east'), 4000 + copy));
    const filler = [
      physical(suited('man', 2), 4100), physical(suited('man', 3), 4101),
      physical(suited('man', 4), 4102), physical(suited('sou', 5), 4103),
      physical(suited('sou', 6), 4104), physical(suited('sou', 7), 4105),
      physical(suited('man', 8), 4106), physical(suited('man', 8), 4107),
      physical(suited('sou', 2), 4108), physical(suited('sou', 3), 4109),
    ];
    const round = state(
      player([...east, ...filler], { melds: [existing(2), existing(3), existing(4)] }),
      east[3].id!,
    );
    const legal = getLegalActions(round, 0).find((action) => action.type === 'ankan');
    expect(legal?.type).toBe('ankan');
    if (!legal || legal.type !== 'ankan') return;
    const result = applyAction(round, { type: 'ankan', player: 0, tileIds: legal.options[0] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].melds.filter((meld) => meld.type === 'quad')).toHaveLength(4);
  });
});
