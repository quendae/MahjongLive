import type { PlayerIndex } from '@mahjong-live/shared/rules';
import type { AuthoritativeRoom } from './room';
import { RoomManager } from './roomManager';
import type {
  ClientId,
  CommandEnvelope,
  CommandReceipt,
  PublicEngineEvent,
  RoomId,
  RoomView,
  SeatAuth,
} from './protocol';

/**
 * Everything the hub needs from a socket. `ws`'s `WebSocket` satisfies it structurally, and so
 * does a three-line fake, which is the point: the message layer is testable with no sockets and
 * no timers, and `server.ts` is the only file that knows what a real one is.
 */
export interface TransportSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly bufferedAmount?: number;
}

/**
 * Inbound frames. The first frame on a socket must be `auth`; everything after it is `command`.
 * Omitting `clientId` authenticates nothing and yields a spectator (section 8): the room's own
 * projection already computes exactly the seatless view.
 */
export type ClientFrame =
  | {
      type: 'auth';
      roomId: RoomId;
      clientId?: ClientId;
      token?: string;
      /** Last version this client rendered, for the section 6 catch-up tail. */
      afterVersion?: number;
    }
  | { type: 'command'; envelope: CommandEnvelope };

export type TransitionTail = Array<{ version: number; events: PublicEngineEvent[] }>;

export type ServerFrame =
  /**
   * Snapshot-first (section 6). `view` alone is sufficient to render; `tail` is presentation
   * only and is null when there was nothing to replay or the log no longer reaches back.
   */
  | { type: 'welcome'; seat: PlayerIndex | null; view: RoomView; tail: TransitionTail | null; trimmed: boolean }
  | { type: 'update'; view: RoomView; events: TransitionTail }
  | { type: 'receipt'; receipt: CommandReceipt }
  | { type: 'error'; code: TransportErrorCode; message: string }
  | { type: 'closed'; reason: 'faulted' | 'evicted'; message: string };

export type TransportErrorCode =
  | 'BAD_FRAME'
  | 'NOT_AUTHENTICATED'
  | 'ALREADY_AUTHENTICATED'
  | 'NO_SUCH_ROOM'
  | 'INVALID_TOKEN'
  | 'SPECTATOR_READ_ONLY';

/** Application close codes; 4000-4999 is the range reserved for them. */
export const CLOSE_BAD_FRAME = 4400;
export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_NO_SUCH_ROOM = 4404;
export const CLOSE_EVICTED = 4410;
export const CLOSE_BACKPRESSURE = 4429;
export const CLOSE_FAULTED = 4500;

export interface Connection {
  readonly socket: TransportSocket;
  roomId: RoomId | null;
  /** Null for a spectator. Never assembled from the socket's say-so; see `handleAuth`. */
  auth: SeatAuth | null;
  seat: PlayerIndex | null;
  /** High-water mark of what this connection has been sent, so its tail starts there. */
  lastSentVersion: number;
}

/**
 * Owns socket lifetime and per-viewer fan-out, and nothing else. It frames messages and calls
 * the room; the room never calls back. No arbitration, no validation, no visibility decision
 * lives here -- every one of those is `submit`, `viewFor` or `publicEventsSince`.
 */
export class RoomHub {
  private readonly connections = new Set<Connection>();
  /** Last broadcast state per room, so a 4 Hz clock does not resend an unchanged board. */
  private readonly signatures = new Map<RoomId, string>();

  constructor(
    readonly manager: RoomManager = new RoomManager(),
    private readonly maxBufferedBytes = 1 << 20,
  ) {}

  open(socket: TransportSocket): Connection {
    const connection: Connection = {
      socket,
      roomId: null,
      auth: null,
      seat: null,
      lastSentVersion: 0,
    };
    this.connections.add(connection);
    return connection;
  }

