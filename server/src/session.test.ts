import { describe, expect, it } from 'vitest';
import { chooseBotDecisionForDifficulty } from '@mahjong-live/shared/bot';
import { isReactionPhase } from '@mahjong-live/shared/match';
import type { PlayerIndex, RoundAction } from '@mahjong-live/shared/rules';
import { AuthoritativeRoom } from './room';
import {
  CLOSE_EVICTED,
  CLOSE_FAULTED,
  CLOSE_NO_SUCH_ROOM,
  CLOSE_UNAUTHORIZED,
  RoomHub,
} from './session';
import type { Connection, ServerFrame, TransportSocket } from './session';
import type { ClientCommand, PlayerRoundAction, SeatAuth } from './protocol';

const SEATS: readonly PlayerIndex[] = [0, 1, 2, 3];

class FakeSocket implements TransportSocket {
  readonly sent: ServerFrame[] = [];
  closed: { code?: number; reason?: string } | null = null;
  bufferedAmount = 0;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ServerFrame);
  }

  close(code?: number, reason?: string): void {
    this.closed ??= { code, reason };
  }
}

interface Client {
  socket: FakeSocket;
  connection: Connection;
  auth: SeatAuth | null;
}

function playerAction(action: RoundAction): PlayerRoundAction {
  if (action.type === 'resolve-reactions') throw new Error('bot returned a server-only action');
  return action;
}

/** Collects every physical tile id reachable in a value, exactly as the projection sweep does. */
function collectPhysicalIds(value: unknown, ids = new Set<number>()): Set<number> {
  if (Array.isArray(value)) {
    for (const item of value) collectPhysicalIds(item, ids);
    return ids;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'id' && typeof nested === 'number') ids.add(nested);
      else collectPhysicalIds(nested, ids);
    }
  }
  return ids;
}

function connect(
  hub: RoomHub,
  roomId: string,
  auth: SeatAuth | null,
  now: number,
  afterVersion?: number,
): Client {
  const socket = new FakeSocket();
  const connection = hub.open(socket);
  hub.receive(
    connection,
    JSON.stringify({ type: 'auth', roomId, ...auth, afterVersion }),
    now,
  );
  return { socket, connection, auth };
}

/** Seats four clients over HTTP-equivalent joins, then attaches a socket per client. */
function seatFour(hub: RoomHub, seed: number, now = 1_000) {
  const room = hub.manager.allocate(seed);
  const clients: Client[] = [];
  for (const seat of SEATS) {
    const joined = room.join(`c${seat}`, `Player ${seat}`, seat);
    if (!joined.ok) throw new Error(`seat ${seat} could not join`);
    clients[seat] = connect(hub, room.id, { clientId: `c${seat}`, token: joined.token }, now);
  }
  return { room, clients };
}

function command(hub: RoomHub, client: Client, commandId: string, cmd: ClientCommand, now: number) {
  const room = hub.manager.get(client.connection.roomId!)!;
  hub.receive(
    client.connection,
    JSON.stringify({
      type: 'command',
      envelope: { commandId, expectedVersion: room.publicVersion, command: cmd },
    }),
    now,
  );
  const receipt = [...client.socket.sent].reverse().find((frame) => frame.type === 'receipt');
  if (!receipt || receipt.type !== 'receipt') throw new Error(`no receipt for ${commandId}`);
  return receipt.receipt;
}

function startMatch(hub: RoomHub, clients: Client[], now: number): void {
  for (const seat of SEATS) {
    const receipt = command(hub, clients[seat]!, `ready-${seat}`, { type: 'set-ready', ready: true }, now);
    expect(receipt.ok).toBe(true);
  }
  expect(command(hub, clients[0]!, 'start', { type: 'start-round' }, now).ok).toBe(true);
}

