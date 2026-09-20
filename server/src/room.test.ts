import { describe, expect, it } from 'vitest';
import { AuthoritativeRoom } from './room';
import type { RoomTiming } from './room';
import { RoomManager } from './roomManager';
import type { SeatAuth } from './protocol';

function fillLobby(room: AuthoritativeRoom): SeatAuth[] {
  const clients: SeatAuth[] = [];
  for (let seat = 0; seat < 4; seat++) {
    const joined = room.join(`c${seat}`, `Player ${seat}`, seat as 0 | 1 | 2 | 3);
    expect(joined).toMatchObject({ ok: true, seat });
    if (!joined.ok) throw new Error('join failed');
    clients.push({ clientId: `c${seat}`, token: joined.token });
  }
  return clients;
}

function readyAll(room: AuthoritativeRoom, clients: readonly SeatAuth[]): void {
  for (let seat = 0; seat < 4; seat++) {
    const receipt = room.submit(clients[seat], {
      commandId: `ready-${seat}`,
      expectedVersion: room.publicVersion,
      command: { type: 'set-ready', ready: true },
    });
    expect(receipt.ok).toBe(true);
  }
}

function startedRoom(
  seed = 123,
  timing: Partial<RoomTiming> = {},
): { room: AuthoritativeRoom; clients: SeatAuth[] } {
  const room = new AuthoritativeRoom(`room-${seed}`, seed, timing);
  const clients = fillLobby(room);
  readyAll(room, clients);
  const start = room.submit(clients[0], {
    commandId: 'start',
    expectedVersion: room.publicVersion,
    command: { type: 'start-round' },
  });
  expect(start.ok).toBe(true);
  return { room, clients };
}

/** The room auto-draws, exactly as `driveSingleGame` does, so a seat's turn starts on a discard. */
function firstDiscardTileId(room: AuthoritativeRoom, auth: SeatAuth): number {
  const legal = room.viewFor(auth).round!.legalActions;
  const discard = legal.find((action) => action.type === 'discard');
  expect(discard?.type).toBe('discard');
  if (discard?.type !== 'discard') throw new Error('no discard offered');
  return discard.tileIds[0];
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
      command: { type: 'start-round' },
    });
    expect(early).toMatchObject({ ok: false, code: 'NOT_READY' });

    readyAll(room, clients);
    const notHost = room.submit(clients[1], {
      commandId: 'not-host',
      expectedVersion: room.publicVersion,
      command: { type: 'start-round' },
    });
    expect(notHost).toMatchObject({ ok: false, code: 'HOST_ONLY' });

    const start = room.submit(clients[0], {
      commandId: 'start',
      expectedVersion: room.publicVersion,
      command: { type: 'start-round' },
    });
    expect(start.ok).toBe(true);
    expect(room.roomStatus).toBe('playing');
    // The dealer's draw is forced, so the first hand opens on a discard decision.
    expect(room.viewFor(clients[0]).round?.phase).toMatchObject({
      kind: 'awaiting-discard',
      player: 0,
    });
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
    const tileId = firstDiscardTileId(room, clients[0]);
    const discard = room.submit(clients[0], {
      commandId: 'discard',
      expectedVersion: version,
      command: { type: 'round-action', action: { type: 'discard', player: 0, tileId } },
    });
    expect(discard.ok).toBe(true);
    const stale = room.submit(clients[0], {
      commandId: 'stale',
      expectedVersion: version,
      command: { type: 'round-action', action: { type: 'discard', player: 0, tileId } },
    });
    expect(stale).toMatchObject({ ok: false, code: 'STALE_VERSION' });
  });

  it('returns a cached receipt for a duplicate command without applying it twice', () => {
    const { room, clients } = startedRoom(103);
    const tileId = firstDiscardTileId(room, clients[0]);
    const envelope = {
      commandId: 'discard-once',
      expectedVersion: room.publicVersion,
      command: {
        type: 'round-action' as const,
        action: { type: 'discard' as const, player: 0 as const, tileId },
      },
    };
    const first = room.submit(clients[0], envelope);
    expect(first).toMatchObject({ ok: true, duplicate: false });
    const afterFirst = room.publicVersion;
    const second = room.submit(clients[0], envelope);
    expect(second).toMatchObject({ ok: true, duplicate: true, version: afterFirst });
    expect(room.publicVersion).toBe(afterFirst);
    expect(room.viewFor(clients[0]).round?.players[0].discards).toHaveLength(1);
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
    // Codes are held uppercase so a player typing one in either case still lands.
    expect(alpha.id).toBe('ALPHA');
    expect(manager.get('alpha')).toBe(alpha);
    expect(manager.get('ALPHA')).toBe(alpha);
    expect(manager.list()).toEqual(['ALPHA']);
    expect(() => manager.create('ALPHA')).toThrow();
    expect(manager.remove('alpha')).toBe(true);
    expect(manager.get('alpha')).toBeNull();

    const restored = AuthoritativeRoom.restore(new AuthoritativeRoom('beta').checkpoint());
    manager.restore(restored);
    expect(manager.get('beta')).toBe(restored);
  });
});

