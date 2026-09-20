import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LegalAction, PlayerIndex } from '@mahjong-live/shared/rules';
import { AuthoritativeRoom } from './room';
import type { RoomTiming } from './room';
import { RoomManager } from './roomManager';
import { startServer } from './server';
import type { MahjongServer } from './server';
import type { ServerFrame } from './session';
import type { ClientCommand, RoomId, RoomView } from './protocol';

/**
 * Phase 3 validation: four clients, real sockets, a real match.
 *
 * The load-bearing constraint is that every command is chosen by `decide()`, which is handed one
 * `RoomView` and nothing else. No helper in this file reaches into `room.matchState` to pick a
 * move. Authoritative state is read for exactly one purpose: to audit what went out on the wire.
 *
 * Nothing here waits on a duration. The room's only clock is the 250ms `setInterval` in
 * `server.ts`, so these rooms carry deadlines far longer than the test can run -- the timer fires,
 * finds nothing expired, and produces no frames. Every wait below is a wait for a specific
 * message, or for a specific version or seat state to arrive in a client's own projection.
 */

const SEATS: readonly PlayerIndex[] = [0, 1, 2, 3];
const STEP_CAP = 20_000;
/** Long enough that the 250ms server tick can never expire anything mid-test. */
const NO_EXPIRY: Partial<RoomTiming> = { turnMs: 3_600_000, reactionMs: 3_600_000 };

/**
 * `POST /rooms` deliberately refuses a caller-supplied seed (section 3), so a test that needs two
 * rooms on one seed supplies it here instead of through the protocol. `allocate` calls
 * `this.create`, so the real HTTP create path still runs.
 */
class SeededManager extends RoomManager {
  constructor(
    private readonly seed: number,
    private readonly timing: Partial<RoomTiming> = NO_EXPIRY,
  ) {
    super();
  }

  override create(roomId: RoomId): AuthoritativeRoom {
    const room = new AuthoritativeRoom(roomId.toUpperCase(), this.seed, this.timing);
    this.restore(room);
    return room;
  }
}

// ---------------------------------------------------------------------------
// The client: a socket, its own projection, and a decision function over it.
// ---------------------------------------------------------------------------

interface Waiter {
  predicate: (view: RoomView) => boolean;
  resolve: () => void;
}

class WireClient {
  /** Frames not yet handed to the leakage audit. Drained so a long match stays in memory. */
  readonly pending: ServerFrame[] = [];
  /** Every public event this connection was ever sent, flattened, for the determinism check. */
  readonly publicEvents: unknown[] = [];
  welcome!: Extract<ServerFrame, { type: 'welcome' }>;
  view: RoomView | null = null;
  seat: PlayerIndex | null = null;
  closed = false;
  /** Commands accepted, for the "was the stream substantial" assertions. */
  decisions = 0;
  updates = 0;
  /** Frames that carried this seat's own concealed hand. */
  ownHandFrames = 0;
  /** Version at which this client last submitted, so a reaction pass is not re-sent. */
  private actedAtVersion = -1;
  private readonly viewWaiters: Waiter[] = [];
  private readonly frameWaiters: Array<(frame: ServerFrame) => void> = [];
  private readonly inbox: ServerFrame[] = [];

  private constructor(
    readonly label: string,
    private readonly socket: WebSocket,
  ) {}