describe('socket authentication', () => {
  it('serves a seated client its own seat, proven by the room and not by the socket', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 7);

    for (const seat of SEATS) {
      const welcome = clients[seat]!.socket.sent[0];
      expect(welcome?.type).toBe('welcome');
      if (welcome?.type !== 'welcome') return;
      expect(welcome.seat).toBe(seat);
      expect(welcome.view.viewerSeat).toBe(seat);
      expect(welcome.view.id).toBe(room.id);
    }
  });

  it('rejects a socket that claims a seat with the wrong token', () => {
    const hub = new RoomHub();
    const room = hub.manager.allocate(7);
    const joined = room.join('c0', 'Zero', 0);
    expect(joined.ok).toBe(true);

    const client = connect(hub, room.id, { clientId: 'c0', token: 'not-the-token' }, 1_000);
    expect(client.socket.closed?.code).toBe(CLOSE_UNAUTHORIZED);
    expect(client.socket.sent[0]).toMatchObject({ type: 'error', code: 'INVALID_TOKEN' });
    expect(hub.connectionsIn(room.id)).toHaveLength(0);
  });

  it('rejects a socket for a room that does not exist', () => {
    const hub = new RoomHub();
    const client = connect(hub, 'ZZZZZZ', null, 1_000);
    expect(client.socket.closed?.code).toBe(CLOSE_NO_SUCH_ROOM);
    expect(client.socket.sent[0]).toMatchObject({ type: 'error', code: 'NO_SUCH_ROOM' });
  });

  it('treats a seatless socket as a spectator and refuses its commands', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 7);
    const spectator = connect(hub, room.id, null, 1_000);

    const welcome = spectator.socket.sent[0];
    expect(welcome?.type).toBe('welcome');
    if (welcome?.type !== 'welcome') return;
    expect(welcome.seat).toBeNull();
    expect(welcome.view.viewerSeat).toBeNull();

    startMatch(hub, clients, 1_000);
    hub.receive(
      spectator.connection,
      JSON.stringify({
        type: 'command',
        envelope: { commandId: 'x', expectedVersion: room.publicVersion, command: { type: 'pass' } },
      }),
      1_000,
    );
    expect(spectator.socket.sent.at(-1)).toMatchObject({
      type: 'error',
      code: 'SPECTATOR_READ_ONLY',
    });
    expect(spectator.socket.closed).toBeNull();
  });

  it('refuses a command before the socket has authenticated', () => {
    const hub = new RoomHub();
    const socket = new FakeSocket();
    const connection = hub.open(socket);
    hub.receive(connection, JSON.stringify({ type: 'command', envelope: {} }), 1_000);
    expect(socket.sent[0]).toMatchObject({ type: 'error', code: 'NOT_AUTHENTICATED' });
    expect(socket.closed).not.toBeNull();
  });
});

describe('per-viewer fan-out', () => {
  /**
   * The sweep the room-level tests cannot do: they call `projectRoom` directly, so a fan-out that
   * builds one payload and posts it to four sockets passes every one of them. This walks the
   * actual outbound byte stream of four connected clients.
   */
  it('never puts another seat\'s concealed tile or a wall tile on a client\'s wire', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 20260920);
    const spectator = connect(hub, room.id, null, 1_000);
    startMatch(hub, clients, 1_000);

    const watched = [...clients, spectator];
    const readSince = watched.map((client) => client.socket.sent.length);

    const audit = () => {
      const round = room.matchState?.round;
      if (!round) return;
      const publicDoraIds = new Set(round.wall.doraIndicators.map((tile) => tile.id));
      watched.forEach((client, index) => {
        const fresh = client.socket.sent.slice(readSince[index]!);
        readSince[index] = client.socket.sent.length;
        if (fresh.length === 0) return;
        const exposed = collectPhysicalIds(fresh);
        const viewer = client.connection.seat;
        for (const seat of SEATS) {
          if (seat === viewer) continue;
          for (const tile of round.players[seat].concealed) {
            expect(exposed.has(tile.id!)).toBe(false);
          }
        }
        for (const tile of round.wall.liveWall) expect(exposed.has(tile.id!)).toBe(false);
        for (const tile of round.wall.deadWall) {
          if (!publicDoraIds.has(tile.id)) expect(exposed.has(tile.id!)).toBe(false);
        }
      });
    };

    let handsPlayed = 0;
    for (let step = 0; step < 4_000 && handsPlayed < 2; step++) {
      if (room.roomStatus !== 'playing') break;
      const match = room.matchState!;
      const round = match.round;

      if (round.phase.kind === 'ended') {
        handsPlayed += 1;
        expect(command(hub, clients[0]!, `advance-${step}`, { type: 'advance-round' }, 1_000).ok).toBe(true);
        audit();
        continue;
      }

      if (isReactionPhase(round)) {
        for (const seat of SEATS) {
          const current = room.matchState!.round;
          if (!isReactionPhase(current)) break;
          if (room.viewFor(clients[seat]!.auth).round!.legalActions.length === 0) continue;
          const decision = chooseBotDecisionForDifficulty(current, seat, 'standard');
          command(
            hub,
            clients[seat]!,
            `react-${step}-${seat}`,
            decision.type === 'pass'
              ? { type: 'pass' }
              : { type: 'round-action', action: playerAction(decision.action) },
            1_000,
          );
        }
        audit();
        continue;
      }

      const phase = round.phase;
      if (phase.kind !== 'awaiting-draw' && phase.kind !== 'awaiting-discard') {
        throw new Error(`unexpected phase ${phase.kind}`);
      }
      const seat = phase.player;
      const decision = chooseBotDecisionForDifficulty(round, seat, 'standard');
      if (decision.type === 'pass') throw new Error(`bot policy passed on seat ${seat}'s turn`);
      expect(
        command(
          hub,
          clients[seat]!,
          `turn-${step}-${seat}`,
          { type: 'round-action', action: playerAction(decision.action) },
          1_000,
        ).ok,
      ).toBe(true);
      audit();
    }

    // The sweep is worthless if nothing was ever sent, so prove the stream was real.
    expect(handsPlayed).toBeGreaterThanOrEqual(1);
    for (const client of watched) {
      expect(client.socket.sent.filter((frame) => frame.type === 'update').length).toBeGreaterThan(20);
    }
    // And prove each seat did receive its own hand, so the sweep is not passing on an empty view.
    for (const seat of SEATS) {
      const updates = clients[seat]!.socket.sent.filter((frame) => frame.type === 'update');
      const own = updates.some(
        (frame) => frame.type === 'update' && frame.view.round?.players[seat].concealed !== null,
      );
      expect(own).toBe(true);
    }
    const spectatorUpdates = spectator.socket.sent.filter((frame) => frame.type === 'update');
    for (const frame of spectatorUpdates) {
      if (frame.type !== 'update' || !frame.view.round) continue;
      expect(frame.view.round.players.every((player) => player.concealed === null)).toBe(true);
    }
  });
});

