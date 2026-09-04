import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction, getLegalActions } from './round';
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
    physical(suited('man', ((index % 9) + 1) as 1|2|3|4|5|6|7|8|9), 8000 + index),
  );
  return {
    liveWall: [
      physical(suited('sou', 1), 9000),
      physical(suited('sou', 2), 9001),
      physical(suited('sou', 3), 9002),
    ],
    deadWall,
    doraIndicators: [deadWall[0]],
  };
}

function wait4p(startId: number): Tile[] {
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

function shouminkanState(claimants: readonly (1|2|3)[] = [1]): RoundState {
  const ponTiles = [0, 1, 2].map((copy) => physical(suited('pin', 4), 100 + copy));
  const addedTile = physical(suited('pin', 4), 103);
  const pon: PlayerMeld = {
    type: 'triplet',
    tiles: ponTiles,
    isOpen: true,
    calledFrom: 3,
    calledTileId: 999,
  };
  const filler = [
    physical(suited('man', 2), 200), physical(suited('man', 3), 201),
    physical(suited('man', 4), 202), physical(suited('pin', 2), 203),
    physical(suited('pin', 3), 204), physical(suited('sou', 6), 205),
    physical(suited('sou', 7), 206), physical(suited('sou', 8), 207),
    physical(suited('man', 9), 208), physical(suited('man', 9), 209),
  ];
  const players: RoundState['players'] = [
    player([...filler, addedTile], { melds: [pon], ippatsuEligible: true }),
    player(),
    player(),
    player(),
  ];
  const mutable = [...players] as RoundPlayerState[];
  for (const seat of claimants) {
    mutable[seat] = player(wait4p(1000 + seat * 100), {
      riichi: seat === 1 ? 'riichi' : 'none',
      ippatsuEligible: seat === 1,
    });
  }
  return {
    wall: wall(),
    players: [mutable[0], mutable[1], mutable[2], mutable[3]],
    dealer: 0,
    roundWind: 'east',
    honba: 0,
    riichiSticks: 0,
    currentPlayer: 0,
    callsMade: 1,
    phase: {
      kind: 'awaiting-discard',
      player: 0,
      drawnTileId: addedTile.id!,
      wasLastLiveDraw: false,
    },
  };
}

function begin(state: RoundState) {
  const action = getLegalActions(state, 0).find((candidate) => candidate.type === 'shouminkan');
  expect(action?.type).toBe('shouminkan');
  if (!action || action.type !== 'shouminkan') throw new Error('expected shouminkan option');
  const result = applyAction(state, {
    type: 'shouminkan',
    player: 0,
    meldIndex: action.options[0].meldIndex,
    tileId: action.options[0].tileId,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('Shouminkan / Chankan', () => {
  it('opens a dedicated Chankan window without completing the Kan or cancelling Ippatsu', () => {
    const state = shouminkanState();
    const started = begin(state);
    expect(started.phase.kind).toBe('kan-reactions');
    expect(started.players[0].melds[0].type).toBe('triplet');
    expect(started.players[0].ippatsuEligible).toBe(true);
    expect(started.wall.doraIndicators).toHaveLength(1);
    expect(getLegalActions(started, 1)).toEqual([{ type: 'ron' }]);
  });

  it('scores Chankan and preserves the uncompleted Pon when the Kan is robbed', () => {
    const started = begin(shouminkanState());
    const claim = applyAction(started, { type: 'ron', player: 1 });
    expect(claim.ok).toBe(true);
    if (!claim.ok || claim.state.phase.kind !== 'kan-reactions') return;
    expect(claim.state.phase.ronClaims[0].score.yaku.map((yaku) => yaku.name)).toContain('Chankan');
    expect(claim.state.phase.ronClaims[0].score.yaku.map((yaku) => yaku.name)).toContain('Ippatsu');

    const resolved = applyAction(claim.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'ended') return;
    expect(resolved.state.phase.result.type).toBe('ron');
    expect(resolved.state.players[0].melds[0].type).toBe('triplet');
    expect(resolved.state.wall.doraIndicators).toHaveLength(1);
  });

  it('allows multiple Chankan winners against the would-be Kan declarer', () => {
    const started = begin(shouminkanState([1, 2]));
    const first = applyAction(started, { type: 'ron', player: 1 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = applyAction(first.state, { type: 'ron', player: 2 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const resolved = applyAction(second.state, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok || resolved.state.phase.kind !== 'ended') return;
    const end = resolved.state.phase.result;
    expect(end.type).toBe('ron');
    if (end.type !== 'ron') return;
    expect(end.winners.map((winner) => winner.player)).toEqual([1, 2]);
    expect(resolved.state.players[0].melds[0].type).toBe('triplet');
  });

  it('completes the quad, cancels Ippatsu and draws Rinshan when nobody robs it', () => {
    const started = begin(shouminkanState([]));
    const resolved = applyAction(started, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[0].melds[0]).toMatchObject({ type: 'quad', isOpen: true });
    expect(resolved.state.players.every((p) => p.ippatsuEligible === false)).toBe(true);
    expect(resolved.state.phase).toMatchObject({
      kind: 'awaiting-discard',
      player: 0,
      isRinshan: true,
      pendingKanDora: false,
    });
    expect(resolved.state.wall.doraIndicators).toHaveLength(2);
  });

  it('sets temporary Furiten when a structural Chankan opportunity is passed', () => {
    const started = begin(shouminkanState([2]));
    expect(getLegalActions(started, 2).some((action) => action.type === 'ron')).toBe(true);
    const resolved = applyAction(started, { type: 'resolve-reactions' });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players[2].temporaryFuriten).toBe(true);
  });
});
