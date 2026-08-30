import { describe, expect, it } from 'vitest';
import { AuthoritativeRoom } from './room';
import { RoomManager } from './roomManager';

function fillLobby(room: AuthoritativeRoom): string[] {
  const clients = ['c0', 'c1', 'c2', 'c3'];
  for (let seat = 0; seat < 4; seat++) {
    expect(room.join(clients[seat], `Player ${seat}`, seat as 0 | 1 | 2 | 3)).toMatchObject({
      ok: true,
      seat,
    });
  }
  return clients;
}

function readyAll(room: AuthoritativeRoom, clients: readonly string[]): void {
  for (let seat = 0; seat < 4; seat++) {
    const receipt = room.submit(clients[seat], {
      commandId: `ready-${seat}`,
      expectedVersion: room.publicVersion,
      command: { type: 'set-ready', ready: true },
    });
    expect(receipt.ok).toBe(true);
  }
}

function startedRoom(seed = 123): { room: AuthoritativeRoom; clients: string[] } {
  const room = new AuthoritativeRoom(`room-${seed}`);
  const clients = fillLobby(room);
  readyAll(room, clients);
  const start = room.submit(clients[0], {
    commandId: 'start',
    expectedVersion: room.publicVersion,
    command: { type: 'start-round', seed },
  });
  expect(start.ok).toBe(true);
  return { room, clients };
}

describe('authoritative lobby', () => {
  it('assigns four seats, makes the first join host and rejects a fifth player', () => {
    const room = new AuthoritativeRoom('alpha');
    const clients = fillLobby(room);
    const view = room.viewFor(clients[2]);
    expect(view.seats.map((seat) => seat.occupied)).toEqual([true, true, true, true]);
    expect(view.seats[0].isHost).toBe(true);
    expect(view.seats.slice(1).every((seat) => !seat.isHost)).toBe(true);
    expect(room.join('c4', 'Overflow')).toMatchObject({ ok: false, code: 'ROOM_FULL' });
  });

  it('allows only the host to start and requires all four seats ready', () => {
    const room = new AuthoritativeRoom('beta');
    const clients = fillLobby(room);
    const early = room.submit(clients[0], {
      commandId: 'early',
      expectedVersion: room.publicVersion,
      command: { type: 'start-round', seed: 1 },
    });
    expect(early).toMatchObject({ ok: false, code: 'NOT_READY' });

    readyAll(room, clients);
    const notHost = room.submit(clients[1], {
      commandId: 'not-host',
      expectedVersion: room.publicVersion,
      command: { type: 'start-round', seed: 1 },
    });
    expect(notHost).toMatchObject({ ok: false, code: 'HOST_ONLY' });

    const start = room.submit(clients[0], {
      commandId: 'start',
      expectedVersion: room.publicVersion,
      command: { type: 'start-round', seed: 1 },
    });
    expect(start.ok).toBe(true);
    expect(room.roomStatus).toBe('playing');
    expect(room.viewFor(clients[0]).round).not.toBeNull();
  });

  it('starts deterministically from the same seed', () => {
    const first = startedRoom(77);
    const second = startedRoom(77);
    const a = first.room.viewFor(first.clients[0]).round!;
    const b = second.room.viewFor(second.clients[0]).round!;
    expect(a.players[0].concealed).toEqual(b.players[0].concealed);
    expect(a.wall.doraIndicators).toEqual(b.wall.doraIndicators);
  });
});

describe('authorization, versioning and idempotency', () => {
  it('rejects an action whose player field does not match the authenticated seat', () => {
    const { room, clients } = startedRoom(101);
    const result = room.submit(clients[1], {
      commandId: 'spoof-draw',
      expectedVersion: room.publicVersion,
      command: { type: 'round-action', action: { type: 'draw', player: 0 } },
    });
    expect(result).toMatchObject({ ok: false, code: 'WRONG_SEAT' });
  });

  it('rejects stale commands after a public transition', () => {
    const { room, clients } = startedRoom(102);
    const version = room.publicVersion;
    const draw = room.submit(clients[0], {
      commandId: 'draw',
      expectedVersion: version,
      command: { type: 'round-action', action: { type: 'draw', player: 0 } },
    });
    expect(draw.ok).toBe(true);
    const stale = room.submit(clients[0], {
      commandId: 'stale',
      expectedVersion: version,
      command: { type: 'round-action', action: { type: 'draw', player: 0 } },
    });
    expect(stale).toMatchObject({ ok: false, code: 'STALE_VERSION' });
  });

  it('returns a cached receipt for a duplicate command without applying it twice', () => {
    const { room, clients } = startedRoom(103);
    const version = room.publicVersion;
    const envelope = {
      commandId: 'draw-once',
      expectedVersion: version,
      command: { type: 'round-action' as const, action: { type: 'draw' as const, player: 0 as const } },
    };
    const first = room.submit(clients[0], envelope);
    expect(first).toMatchObject({ ok: true, duplicate: false });
    const afterFirst = room.publicVersion;
    const second = room.submit(clients[0], envelope);
    expect(second).toMatchObject({ ok: true, duplicate: true, version: afterFirst });
    expect(room.publicVersion).toBe(afterFirst);
    expect(room.viewFor(clients[0]).round?.players[0].concealedCount).toBe(14);
  });

  it('round-trips an authoritative checkpoint through JSON', () => {
    const { room, clients } = startedRoom(104);
    const serialized = JSON.parse(JSON.stringify(room.checkpoint()));
    const restored = AuthoritativeRoom.restore(serialized);
    expect(restored.publicVersion).toBe(room.publicVersion);
    expect(restored.viewFor(clients[0])).toEqual(room.viewFor(clients[0]));
  });
});

describe('room manager', () => {
  it('creates, lists, restores and removes rooms', () => {
    const manager = new RoomManager();
    const alpha = manager.create('alpha');
    expect(manager.get('alpha')).toBe(alpha);
    expect(manager.list()).toEqual(['alpha']);
    expect(() => manager.create('alpha')).toThrow();
    expect(manager.remove('alpha')).toBe(true);
    expect(manager.get('alpha')).toBeNull();

    const restored = AuthoritativeRoom.restore(new AuthoritativeRoom('beta').checkpoint());
    manager.restore(restored);
    expect(manager.get('beta')).toBe(restored);
  });
});