describe('reconnect', () => {
  it('resumes snapshot-first and appends the catch-up tail from the resume point', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 99);
    startMatch(hub, clients, 1_000);

    const resumeFrom = room.publicVersion;
    hub.close(clients[1]!.connection, 1_100);

    // Play on while seat 1 is away.
    for (let step = 0; step < 6 && room.matchState!.round.phase.kind !== 'ended'; step++) {
      const round = room.matchState!.round;
      if (isReactionPhase(round)) break;
      const phase = round.phase;
      if (phase.kind !== 'awaiting-draw' && phase.kind !== 'awaiting-discard') break;
      const seat = phase.player;
      if (seat === 1) break;
      const decision = chooseBotDecisionForDifficulty(round, seat, 'standard');
      if (decision.type === 'pass') break;
      command(hub, clients[seat]!, `t${step}`, { type: 'round-action', action: playerAction(decision.action) }, 1_100);
    }
    expect(room.publicVersion).toBeGreaterThan(resumeFrom);

    const back = connect(hub, room.id, clients[1]!.auth, 1_200, resumeFrom);
    const welcome = back.socket.sent[0];
    expect(welcome?.type).toBe('welcome');
    if (welcome?.type !== 'welcome') return;
    expect(welcome.seat).toBe(1);
    expect(welcome.trimmed).toBe(false);
    // The snapshot alone is renderable: seat 1 gets its own hand back in full.
    expect(welcome.view.version).toBe(room.publicVersion);
    expect(welcome.view.round!.players[1].concealed).not.toBeNull();
    // The tail starts exactly at the first version the client missed.
    expect(welcome.tail![0]!.version).toBe(resumeFrom + 1);
    expect(welcome.tail!.at(-1)!.version).toBe(room.publicVersion);
  });

  it('drops the tail rather than serving a hole when the log no longer reaches the resume point', () => {
    // A 1ms disconnect grace makes every tick trim the catch-up log to its last entry.
    const hub = new RoomHub();
    const room = new AuthoritativeRoom('TRIMME', 99, { disconnectGraceMs: 1 });
    hub.manager.restore(room);
    const clients: Client[] = [];
    for (const seat of SEATS) {
      const joined = room.join(`c${seat}`, `P${seat}`, seat);
      if (!joined.ok) throw new Error('join failed');
      clients[seat] = connect(hub, room.id, { clientId: `c${seat}`, token: joined.token }, 1_000);
    }
    startMatch(hub, clients, 1_000);
    const resumeFrom = 1;

    hub.close(clients[1]!.connection, 1_000);
    // One tick past the grace: the room trims its catch-up log and hands seat 1 to a bot, which
    // keeps playing. Both are exactly what a long absence looks like.
    hub.tick(2_000);
    expect(room.publicVersion).toBeGreaterThan(resumeFrom + 1);

    const back = connect(hub, room.id, clients[1]!.auth, 3_000, resumeFrom);
    const welcome = back.socket.sent[0];
    expect(welcome?.type).toBe('welcome');
    if (welcome?.type !== 'welcome') return;
    expect(welcome.trimmed).toBe(true);
    expect(welcome.tail).toBeNull();
    // Section 6: the snapshot is self-sufficient, so nothing is actually lost.
    expect(welcome.view.version).toBe(room.publicVersion);
    expect(welcome.view.round!.players[1].concealed).not.toBeNull();
  });

  it('reports presence to the room on open and close', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 99);
    startMatch(hub, clients, 1_000);
    // Everyone connected: nothing holds an eviction clock.
    expect(room.evictableAt()).toBeNull();

    for (const client of clients) hub.close(client.connection, 5_000);
    expect(room.evictableAt()).toBe(5_000 + room.timing.playingRetentionMs);

    connect(hub, room.id, clients[0]!.auth, 6_000);
    expect(room.evictableAt()).toBeNull();
  });
});

