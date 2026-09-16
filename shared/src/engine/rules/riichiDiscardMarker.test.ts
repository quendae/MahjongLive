import { describe, expect, it } from 'vitest';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import { applyAction } from './round';
import type { RoundPlayerState, RoundState } from './types';

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
    drawCount: 0,
    discardCount: 0,
  };
}

function riichiReady(startId = 0): { tiles: Tile[]; extra: Tile } {
  let id = startId;
  const t = (tile: Tile) => physical(tile, id++);
  const extra = t(suited('sou', 9));
  return {
    extra,
    tiles: [
      t(suited('man', 1)), t(suited('man', 2)), t(suited('man', 3)),
      t(suited('man', 4)), t(suited('man', 5)), t(suited('man', 6)),
      t(suited('pin', 7)), t(suited('pin', 8)), t(suited('pin', 9)),
      t(suited('sou', 2)), t(suited('sou', 3)),
      t(suited('pin', 5)), t(suited('pin', 5)),
      extra,
    ],
  };
}

function stateFor(tiles: readonly Tile[], drawnTileId: number): RoundState {
  return {
    wall: {
      liveWall: [
        physical(suited('man', 9), 9000),
        physical(suited('pin', 9), 9001),
        physical(suited('sou', 8), 9002),
        physical(suited('man', 8), 9003),
      ],
      deadWall: [],
      doraIndicators: [],
    },
    players: [player(tiles), player(), player(), player()],
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
  };
}

describe('Riichi declaration discard marker', () => {
  it('persists the declaration fact on the physical discard before Riichi resolution', () => {
    const ready = riichiReady(10);
    const result = applyAction(stateFor(ready.tiles, ready.extra.id!), {
      type: 'riichi-discard',
      player: 0,
      tileId: ready.extra.id!,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.state.phase.kind !== 'reactions') return;
    expect(result.state.players[0].discards.at(-1)).toMatchObject({
      tileId: ready.extra.id,
      riichiDeclaration: true,
    });
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'TileDiscarded',
      discard: expect.objectContaining({ riichiDeclaration: true }),
    }));
  });

  it('does not mark an ordinary discard as a Riichi declaration', () => {
    const ready = riichiReady(100);
    const result = applyAction(stateFor(ready.tiles, ready.extra.id!), {
      type: 'discard',
      player: 0,
      tileId: ready.extra.id!,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0].discards.at(-1)).not.toHaveProperty('riichiDeclaration');
  });
});
