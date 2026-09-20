import { describe, expect, it } from 'vitest';
import { chooseBotDecisionForDifficulty } from '@mahjong-live/shared/bot';
import type { PlayerIndex } from '@mahjong-live/shared/rules';
import { AuthoritativeRoom } from './room';
import type { RoomTiming } from './room';

const SEATS: readonly PlayerIndex[] = [0, 1, 2, 3];
const CLIENTS = ['c0', 'c1', 'c2', 'c3'];
const FAST: Partial<RoomTiming> = {
  turnMs: 1_000,
  reactionMs: 400,
  expiriesBeforeTakeover: 2,
  disconnectGraceMs: 5_000,
};

/** A four-seat room mid-hand, with no clock yet: nothing is on a deadline until time is injected. */
function startedRoom(timing: Partial<RoomTiming> = FAST, seed = 4242): AuthoritativeRoom {
  const room = new AuthoritativeRoom(`clock-${seed}`, seed, timing);
  for (const seat of SEATS) {
    expect(room.join(CLIENTS[seat], `Player ${seat}`, seat)).toMatchObject({ ok: true, seat });
  }
  for (const seat of SEATS) {
    expect(
      room.submit(CLIENTS[seat], {
        commandId: `ready-${seat}`,
        expectedVersion: room.publicVersion,
        command: { type: 'set-ready', ready: true },
      }).ok,
    ).toBe(true);
  }
  expect(
    room.submit(CLIENTS[0], {
      commandId: 'start',
      expectedVersion: room.publicVersion,
      command: { type: 'start-round' },
    }).ok,
  ).toBe(true);
  return room;
}

function turnSeat(room: AuthoritativeRoom): PlayerIndex {
  const phase = room.matchState!.round.phase;
  if (phase.kind !== 'awaiting-draw' && phase.kind !== 'awaiting-discard') {
    throw new Error(`room is not on a turn: ${phase.kind}`);
  }
  return phase.player;
}

function drawnTileId(room: AuthoritativeRoom): number {
  const phase = room.matchState!.round.phase;
  if (phase.kind !== 'awaiting-discard' || phase.drawnTileId === null) {
    throw new Error('no drawn tile to tsumogiri');
  }
  return phase.drawnTileId;
}

/** Expires whatever is on the clock until nothing is, or the step cap is reached. */
function runOutTheClock(room: AuthoritativeRoom, steps = 20): void {
  room.tick(0);
  for (let step = 0; step < steps; step++) {
    const deadline = room.currentDeadline;
    if (!deadline) return;
    room.tick(deadline.expiresAt);
  }
}

describe('room deadlines', () => {
  it('has no deadline before time is injected, and never expires the first tick', () => {
    const room = startedRoom();
    expect(room.currentDeadline).toBeNull();
    expect(room.viewFor('c0').deadline).toBeNull();

    const before = room.publicVersion;
    // Far past any window: a room that has never been told the time cannot already be late.
    room.tick(10_000);
    expect(room.publicVersion).toBe(before);
    expect(room.currentDeadline).toEqual({ kind: 'turn', expiresAt: 11_000 });
    // The deadline is public, so a client can render a clock.
    expect(room.viewFor('c0').deadline).toEqual({ kind: 'turn', expiresAt: 11_000 });
    expect(room.viewFor(null).deadline).toEqual({ kind: 'turn', expiresAt: 11_000 });
  });

  it('tsumogiris the drawn tile when a turn expires, and restarts the clock for the next seat', () => {
    const room = startedRoom();
    room.tick(0);
    const seat = turnSeat(room);
    const tileId = drawnTileId(room);
    const before = room.publicVersion;

    room.tick(999);
    expect(room.publicVersion).toBe(before);
    expect(room.matchState!.round.players[seat].discards).toHaveLength(0);

    room.tick(1_000);
    const discards = room.matchState!.round.players[seat].discards;
    expect(discards).toHaveLength(1);
    expect(discards[0].tileId).toBe(tileId);
    expect(discards[0].tsumogiri).toBe(true);
    expect(room.publicVersion).toBeGreaterThan(before);
    // The seat that inherits the wait gets a whole window, not the remains of someone else's.
    expect(room.currentDeadline?.expiresAt).toBeGreaterThan(1_000);
  });

  it('hands a seat to a standard bot after the configured run of expiries, and records the profile', () => {
    const room = startedRoom();
    runOutTheClock(room);

    expect(room.viewFor(null).seats.map((seat) => seat.bot)).toEqual([
      'standard',
      'standard',
      'standard',
      'standard',
    ]);
    for (const member of room.checkpoint().seats) {
      expect(member?.bot?.profile).toBe('standard');
      expect(member?.bot?.sinceVersion).toBeGreaterThan(0);
    }
    // Four bot-held seats need no clock at all: the room settles the rest of the hand itself.
    expect(room.matchState!.round.phase.kind).toBe('ended');
    expect(room.currentDeadline).toBeNull();
  });

  it('replays a takeover identically, because neither the bot nor the difficulty layer uses RNG', () => {
    const round = startedRoom().matchState!.round;
    expect(chooseBotDecisionForDifficulty(round, turnSeat(startedRoom()), 'standard')).toEqual(
      chooseBotDecisionForDifficulty(round, turnSeat(startedRoom()), 'standard'),
    );

    const first = startedRoom();
    const second = startedRoom();
    runOutTheClock(first);
    runOutTheClock(second);
    // A whole bot-played hand, not a couple of moves: the comparison has to be worth making.
    expect(first.publicVersion).toBeGreaterThan(50);
    expect(first.publicVersion).toBe(second.publicVersion);
    expect(first.matchState).toEqual(second.matchState);
  });

  it('gives a bot-held seat back to the client that acts on it', () => {
    const room = startedRoom();
    runOutTheClock(room);
    expect(room.viewFor(null).seats[0].bot).toBe('standard');

    const receipt = room.submit(CLIENTS[0], {
      commandId: 'advance',
      expectedVersion: room.publicVersion,
      command: { type: 'advance-round' },
    });
    expect(receipt.ok).toBe(true);
    expect(room.viewFor(null).seats[0].bot).toBeNull();
    expect(room.viewFor(null).seats[1].bot).toBe('standard');
  });
});