  static async connect(
    port: number,
    roomId: string,
    label: string,
    auth: { clientId: string; token: string } | null,
    afterVersion?: number,
  ): Promise<WireClient> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve());
      socket.addEventListener('error', () => reject(new Error(`${label}: socket failed to open`)));
    });
    const client = new WireClient(label, socket);
    socket.addEventListener('message', (event) => client.receive(String(event.data)));
    socket.send(JSON.stringify({ type: 'auth', roomId, ...auth, afterVersion }));
    const first = await client.nextFrame();
    if (first.type !== 'welcome') throw new Error(`${label}: first frame was ${first.type}`);
    client.welcome = first;
    client.seat = first.seat;
    return client;
  }

  close(): Promise<void> {
    this.closed = true;
    return new Promise<void>((resolve) => {
      this.socket.addEventListener('close', () => resolve());
      this.socket.close();
    });
  }

  /** Resolves once this client's own projection satisfies `predicate`. Never a duration. */
  until(predicate: (view: RoomView) => boolean): Promise<void> {
    if (this.view && predicate(this.view)) return Promise.resolve();
    return new Promise<void>((resolve) => this.viewWaiters.push({ predicate, resolve }));
  }

  atVersion(version: number): Promise<void> {
    return this.until((view) => view.version >= version);
  }

  nextFrame(): Promise<ServerFrame> {
    const queued = this.inbox.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise<ServerFrame>((resolve) => this.frameWaiters.push(resolve));
  }

  /** The move this client's projection alone implies, or null when it has nothing to do. */
  pendingCommand(): ClientCommand | null {
    if (this.closed || !this.view || this.view.version === this.actedAtVersion) return null;
    return decide(this.view);
  }

  /** Sends one command and resolves with its receipt frame. `expectedVersion` comes from the view. */
  async send(commandId: string, command: ClientCommand): Promise<Extract<ServerFrame, { type: 'receipt' }>> {
    const view = this.view;
    if (!view) throw new Error(`${this.label}: no view to command from`);
    this.actedAtVersion = view.version;
    this.socket.send(
      JSON.stringify({
        type: 'command',
        envelope: { commandId, expectedVersion: view.version, command },
      }),
    );
    // An update for an earlier command can still be queued ahead of our receipt.
    let frame = await this.nextFrame();
    while (frame.type !== 'receipt') frame = await this.nextFrame();
    return frame;
  }

  takeUnaudited(): ServerFrame[] {
    return this.pending.splice(0, this.pending.length);
  }

  private receive(raw: string): void {
    const frame = JSON.parse(raw) as ServerFrame;
    this.pending.push(frame);
    if (frame.type === 'welcome' || frame.type === 'update') {
      this.view = frame.view;
      if (frame.type === 'update') {
        this.updates += 1;
        for (const entry of frame.events) this.publicEvents.push(...entry.events);
      }
      if (this.seat !== null && (frame.view.round?.players[this.seat].concealed?.length ?? 0) > 0) {
        this.ownHandFrames += 1;
      }
      for (let index = this.viewWaiters.length - 1; index >= 0; index--) {
        const waiter = this.viewWaiters[index];
        if (waiter.predicate(frame.view)) {
          this.viewWaiters.splice(index, 1);
          waiter.resolve();
        }
      }
    }
    const waiter = this.frameWaiters.shift();
    if (waiter) waiter(frame);
    else this.inbox.push(frame);
  }
}

/**
 * The whole client brain. One `RoomView` in, one command or nothing out. If this function ever
 * needs a second argument, the projection is incomplete -- and that is a finding, not a helper
 * the test is allowed to add.
 */
function decide(view: RoomView): ClientCommand | null {
  const me = view.viewerSeat;
  if (me === null) return null;
  const mine = view.seats[me];

  if (view.status === 'lobby') {
    if (!mine.ready) return { type: 'set-ready', ready: true };
    if (mine.isHost && view.seats.every((seat) => seat.occupied && seat.ready)) {
      return { type: 'start-round' };
    }
    return null;
  }
  if (view.status !== 'playing' || view.round === null) return null;

  const round = view.round;
  // Any seated client may advance (section 1); the host does it so the choice is deterministic.
  if (round.phase.kind === 'ended') return mine.isHost ? { type: 'advance-round' } : null;

  const legal = round.legalActions;
  if (legal.length === 0) return null;
  const find = <T extends LegalAction['type']>(type: T) =>
    legal.find((action): action is Extract<LegalAction, { type: T }> => action.type === type);

  if (round.phase.kind === 'reactions' || round.phase.kind === 'kan-reactions') {
    if (find('ron')) return { type: 'round-action', action: { type: 'ron', player: me } };
    return { type: 'pass' };
  }

  if (find('tsumo')) return { type: 'round-action', action: { type: 'tsumo', player: me } };
  const riichi = find('riichi-discard');
  if (riichi && riichi.tileIds.length > 0) {
    return {
      type: 'round-action',
      action: { type: 'riichi-discard', player: me, tileId: riichi.tileIds[0] },
    };
  }
  const discard = find('discard');
  if (discard && discard.tileIds.length > 0) {
    // Tsumogiri when the projection told us what we drew, otherwise the first legal tile.
    const drawn = round.phase.kind === 'awaiting-discard' ? round.phase.drawnTileId : null;
    const tileId = drawn !== null && discard.tileIds.includes(drawn) ? drawn : discard.tileIds[0];
    return { type: 'round-action', action: { type: 'discard', player: me, tileId } };
  }
  // Reached only if a seat is on the clock with no move it can name from its own view.
  throw new Error(
    `seat ${me} cannot act from its projection alone: ${JSON.stringify(legal.map((a) => a.type))}`,
  );
}

