import { describe, expect, it } from 'vitest';
import { suited } from '@mahjong-live/shared/tiles';
import type { Tile } from '@mahjong-live/shared/tile-types';
import type {
  PlayerIndex,
  RoundDiscard,
  RoundPlayerState,
  RoundState,
} from '@mahjong-live/shared/rules';
import { AuthoritativeRoom } from './room';
import type { RoomCheckpoint, RoomSeats } from './protocol';

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

function pinfuWait4p(startId: number): Tile[] {
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

function reactionState(playersOverride: Partial<Record<PlayerIndex, RoundPlayerState>>): RoundState {
  const winning = physical(suited('pin', 4), 9000);
  const discard: RoundDiscard = {
    tile: winning,
    tileId: winning.id!,
    tsumogiri: false,
    wasLastLiveDraw: false,
  };
  const players: RoundPlayerState[] = [
    player([], { discards: [discard], discardCount: 1 }),
    player(),
    player(),
    player(),
  ];
  for (const [seatText, replacement] of Object.entries(playersOverride)) {
    players[Number(seatText)] = replacement;
  }
  return {
    wall: {
      liveWall: [physical(suited('man', 9), 9100), physical(suited('sou', 9), 9101)],
      deadWall: [],
      doraIndicators: [],
    },
    players: [players[0], players[1], players[2], players[3]],
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

function roomFrom(round: RoundState, version = 10): AuthoritativeRoom {
  const seats: RoomSeats = [
    { clientId: 'c0', displayName: 'P0', ready: true },
    { clientId: 'c1', displayName: 'P1', ready: true },
    { clientId: 'c2', displayName: 'P2', ready: true },
    { clientId: 'c3', displayName: 'P3', ready: true },
  ];
  const checkpoint: RoomCheckpoint = {
    id: 'reaction-room',
    status: 'playing',
    version,
    hostClientId: 'c0',
    seats,
    seed: 1,
    round,
    reaction: null,
  };
  return AuthoritativeRoom.restore(checkpoint);
}

describe('reaction barrier', () => {
  it('collects two Ron claims at one public version and resolves only after both seats answered', () => {
    const room = roomFrom(reactionState({
      1: player(pinfuWait4p(100)),
      2: player(pinfuWait4p(200)),
    }));
    expect(room.viewFor('c1').round?.legalActions.map((action) => action.type)).toContain('ron');
    expect(room.viewFor('c2').round?.legalActions.map((action) => action.type)).toContain('ron');

    const first = room.submit('c1', {
      commandId: 'ron-1',
      expectedVersion: 10,
      command: { type: 'round-action', action: { type: 'ron', player: 1 } },
    });
    expect(first).toMatchObject({ ok: true, version: 10 });
    expect(room.publicVersion).toBe(10);
    expect(room.viewFor('c1').round?.legalActions).toEqual([]);
    expect(room.publicEventsSince(null, 10)).toEqual([]);

    const second = room.submit('c2', {
      commandId: 'ron-2',
      expectedVersion: 10,
      command: { type: 'round-action', action: { type: 'ron', player: 2 } },
    });
    expect(second).toMatchObject({ ok: true, version: 11 });
    expect(room.roomStatus).toBe('finished');
    const phase = room.viewFor(null).round?.phase;
    expect(phase?.kind).toBe('ended');
    if (!phase || phase.kind !== 'ended' || phase.result.type !== 'ron') return;
    expect(phase.result.winners.map((winner) => winner.player)).toEqual([1, 2]);
  });

  it('keeps a hidden claim idempotent without duplicating the engine claim', () => {
    const room = roomFrom(reactionState({
      1: player(pinfuWait4p(300)),
      2: player(pinfuWait4p(400)),
    }));
    const envelope = {
      commandId: 'same-ron',
      expectedVersion: 10,
      command: { type: 'round-action' as const, action: { type: 'ron' as const, player: 1 as const } },
    };
    const first = room.submit('c1', envelope);
    expect(first).toMatchObject({ ok: true, duplicate: false, version: 10 });
    const second = room.submit('c1', envelope);
    expect(second).toMatchObject({ ok: true, duplicate: true, version: 10 });
    const checkpoint = room.checkpoint();
    expect(checkpoint.round?.phase.kind).toBe('reactions');
    if (checkpoint.round?.phase.kind !== 'reactions') return;
    expect(checkpoint.round.phase.ronClaims).toHaveLength(1);
  });

  it('resolves Ron over a competing Pon without exposing the Pon as a public transition', () => {
    const p4a = physical(suited('pin', 4), 500);
    const p4b = physical(suited('pin', 4), 501);
    const room = roomFrom(reactionState({
      1: player(pinfuWait4p(5000)),
      2: player([p4a, p4b]),
    }));
    const pon = room.submit('c2', {
      commandId: 'pon',
      expectedVersion: 10,
      command: { type: 'round-action', action: { type: 'pon', player: 2, tileIds: [p4a.id!, p4b.id!] } },
    });
    expect(pon).toMatchObject({ ok: true, version: 10 });

    const ron = room.submit('c1', {
      commandId: 'ron',
      expectedVersion: 10,
      command: { type: 'round-action', action: { type: 'ron', player: 1 } },
    });
    expect(ron).toMatchObject({ ok: true, version: 11 });
    const view = room.viewFor(null);
    expect(view.round?.phase.kind).toBe('ended');
    expect(view.round?.players[2].melds).toHaveLength(0);
  });

  it('resolves Pon over Chi when both players respond in either order', () => {
    const chi3 = physical(suited('pin', 3), 600);
    const chi5 = physical(suited('pin', 5), 601);
    const ponA = physical(suited('pin', 4), 602);
    const ponB = physical(suited('pin', 4), 603);
    const room = roomFrom(reactionState({
      1: player([chi3, chi5]),
      2: player([ponA, ponB]),
    }));

    const chi = room.submit('c1', {
      commandId: 'chi',
      expectedVersion: 10,
      command: { type: 'round-action', action: { type: 'chi', player: 1, tileIds: [chi3.id!, chi5.id!] } },
    });
    expect(chi).toMatchObject({ ok: true, version: 10 });
    expect(room.viewFor('c1').round?.legalActions).toEqual([]);

    const pon = room.submit('c2', {
      commandId: 'pon',
      expectedVersion: 10,
      command: { type: 'round-action', action: { type: 'pon', player: 2, tileIds: [ponA.id!, ponB.id!] } },
    });
    expect(pon).toMatchObject({ ok: true, version: 11 });
    const phase = room.viewFor(null).round?.phase;
    expect(phase).toMatchObject({ kind: 'awaiting-discard', player: 2 });
    expect(room.viewFor(null).round?.players[2].melds[0]).toMatchObject({ type: 'triplet', isOpen: true });
    expect(room.viewFor(null).round?.players[1].melds).toHaveLength(0);
  });

  it('turns an all-pass window into one authoritative resolution and rejects a late stale response', () => {
    const chi3 = physical(suited('pin', 3), 700);
    const chi5 = physical(suited('pin', 5), 701);
    const room = roomFrom(reactionState({ 1: player([chi3, chi5]) }));
    expect(room.viewFor('c1').round?.legalActions.map((action) => action.type)).toContain('chi');

    const pass = room.submit('c1', {
      commandId: 'pass',
      expectedVersion: 10,
      command: { type: 'pass' },
    });
    expect(pass).toMatchObject({ ok: true, version: 11 });
    expect(room.viewFor(null).round?.phase).toEqual({ kind: 'awaiting-draw', player: 1 });

    const late = room.submit('c1', {
      commandId: 'late-pass',
      expectedVersion: 10,
      command: { type: 'pass' },
    });
    expect(late).toMatchObject({ ok: false, code: 'STALE_VERSION', version: 11 });
  });
});