describe('room teardown', () => {
  it('tells every client and closes the sockets when a room faults', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 5);
    startMatch(hub, clients, 1_000);

    // `room.test.ts` owns fault *detection*; this owns fault *propagation*, so the fault is put
    // there directly rather than by corrupting engine state, which would only prove that a
    // broken `RoundState` breaks the projection too.
    (room as unknown as { faultReason: string | null; status: string }).faultReason =
      'injected invariant failure';
    (room as unknown as { faultReason: string | null; status: string }).status = 'faulted';

    const receipt = command(hub, clients[0]!, 'boom', { type: 'advance-round' }, 1_000);
    expect(receipt.ok).toBe(false);
    if (receipt.ok) return;
    expect(receipt.code).toBe('ROOM_FAULTED');

    for (const client of clients) {
      expect(client.socket.sent.at(-1)).toMatchObject({ type: 'closed', reason: 'faulted' });
      expect(client.socket.closed?.code).toBe(CLOSE_FAULTED);
    }
    // The dead room is released rather than left holding four sockets.
    expect(hub.manager.get(room.id)).toBeNull();
    expect(hub.connectionsIn(room.id)).toHaveLength(0);
  });

  it('drops the sockets of a room the sweep evicted', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 5);
    const roomId = room.id;
    for (const client of clients) hub.close(client.connection, 2_000);
    const spectator = connect(hub, roomId, null, 2_000);

    hub.tick(2_000 + room.timing.emptyLobbyTtlMs + 1);

    expect(hub.manager.get(roomId)).toBeNull();
    expect(spectator.socket.sent.at(-1)).toMatchObject({ type: 'closed', reason: 'evicted' });
    expect(spectator.socket.closed?.code).toBe(CLOSE_EVICTED);
  });
});

describe('the clock', () => {
  it('drives the room deadline, which the room cannot do for itself', () => {
    const hub = new RoomHub();
    const { room, clients } = seatFour(hub, 11, 1_000);
    startMatch(hub, clients, 1_000);

    hub.tick(1_000);
    const deadline = room.currentDeadline;
    expect(deadline).not.toBeNull();
    expect(deadline!.kind).toBe('turn');

    const before = room.publicVersion;
    hub.tick(deadline!.expiresAt + 1);
    // An expiry is applied through the same path as any command, so it bumps the version.
    expect(room.publicVersion).toBeGreaterThan(before);
    for (const client of clients) {
      expect(client.socket.sent.at(-1)?.type).toBe('update');
    }
  });

  it('does not resend an unchanged board on every tick', () => {
    const hub = new RoomHub();
    const { clients } = seatFour(hub, 11, 1_000);
    startMatch(hub, clients, 1_000);
    const before = clients[0]!.socket.sent.length;
    for (let step = 0; step < 10; step++) hub.tick(1_000 + step);
    expect(clients[0]!.socket.sent.length).toBe(before);
  });
});