describe('disconnect takeover', () => {
  // Turn and reaction windows long enough that only the disconnect path can fire.
  const SLOW: Partial<RoomTiming> = {
    turnMs: 1_000_000,
    reactionMs: 1_000_000,
    expiriesBeforeTakeover: 2,
    disconnectGraceMs: 5_000,
  };

  it('takes a seat over once the disconnect outlives the grace, and returns it on reconnect', () => {
    const room = startedRoom(SLOW);
    room.tick(0);
    room.setConnected('c1', false, 0);

    room.tick(4_999);
    expect(room.viewFor(null).seats[1].bot).toBeNull();

    room.tick(5_000);
    expect(room.viewFor(null).seats[1].bot).toBe('standard');
    expect(room.checkpoint().seats[1]?.bot?.profile).toBe('standard');

    room.setConnected('c1', true, 6_000);
    expect(room.viewFor(null).seats[1].bot).toBeNull();
    expect(room.checkpoint().seats[1]?.disconnectedAt).toBeNull();
  });
});

describe('bounded room memory', () => {
  it('retains idempotency by version window, so commands at one version do not evict each other', () => {
    const room = new AuthoritativeRoom('cache', 7);
    expect(room.join('c0', 'Player 0', 0).ok).toBe(true);
    expect(
      room.submit('c0', {
        commandId: 'ready',
        expectedVersion: room.publicVersion,
        command: { type: 'set-ready', ready: true },
      }).ok,
    ).toBe(true);

    // Re-asserting the ready flag it already holds succeeds without a public transition, so these
    // all land on one version. Insertion-count eviction would have thrown the first ones away.
    const version = room.publicVersion;
    for (let index = 0; index < 400; index++) {
      const receipt = room.submit('c0', {
        commandId: `noop-${index}`,
        expectedVersion: version,
        command: { type: 'set-ready', ready: true },
      });
      expect(receipt).toMatchObject({ ok: true, duplicate: false });
    }
    expect(room.publicVersion).toBe(version);

    expect(
      room.submit('c0', {
        commandId: 'noop-0',
        expectedVersion: version,
        command: { type: 'set-ready', ready: true },
      }),
    ).toMatchObject({ ok: true, duplicate: true });
  });

  it('trims the catch-up log to the disconnect window', () => {
    const room = startedRoom({ ...FAST, expiriesBeforeTakeover: 99, disconnectGraceMs: 2_000 });
    room.tick(0);
    const everything = room.publicEventsSince(null, 0);
    expect(everything[0].version).toBe(1);

    room.tick(1_000);
    room.tick(10_000);
    const trimmed = room.publicEventsSince(null, 0);
    expect(trimmed.length).toBeLessThan(everything.length);
    expect(trimmed[0].version).toBeGreaterThan(1);
  });
});