describe('join tokens', () => {
  /** The whole threat model in one object: the right name, no proof it belongs to the bearer. */
  const impostorOf = (auth: SeatAuth): SeatAuth => ({
    clientId: auth.clientId,
    token: 'stolen-clientid-no-token',
  });

  it('issues a distinct, high-entropy token per seat', () => {
    const room = new AuthoritativeRoom('tokens');
    const clients = fillLobby(room);
    const tokens = clients.map((client) => client.token);
    expect(new Set(tokens).size).toBe(4);
    // 24 CSPRNG bytes in base64url. The length assertion is what fails if someone quietly
    // swaps the source for a counter or `Math.random`.
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('will not let a stolen clientId read a seat concealed hand or act for it', () => {
    const { room, clients } = startedRoom(201);
    const impostor = impostorOf(clients[0]);
    const tileId = firstDiscardTileId(room, clients[0]);
    const version = room.publicVersion;

    // The seat itself sees its hand.
    const owner = room.viewFor(clients[0]);
    expect(owner.viewerSeat).toBe(0);
    expect(owner.round!.players[0].concealed).not.toBeNull();
    expect(owner.round!.legalActions.length).toBeGreaterThan(0);

    // The impostor gets the spectator projection instead: no hand, no private state, no actions.
    const stolen = room.viewFor(impostor);
    expect(stolen.viewerSeat).toBeNull();
    expect(stolen.round!.players[0].concealed).toBeNull();
    expect(stolen.round!.players[0].privateState).toBeUndefined();
    expect(stolen.round!.legalActions).toEqual([]);
    expect(stolen).toEqual(room.viewFor(null));

    // And it cannot move the board.
    expect(
      room.submit(impostor, {
        commandId: 'stolen-discard',
        expectedVersion: version,
        command: { type: 'round-action', action: { type: 'discard', player: 0, tileId } },
      }),
    ).toMatchObject({ ok: false, code: 'INVALID_TOKEN' });
    expect(room.publicVersion).toBe(version);
    expect(room.viewFor(clients[0]).round!.players[0].discards).toHaveLength(0);
  });

  it('serves the spectator event tail to an unproven claim', () => {
    const { room, clients } = startedRoom(202);
    const impostor = impostorOf(clients[0]);

    // Only the drawing seat learns which tile left the wall, so the two tails differ.
    const owned = room.publicEventsSince(clients[0], 0);
    const stolen = room.publicEventsSince(impostor, 0);
    const spectator = room.publicEventsSince(null, 0);
    const drawn = (tail: typeof owned) =>
      tail.flatMap((entry) => entry.events).filter((event) => event.type === 'TileDrawn');

    expect(drawn(owned).some((event) => 'tile' in event)).toBe(true);
    expect(drawn(stolen).some((event) => 'tile' in event)).toBe(false);
    expect(stolen).toEqual(spectator);
  });

  it('keeps UNKNOWN_CLIENT meaning not seated, and INVALID_TOKEN meaning not proven', () => {
    const { room, clients } = startedRoom(203);
    const envelope = {
      commandId: 'probe',
      expectedVersion: room.publicVersion,
      command: { type: 'set-ready' as const, ready: true },
    };
    expect(room.submit({ clientId: 'nobody', token: 'whatever' }, envelope)).toMatchObject({
      ok: false,
      code: 'UNKNOWN_CLIENT',
    });
    expect(room.submit(impostorOf(clients[1]), envelope)).toMatchObject({
      ok: false,
      code: 'INVALID_TOKEN',
    });
  });

  it('requires the token to rejoin a seat, which is what makes reconnect safe', () => {
    const room = new AuthoritativeRoom('rejoin');
    const clients = fillLobby(room);
    expect(room.join(clients[2].clientId, 'Impersonator', 2)).toMatchObject({
      ok: false,
      code: 'INVALID_TOKEN',
    });
    expect(room.join(clients[2].clientId, 'Player 2', 2, 'wrong')).toMatchObject({
      ok: false,
      code: 'INVALID_TOKEN',
    });
    expect(room.join(clients[2].clientId, 'Player 2', 2, clients[2].token)).toMatchObject({
      ok: true,
      seat: 2,
      token: clients[2].token,
    });
  });

  it('ignores a presence report that cannot prove the seat', () => {
    const { room, clients } = startedRoom(204, { disconnectGraceMs: 1_000 });
    // Forging a disconnect is a takeover lever: it hands a present player to a bot.
    room.setConnected(impostorOf(clients[0]), false, 0);
    room.tick(10_000);
    expect(room.viewFor(null).seats[0].bot).toBeNull();

    // The seat's own report still works.
    room.setConnected(clients[0], false, 10_000);
    room.tick(11_000);
    expect(room.viewFor(null).seats[0].bot).toBe('standard');
  });
});

describe('room lifetime', () => {
  const TTL: Partial<RoomTiming> = {
    disconnectGraceMs: 500,
    emptyLobbyTtlMs: 1_000,
    playingRetentionMs: 2_000,
    finishedTtlMs: 3_000,
  };

  it('refuses a retention shorter than the disconnect grace, because that is the reconnect window', () => {
    expect(
      () =>
        new AuthoritativeRoom('BAD', 1, { disconnectGraceMs: 60_000, playingRetentionMs: 30_000 }),
    ).toThrow(/retention/i);
  });

  it('sweeps an empty lobby and keeps one that somebody is sitting in', () => {
    const manager = new RoomManager();
    manager.restore(new AuthoritativeRoom('EMPTY', 1, TTL));
    const busy = new AuthoritativeRoom('BUSY', 2, TTL);
    fillLobby(busy);
    manager.restore(busy);

    expect(manager.sweep(999)).toEqual([]);
    expect(manager.sweep(1_000)).toEqual(['EMPTY']);
    // Nobody reported a disconnect, so the occupied room is held indefinitely.
    expect(manager.sweep(10_000_000)).toEqual([]);
    expect(manager.get('BUSY')).toBe(busy);
  });

  it('retains a playing room past the bot takeover, then sweeps it at the retention', () => {
    const manager = new RoomManager();
    const { room, clients } = startedRoom(301, TTL);
    manager.restore(room);
    for (const client of clients) room.setConnected(client, false, 10_000);

    // The grace elapses and the seats go to bots -- the room must outlive that by a long way,
    // because the retention is the window a returning client reconnects into.
    room.tick(10_000 + TTL.disconnectGraceMs!);
    expect(room.viewFor(null).seats[0].bot).toBe('standard');
    expect(manager.sweep(10_000 + TTL.disconnectGraceMs!)).toEqual([]);
    expect(manager.sweep(10_000 + TTL.playingRetentionMs! - 1)).toEqual([]);
    expect(manager.sweep(10_000 + TTL.playingRetentionMs!)).toEqual(['ROOM-301']);
    expect(manager.get('room-301')).toBeNull();
  });

  it('sweeps a finished room once its TTL expires', () => {
    const manager = new RoomManager();
    const base = new AuthoritativeRoom('DONE', 3, TTL).checkpoint();
    manager.restore(AuthoritativeRoom.restore({ ...base, status: 'finished' }, TTL));

    expect(manager.sweep(2_999)).toEqual([]);
    expect(manager.sweep(3_000)).toEqual(['DONE']);
  });
});