  receive(connection: Connection, raw: string, now: number): void {
    let frame: ClientFrame;
    try {
      frame = JSON.parse(raw) as ClientFrame;
    } catch {
      return this.reject(connection, CLOSE_BAD_FRAME, 'BAD_FRAME', 'Frame is not valid JSON');
    }
    if (!frame || typeof frame !== 'object' || typeof frame.type !== 'string') {
      return this.reject(connection, CLOSE_BAD_FRAME, 'BAD_FRAME', 'Frame has no type');
    }

    if (frame.type === 'auth') {
      if (connection.roomId !== null) {
        return this.reject(
          connection,
          CLOSE_BAD_FRAME,
          'ALREADY_AUTHENTICATED',
          'This socket is already attached to a room',
        );
      }
      return this.handleAuth(connection, frame, now);
    }

    if (frame.type === 'command') {
      if (connection.roomId === null) {
        return this.reject(
          connection,
          CLOSE_BAD_FRAME,
          'NOT_AUTHENTICATED',
          'The first frame on a socket must be auth',
        );
      }
      return this.handleCommand(connection, frame.envelope, now);
    }

    this.reject(connection, CLOSE_BAD_FRAME, 'BAD_FRAME', 'Unknown frame type');
  }

  /** Socket went away. The room hears about it as presence, which is what drives bot takeover. */
  close(connection: Connection, now: number): void {
    if (!this.connections.delete(connection)) return;
    if (connection.roomId === null || connection.auth === null) return;
    const room = this.manager.get(connection.roomId);
    if (!room) return;
    // A reconnect routinely beats the dropped socket's close event, so another live connection
    // may already hold this seat. Reporting the absence anyway would mark a present player away
    // and start walking their seat toward a bot.
    const stillHeld = [...this.connections].some(
      (other) =>
        other.roomId === connection.roomId &&
        other.auth?.clientId === connection.auth!.clientId,
    );
    if (stillHeld) return;
    room.setConnected(connection.auth, false, now);
    this.flush(room);
  }

  /**
   * The only real clock in the system. Rooms hold no timers by design, so this is what moves
   * their deadlines, and section 5's sweep runs on the same pass.
   */
  tick(now: number): void {
    for (const roomId of this.manager.list()) {
      const room = this.manager.get(roomId);
      if (!room) continue;
      room.tick(now);
      this.flush(room);
    }
    for (const roomId of this.manager.sweep(now)) {
      this.teardown(roomId, CLOSE_EVICTED, 'evicted', 'Room expired and was released');
    }
  }

  /** Test seam: the connections currently attached to a room. */
  connectionsIn(roomId: RoomId): Connection[] {
    return [...this.connections].filter((connection) => connection.roomId === roomId);
  }

  private handleAuth(
    connection: Connection,
    frame: Extract<ClientFrame, { type: 'auth' }>,
    now: number,
  ): void {
    const room = this.manager.get(String(frame.roomId ?? ''));
    if (!room) {
      return this.reject(connection, CLOSE_NO_SUCH_ROOM, 'NO_SUCH_ROOM', 'No room with that code');
    }

    const auth: SeatAuth | null =
      typeof frame.clientId === 'string' && frame.clientId.length > 0
        ? { clientId: frame.clientId, token: typeof frame.token === 'string' ? frame.token : '' }
        : null;

    // The room's SeatAuth check is the only authority on which seat this socket holds. A bad
    // credential is a rejected socket rather than a silent demotion to spectator: a client that
    // believes it is seated and is quietly served the public view would render an empty hand.
    const view = room.viewFor(auth);
    if (auth !== null && view.viewerSeat === null) {
      return this.reject(
        connection,
        CLOSE_UNAUTHORIZED,
        'INVALID_TOKEN',
        'Join token does not match that seat',
      );
    }

    connection.roomId = room.id;
    connection.auth = auth;
    connection.seat = view.viewerSeat;
    if (auth !== null) room.setConnected(auth, true, now);

    // Re-read after `setConnected`: reconnecting takes the seat back off a bot, and the snapshot
    // the client renders should already say so.
    const snapshot = auth !== null ? room.viewFor(auth) : view;
    let tail: TransitionTail | null = null;
    let trimmed = false;
    if (typeof frame.afterVersion === 'number' && frame.afterVersion < snapshot.version) {
      // The room states how far its catch-up log reaches. Past that the tail would have a hole
      // in it, so it is dropped: section 6 makes the snapshot self-sufficient precisely so a long
      // absence costs the animation and nothing else.
      trimmed = frame.afterVersion < room.oldestRetainedVersion - 1;
      if (!trimmed) {
        const entries = room.publicEventsSince(auth, frame.afterVersion);
        if (entries.length > 0) tail = entries;
      }
    }
    connection.lastSentVersion = snapshot.version;
    this.send(connection, {
      type: 'welcome',
      seat: snapshot.viewerSeat,
      view: snapshot,
      tail,
      trimmed,
    });
    this.flush(room);
  }