// ---------------------------------------------------------------------------
// Wire-level hidden information audit.
// ---------------------------------------------------------------------------

/** Every physical tile id reachable in a value, by the `{ id: number }` shape tiles carry. */
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

/** `Tile.id` is optional in the engine type; a tile without one cannot be swept for. */
function physicalIds(tiles: readonly { id?: number }[]): number[] {
  return tiles.map((tile) => tile.id).filter((id): id is number => typeof id === 'number');
}

interface AuditState {
  leaks: string[];
  /** Frames a spectator was served that carried anything private. */
  spectatorLeaks: string[];
  framesChecked: number;
  spectatorViewFrames: number;
  /** Total hidden tile ids the sweep actually looked for, so an empty sweep cannot pass. */
  hiddenIdsChecked: number;
  handsAudited: Set<number>;
}

function newAudit(): AuditState {
  return {
    leaks: [],
    spectatorLeaks: [],
    framesChecked: 0,
    spectatorViewFrames: 0,
    hiddenIdsChecked: 0,
    handsAudited: new Set(),
  };
}

/**
 * Checks every frame received since the last call against the authoritative state as it stands
 * right now. Sound because the driver is strictly serialized: the room cannot advance between
 * the flush that produced these frames and this call, since advancing it takes another command
 * and this runs before the next one is sent.
 */
function auditWire(room: AuthoritativeRoom, clients: readonly WireClient[], audit: AuditState): void {
  const round = room.matchState?.round ?? null;
  const publicDoraIds = new Set(round?.wall.doraIndicators.map((tile) => tile.id) ?? []);
  if (room.matchState) audit.handsAudited.add(room.matchState.roundNumber);

  for (const client of clients) {
    const fresh = client.takeUnaudited();
    audit.framesChecked += fresh.length;

    if (client.seat === null) {
      for (const frame of fresh) {
        if (frame.type !== 'welcome' && frame.type !== 'update') continue;
        audit.spectatorViewFrames += 1;
        if (frame.view.viewerSeat !== null) audit.spectatorLeaks.push('spectator held a seat');
        const spectated = frame.view.round;
        if (!spectated) continue;
        for (const player of spectated.players) {
          if (player.concealed !== null) audit.spectatorLeaks.push(`hand for seat ${player.seat}`);
          if (player.privateState !== undefined) {
            audit.spectatorLeaks.push(`private state for seat ${player.seat}`);
          }
        }
        if (spectated.legalActions.length > 0) audit.spectatorLeaks.push('legal actions');
        if (spectated.phase.kind === 'awaiting-discard' && spectated.phase.drawnTileId !== null) {
          audit.spectatorLeaks.push('drawn tile id');
        }
      }
    }

    if (fresh.length === 0 || round === null) continue;
    const exposed = collectPhysicalIds(fresh);
    for (const seat of SEATS) {
      if (seat === client.seat) continue;
      for (const id of physicalIds(round.players[seat].concealed)) {
        if (exposed.has(id)) audit.leaks.push(`${client.label}: seat ${seat} concealed tile ${id}`);
      }
    }
    for (const id of physicalIds(round.wall.liveWall)) {
      if (exposed.has(id)) audit.leaks.push(`${client.label}: live wall tile ${id}`);
    }
    for (const id of physicalIds(round.wall.deadWall)) {
      if (publicDoraIds.has(id)) continue;
      if (exposed.has(id)) audit.leaks.push(`${client.label}: unrevealed dead wall tile ${id}`);
    }
    audit.hiddenIdsChecked +=
      physicalIds(round.wall.liveWall).length + physicalIds(round.wall.deadWall).length;
  }
}

// ---------------------------------------------------------------------------
// Harness.
// ---------------------------------------------------------------------------

async function post(port: number, path: string, body?: unknown): Promise<any> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

interface Table {
  roomId: string;
  room: AuthoritativeRoom;
  prefix: string;
  seated: WireClient[];
  spectator: WireClient;
  /** Every connection in the room, seats and spectator alike. */
  all: WireClient[];
  commands: number;
}

