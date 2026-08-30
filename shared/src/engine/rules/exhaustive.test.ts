import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction } from './round';
import type { PlayerIndex, RoundDiscard, RoundPlayerState, RoundState } from './types';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

function player(concealed: readonly Tile[] = []): RoundPlayerState {
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
  };
}

function tenpai(startId: number): Tile[] {
  let id = startId;
  const t = (tile: Tile) => physical(tile, id++);
  return [
    t(suited('man', 1)), t(suited('man', 2)), t(suited('man', 3)),
    t(suited('man', 4)), t(suited('man', 5)), t(suited('man', 6)),
    t(suited('pin', 7)), t(suited('pin', 8)), t(suited('pin', 9)),
    t(suited('sou', 2)), t(suited('sou', 3)),
    t(suited('pin', 5)), t(suited('pin', 5)),
  ];
}

function lastDiscardState(tenpaiSeats: readonly PlayerIndex[]): RoundState {
  // A simple tile deliberately prevents this Plan 6 fixture from qualifying for Nagashi Mangan.
  const discardTile = physical(suited('sou', 5), 9000);
  const discard: RoundDiscard = {
    tile: discardTile,
    tileId: discardTile.id!,
    tsumogiri: true,
    wasLastLiveDraw: true,
  };
  const players: RoundState['players'] = [player(), player(), player(), player()];
  const mutable = [...players] as RoundPlayerState[];
  for (const seat of tenpaiSeats) mutable[seat] = player(tenpai(1000 + seat * 100));
  mutable[0] = { ...mutable[0], discards: [discard], discardCount: 1 };
  return {
    wall: { liveWall: [], deadWall: [], doraIndicators: [] },
    players: [mutable[0], mutable[1], mutable[2], mutable[3]],
    dealer: 0,
    roundWind: 'east',
    honba: 0,
    riichiSticks: 2,
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

function resolve(seats: readonly PlayerIndex[]) {
  const result = applyAction(lastDiscardState(seats), { type: 'resolve-reactions' });
  expect(result.ok).toBe(true);
  if (!result.ok || result.state.phase.kind !== 'ended') throw new Error('expected ended round');
  expect(result.state.phase.result.type).toBe('exhaustive-draw');
  if (result.state.phase.result.type !== 'exhaustive-draw') throw new Error('expected exhaustive draw');
  return result;
}

describe('exhaustive draw tenpai/noten settlement', () => {
  it('transfers 3000 to one tenpai player and 1000 from each noten player', () => {
    const result = resolve([1]);
    expect(result.state.phase.kind).toBe('ended');
    if (result.state.phase.kind !== 'ended' || result.state.phase.result.type !== 'exhaustive-draw') return;
    expect(result.state.phase.result.tenpaiPlayers).toEqual([1]);
    expect(result.state.phase.result.notenPayments).toEqual([-1000, 3000, -1000, -1000]);
    expect(result.state.players.map((p) => p.points)).toEqual([24000, 28000, 24000, 24000]);
    expect(result.state.riichiSticks).toBe(2);
  });

  it('splits the pool 1500/1500 for two tenpai players', () => {
    const result = resolve([1, 2]);
    if (result.state.phase.kind !== 'ended' || result.state.phase.result.type !== 'exhaustive-draw') return;
    expect(result.state.phase.result.notenPayments).toEqual([-1500, 1500, 1500, -1500]);
  });

  it('pays 1000 to each of three tenpai players from the sole noten player', () => {
    const result = resolve([1, 2, 3]);
    if (result.state.phase.kind !== 'ended' || result.state.phase.result.type !== 'exhaustive-draw') return;
    expect(result.state.phase.result.notenPayments).toEqual([-3000, 1000, 1000, 1000]);
  });

  it('moves no points when nobody or everybody is tenpai', () => {
    const none = resolve([]);
    if (none.state.phase.kind !== 'ended' || none.state.phase.result.type !== 'exhaustive-draw') return;
    expect(none.state.phase.result.notenPayments).toEqual([0, 0, 0, 0]);

    const all = resolve([0, 1, 2, 3]);
    if (all.state.phase.kind !== 'ended' || all.state.phase.result.type !== 'exhaustive-draw') return;
    expect(all.state.phase.result.notenPayments).toEqual([0, 0, 0, 0]);
  });
});
