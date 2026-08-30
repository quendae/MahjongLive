import { describe, expect, it } from 'vitest';
import { suited, wind } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction } from './round';
import type { PlayerIndex, PlayerMeld, RoundDiscard, RoundPlayerState, RoundState } from './types';

function physical(tile: Tile, id: number): Tile {
  return { ...tile, id };
}

function discard(tile: Tile, calledBy?: PlayerIndex): RoundDiscard {
  return {
    tile,
    tileId: tile.id!,
    tsumogiri: false,
    wasLastLiveDraw: false,
    ...(calledBy === undefined ? {} : { calledBy }),
  };
}

function player(overrides: Partial<RoundPlayerState> = {}): RoundPlayerState {
  return {
    points: 25_000,
    concealed: [],
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

function stateFor(
  qualifierSeats: readonly PlayerIndex[],
  options: { calledQualifierDiscard?: PlayerIndex; openQualifier?: PlayerIndex; honba?: number } = {},
): RoundState {
  let id = 1000;
  const players: RoundPlayerState[] = [player(), player(), player(), player()];

  for (const seat of qualifierSeats) {
    const first = discard(physical(suited('man', 1), id++));
    const second = discard(
      physical(wind('east'), id++),
      options.calledQualifierDiscard === seat ? (((seat + 1) % 4) as PlayerIndex) : undefined,
    );
    const melds: PlayerMeld[] = [];
    if (options.openQualifier === seat) {
      melds.push({
        type: 'sequence',
        tiles: [
          physical(suited('pin', 2), id++),
          physical(suited('pin', 3), id++),
          physical(suited('pin', 4), id++),
        ],
        isOpen: true,
        calledFrom: (((seat + 3) % 4) as PlayerIndex),
      });
    }
    players[seat] = player({ discards: [first, second], discardCount: 2, melds });
  }

  // Seat 3 supplies the final ordinary discard unless already used as a Nagashi qualifier.
  const finalTile = physical(suited('sou', qualifierSeats.includes(3) ? 9 : 5), id++);
  const finalRecord: RoundDiscard = {
    tile: finalTile,
    tileId: finalTile.id!,
    tsumogiri: true,
    wasLastLiveDraw: true,
  };
  const finalDiscards = [...players[3].discards, finalRecord];
  players[3] = {
    ...players[3],
    discards: finalDiscards,
    discardCount: finalDiscards.length,
  };

  return {
    wall: { liveWall: [], deadWall: [], doraIndicators: [] },
    players: [players[0], players[1], players[2], players[3]],
    dealer: 0,
    roundWind: 'east',
    honba: options.honba ?? 0,
    riichiSticks: 2,
    currentPlayer: 3,
    callsMade: 0,
    phase: {
      kind: 'reactions',
      discarder: 3,
      discardIndex: finalDiscards.length - 1,
      ronClaims: [],
      callClaims: [],
    },
  };
}

function resolve(state: RoundState) {
  const result = applyAction(state, { type: 'resolve-reactions' });
  expect(result.ok).toBe(true);
  if (!result.ok || result.state.phase.kind !== 'ended') throw new Error('expected ended round');
  const end = result.state.phase.result;
  expect(end.type).toBe('exhaustive-draw');
  if (end.type !== 'exhaustive-draw') throw new Error('expected exhaustive draw');
  return { state: result.state, end };
}

describe('Nagashi Mangan exhaustive settlement', () => {
  it('pays dealer Mangan Tsumo, suppresses noten payments and keeps Riichi sticks', () => {
    const { state, end } = resolve(stateFor([0], { honba: 3 }));
    expect(end.nagashiPlayers).toEqual([0]);
    expect(end.nagashiPayments).toEqual([12000, -4000, -4000, -4000]);
    expect(end.notenPayments).toEqual([0, 0, 0, 0]);
    expect(state.players.map((p) => p.points)).toEqual([37000, 21000, 21000, 21000]);
    expect(state.riichiSticks).toBe(2);
  });

  it('pays a nondealer 4000 from dealer and 2000 from each other nondealer', () => {
    const { end } = resolve(stateFor([1]));
    expect(end.nagashiPlayers).toEqual([1]);
    expect(end.nagashiPayments).toEqual([-4000, 8000, -2000, -2000]);
  });

  it('applies multiple Nagashi qualifiers independently', () => {
    const { end } = resolve(stateFor([0, 1]));
    expect(end.nagashiPlayers).toEqual([0, 1]);
    expect(end.nagashiPayments).toEqual([8000, 4000, -6000, -6000]);
    expect(end.notenPayments).toEqual([0, 0, 0, 0]);
  });

  it('allows a qualifier to have called opponents tiles', () => {
    const { end } = resolve(stateFor([1], { openQualifier: 1 }));
    expect(end.nagashiPlayers).toEqual([1]);
  });

  it('disqualifies a player when any own terminal/honor discard was called', () => {
    const { end } = resolve(stateFor([1], { calledQualifierDiscard: 1 }));
    expect(end.nagashiPlayers).toBeUndefined();
    expect(end.nagashiPayments).toBeUndefined();
    expect(end.notenPayments).toEqual([0, 0, 0, 0]);
  });
});