/** Creates a room over HTTP, joins four seats over HTTP, then attaches five real sockets. */
async function seatTable(server: MahjongServer, prefix: string): Promise<Table> {
  const created = await post(server.port, '/rooms');
  expect(created.status).toBe(201);
  const roomId: string = created.body.roomId;

  const seated: WireClient[] = [];
  for (const seat of SEATS) {
    const joined = await post(server.port, `/rooms/${roomId}/join`, {
      clientId: `${prefix}-c${seat}`,
      displayName: `Player ${seat}`,
      seat,
    });
    expect(joined.body).toMatchObject({ ok: true, seat });
    seated[seat] = await WireClient.connect(server.port, roomId, `seat${seat}`, {
      clientId: `${prefix}-c${seat}`,
      token: joined.body.token,
    });
    expect(seated[seat].seat).toBe(seat);
  }
  const spectator = await WireClient.connect(server.port, roomId, 'spectator', null);
  expect(spectator.seat).toBeNull();

  const room = server.hub.manager.get(roomId);
  if (!room) throw new Error('room vanished');
  return { roomId, room, prefix, seated, spectator, all: [...seated, spectator], commands: 0 };
}

interface PlayResult {
  handsFinished: number;
  commands: number;
  rejections: string[];
}

/**
 * Drives the table one command at a time. Serialized on purpose: it is what makes the audit's
 * "the state right now" reading sound, and it removes every race from the assertions.
 */
async function drive(
  table: Table,
  options: {
    maxHands?: number;
    maxCommands?: number;
    onlySeats?: readonly PlayerIndex[];
    audit?: AuditState;
  } = {},
): Promise<PlayResult> {
  const result: PlayResult = { handsFinished: 0, commands: 0, rejections: [] };
  const maxHands = options.maxHands ?? Number.POSITIVE_INFINITY;
  const maxCommands = options.maxCommands ?? STEP_CAP;
  const eligible = options.onlySeats ?? SEATS;

  for (let step = 0; step < maxCommands; step++) {
    if (options.audit) auditWire(table.room, table.all, options.audit);

    const actor = table.seated.find(
      (client, seat) => eligible.includes(seat as PlayerIndex) && client.pendingCommand() !== null,
    );
    const command = actor?.pendingCommand();
    if (!actor || !command) break;
    if (command.type === 'advance-round') {
      // The decision to advance is itself the proof a hand ended; stop with it ended, not dealt.
      result.handsFinished += 1;
      if (result.handsFinished >= maxHands) break;
    }

    const before = actor.view!.version;
    const receipt = (await actor.send(`cmd-${table.commands++}`, command)).receipt;
    result.commands += 1;
    if (receipt.ok) actor.decisions += 1;
    else if (receipt.code !== 'STALE_VERSION') {
      // A projection-driven client should never be told its own move is impossible.
      result.rejections.push(`${actor.label} ${command.type}: ${receipt.code} ${receipt.message}`);
    }
    if (receipt.version > before) {
      const live = table.all.filter((client) => !client.closed);
      await Promise.all(live.map((client) => client.atVersion(receipt.version)));
    }
  }
  if (options.audit) auditWire(table.room, table.all, options.audit);
  return result;
}

/** The token the room issued for a seat; stands in for the client's own stored copy. */
function tokenOf(table: Table, seat: PlayerIndex): string {
  const member = table.room.checkpoint().seats[seat];
  if (!member || member.clientId !== `${table.prefix}-c${seat}`) throw new Error('no such seat');
  return member.token;
}

function attach(table: Table, seat: PlayerIndex, client: WireClient): void {
  table.all[table.all.indexOf(table.seated[seat])] = client;
  table.seated[seat] = client;
}

// ---------------------------------------------------------------------------
// 1 + 3: a full match from projections alone, swept for leakage frame by frame.
// ---------------------------------------------------------------------------