  private handleCommand(connection: Connection, envelope: CommandEnvelope, now: number): void {
    const room = this.manager.get(connection.roomId!);
    if (!room) {
      return this.reject(connection, CLOSE_EVICTED, 'NO_SUCH_ROOM', 'The room is no longer held');
    }
    if (connection.auth === null) {
      return this.send(connection, {
        type: 'error',
        code: 'SPECTATOR_READ_ONLY',
        message: 'A seatless connection cannot send commands',
      });
    }
    if (!envelope || typeof envelope !== 'object') {
      return this.reject(connection, CLOSE_BAD_FRAME, 'BAD_FRAME', 'Command frame has no envelope');
    }

    const receipt = room.submit(connection.auth, envelope, now);
    this.send(connection, { type: 'receipt', receipt });
    this.flush(room);
  }

  /**
   * Per-viewer fan-out. Every connection is served its own `viewFor` and its own event tail --
   * one payload built once and sent to four sockets is exactly how a concealed hand reaches the
   * wrong seat, so there is deliberately no shared payload anywhere in this method.
   */
  private flush(room: AuthoritativeRoom): void {
    if (room.fault !== null) {
      // `submit` already answered the caller with ROOM_FAULTED; everyone else is told and cut
      // loose rather than left attached to a room that will never accept anything again.
      this.teardown(room.id, CLOSE_FAULTED, 'faulted', room.fault);
      return;
    }

    // The spectator view changes if and only if something public changed, and everything private
    // changes only alongside the version, which that view carries. One stringify is therefore a
    // complete change signal for all four seats, and it cannot drift when a field is added.
    //
    // One private change has no version to ride on: answering a reaction window deliberately does
    // not bump it (section 4), and a seatless viewer never had the legal actions that just went
    // away. Signalling the barrier's answered set alongside the spectator view is what stops the
    // seat that just answered being left rendering controls the room will now reject.
    const signature = JSON.stringify([
      room.viewFor(null),
      room.checkpoint().reaction?.respondedSeats,
    ]);
    if (this.signatures.get(room.id) === signature) return;
    this.signatures.set(room.id, signature);

    for (const connection of this.connections) {
      if (connection.roomId !== room.id) continue;
      const view = room.viewFor(connection.auth);
      const events = room.publicEventsSince(connection.auth, connection.lastSentVersion);
      connection.lastSentVersion = view.version;
      this.send(connection, { type: 'update', view, events });
    }
  }

  private teardown(
    roomId: RoomId,
    code: number,
    reason: 'faulted' | 'evicted',
    message: string,
  ): void {
    for (const connection of this.connectionsIn(roomId)) {
      this.connections.delete(connection);
      this.send(connection, { type: 'closed', reason, message });
      connection.socket.close(code, reason);
    }
    this.signatures.delete(roomId);
    this.manager.remove(roomId);
  }

  private reject(
    connection: Connection,
    code: number,
    errorCode: TransportErrorCode,
    message: string,
  ): void {
    this.send(connection, { type: 'error', code: errorCode, message });
    this.connections.delete(connection);
    connection.socket.close(code, errorCode);
  }

  private send(connection: Connection, frame: ServerFrame): void {
    // Dropping a client that is not draining is safe precisely because reconnect is
    // snapshot-first: it comes back and is handed a complete view. Queuing megabytes is not.
    if ((connection.socket.bufferedAmount ?? 0) > this.maxBufferedBytes) {
      this.connections.delete(connection);
      connection.socket.close(CLOSE_BACKPRESSURE, 'backpressure');
      return;
    }
    connection.socket.send(JSON.stringify(frame));
  }
}