describe('four clients play a full match over real sockets', () => {
  let server: MahjongServer;
  let table: Table;
  let played: PlayResult;
  const audit = newAudit();

  beforeAll(async () => {
    server = await startServer({ port: 0, manager: new SeededManager(20260920) });
    table = await seatTable(server, 'full');
    played = await drive(table, { audit });
  }, 600_000);

  afterAll(async () => {
    await server?.close();
  });

  it('drives every seat to match end from its own projection and nothing else', () => {
    expect(played.rejections).toEqual([]);
    // The match ended, not just a hand: section 1's meaning of 'finished'.
    expect(table.room.roomStatus).toBe('finished');
    expect(table.room.matchState?.status).toBe('ended');
    expect(table.room.matchState?.result).toBeDefined();

    const final = table.seated[0].view!;
    expect(final.status).toBe('finished');
    expect(final.match?.status).toBe('ended');
    expect(final.match?.result).not.toBeNull();
    // Every connection saw the same ending, so all five projections tracked it to the end.
    for (const client of table.all) {
      expect(client.view?.version).toBe(table.room.publicVersion);
      expect(client.view?.match?.result).toEqual(final.match?.result);
    }

    // Substance: more than one hand, and every seat really made its own decisions.
    expect(played.handsFinished).toBeGreaterThan(1);
    expect(played.commands).toBeGreaterThan(200);
    for (const seat of SEATS) expect(table.seated[seat].decisions).toBeGreaterThan(20);
  });

  it('never puts a hidden tile on any wire, over the whole match', () => {
    expect(audit.leaks).toEqual([]);
    expect(audit.spectatorLeaks).toEqual([]);

    // A sweep over an empty stream passes trivially, so prove the stream was real.
    expect(audit.framesChecked).toBeGreaterThan(1_000);
    expect(audit.hiddenIdsChecked).toBeGreaterThan(100_000);
    expect(audit.handsAudited.size).toBeGreaterThan(1);
    expect(audit.spectatorViewFrames).toBeGreaterThan(200);
    for (const client of table.all) expect(client.updates).toBeGreaterThan(200);
    // And that each seat really was sent its own hand, so the sweep had something to miss.
    for (const seat of SEATS) expect(table.seated[seat].ownHandFrames).toBeGreaterThan(100);
    expect(table.spectator.ownHandFrames).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2: reconnect mid-match, over the wire.
// ---------------------------------------------------------------------------

describe('reconnect mid-match over the wire', () => {
  it('resumes to the right board and replays the tail it missed', async () => {
    const server = await startServer({ port: 0, manager: new SeededManager(515) });
    try {
      const table = await seatTable(server, 'tail');
      await drive(table, { maxCommands: 40 });
      expect(table.room.roomStatus).toBe('playing');
      // Leave seat 1 off the clock, so the other three can still move it forward once it drops.
      for (let guard = 0; guard < 20 && table.seated[1].pendingCommand() !== null; guard++) {
        await drive(table, { maxCommands: 1 });
      }
      expect(table.seated[1].pendingCommand()).toBeNull();

      const token = tokenOf(table, 1);
      const resumeFrom = table.room.publicVersion;
      await table.seated[1].close();

      // Play on without seat 1 so the tail has something in it. As far as the room is concerned
      // seat 1 is merely absent; its disconnect grace is a minute away.
      await drive(table, { maxCommands: 8, onlySeats: [0, 2, 3] });
      expect(table.room.publicVersion).toBeGreaterThan(resumeFrom);
      // The resume point is inside the retained window, so the tail is servable in full.
      expect(resumeFrom).toBeGreaterThanOrEqual(table.room.oldestRetainedVersion - 1);

      const resumed = await WireClient.connect(
        server.port,
        table.roomId,
        'seat1-resumed',
        { clientId: 'tail-c1', token },
        resumeFrom,
      );
      const welcome = resumed.welcome;
      expect(welcome.seat).toBe(1);
      expect(welcome.trimmed).toBe(false);
      expect(welcome.tail).not.toBeNull();

      // The tail covers exactly the versions missed, contiguously, up to the snapshot.
      const versions = welcome.tail!.map((entry) => entry.version);
      expect(versions).toEqual(
        Array.from({ length: versions.length }, (_, index) => resumeFrom + 1 + index),
      );
      expect(versions.at(-1)).toBe(welcome.view.version);
      expect(welcome.tail!.some((entry) => entry.events.length > 0)).toBe(true);

      // Snapshot-first: the view alone is the authoritative board for this seat.
      const authoritative = table.room.matchState!.round;
      expect(welcome.view.version).toBe(table.room.publicVersion);
      expect(welcome.view.round!.players[1].concealed?.map((tile) => tile.id)).toEqual(
        authoritative.players[1].concealed.map((tile) => tile.id),
      );
      expect(welcome.view.round!.players[0].concealed).toBeNull();
      expect(welcome.view.round!.wall.remainingLiveTiles).toBe(authoritative.wall.liveWall.length);
      expect(welcome.view.round!.players.map((player) => player.discards.length)).toEqual(
        authoritative.players.map((player) => player.discards.length),
      );
      expect(welcome.view.round!.currentPlayer).toBe(authoritative.currentPlayer);

      // And the resumed socket can carry on playing from the projection it was handed.
      attach(table, 1, resumed);
      const after = await drive(table, { maxCommands: 12 });
      expect(after.rejections).toEqual([]);
      expect(after.commands).toBeGreaterThan(0);
      expect(table.room.publicVersion).toBeGreaterThan(welcome.view.version);
    } finally {
      await server.close();
    }
  }, 120_000);

  it('drops a trimmed tail and takes the seat back off the bot', async () => {
    // A 1ms disconnect grace makes both halves deterministic: the first 250ms server tick after
    // the socket closes is already past the grace, so it both takes the seat over and trims the
    // catch-up log. Nothing here waits on that interval -- the wait is for the resulting frame.
    const server = await startServer({
      port: 0,
      manager: new SeededManager(818, { ...NO_EXPIRY, disconnectGraceMs: 1 }),
    });
    try {
      const table = await seatTable(server, 'trim');
      await drive(table, { maxCommands: 30 });
      expect(table.room.roomStatus).toBe('playing');
      const token = tokenOf(table, 1);

      await table.seated[1].close();
      // A takeover is public in the seat view, so the other seats are told on the flush that
      // follows the tick that performed it.
      await table.seated[0].until((view) => view.seats[1].bot !== null);
      expect(table.room.checkpoint().seats[1]?.bot?.profile).toBe('standard');

      // Keep playing so the log trims well past version 0 and the bot really is holding a seat.
      await drive(table, { maxCommands: 20, onlySeats: [0, 2, 3] });
      expect(table.room.oldestRetainedVersion).toBeGreaterThan(2);

      const resumed = await WireClient.connect(
        server.port,
        table.roomId,
        'seat1-resumed',
        { clientId: 'trim-c1', token },
        0,
      );
      const welcome = resumed.welcome;
      expect(welcome.seat).toBe(1);
      // Past the stated boundary the tail is dropped, not served with a hole in it.
      expect(welcome.trimmed).toBe(true);
      expect(welcome.tail).toBeNull();
      // Reconnecting is a return: the seat is off the bot in the very snapshot served.
      expect(welcome.view.seats[1].bot).toBeNull();
      expect(table.room.checkpoint().seats[1]?.bot).toBeNull();
      // The snapshot is self-sufficient: a whole board with this seat's own hand on it.
      const authoritative = table.room.matchState!.round;
      expect(welcome.view.version).toBe(table.room.publicVersion);
      expect(welcome.view.round!.players[1].concealed?.map((tile) => tile.id)).toEqual(
        authoritative.players[1].concealed.map((tile) => tile.id),
      );
      expect(welcome.view.round!.players[1].concealed!.length).toBeGreaterThan(0);

      attach(table, 1, resumed);
      const after = await drive(table, { maxCommands: 10 });
      expect(after.rejections).toEqual([]);
    } finally {
      await server.close();
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------
// 4: deterministic spectator / replay consistency.
// ---------------------------------------------------------------------------

describe('deterministic spectator stream', () => {
  it('produces an identical public event stream for two rooms on one seed', async () => {
    const run = async (): Promise<{ events: unknown[]; played: PlayResult }> => {
      const server = await startServer({ port: 0, manager: new SeededManager(31337) });
      try {
        const table = await seatTable(server, 'det');
        const played = await drive(table, { maxHands: 2 });
        return { events: table.spectator.publicEvents, played };
      } finally {
        await server.close();
      }
    };

    const first = await run();
    const second = await run();

    // Substantial, or two empty arrays would match.
    expect(first.played.handsFinished).toBe(2);
    expect(first.events.length).toBeGreaterThan(150);
    expect(first.events.some((event: any) => event.type === 'TileDiscarded')).toBe(true);
    expect(first.events.some((event: any) => event.type === 'RoundEnded')).toBe(true);
    // Public only: a spectator's TileDrawn never names the tile, on either run.
    for (const event of first.events) {
      if ((event as any).type === 'TileDrawn') expect((event as any).tile).toBeUndefined();
    }

    expect(second.events).toEqual(first.events);
    expect(second.played.commands).toBe(first.played.commands);
    expect(second.played.handsFinished).toBe(first.played.handsFinished);
  }, 300_000);
});
