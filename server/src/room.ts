import { randomBytes, timingSafeEqual } from 'node:crypto';
import { applyAction, getLegalActions } from '@mahjong-live/shared/rules';
import type {
  ApplyActionResult,
  PlayerIndex,
  RoundAction,
  RoundEvent,
  RoundState,
} from '@mahjong-live/shared/rules';
import {
  advanceSeededMatch,
  createSeededMatch,
  forcedSeatAction,
  isReactionPhase,
  reactionEligibleSeats,
} from '@mahjong-live/shared/match';
import type { MatchState } from '@mahjong-live/shared/match';
import { chooseBotDecisionForDifficulty } from '@mahjong-live/shared/bot';
import type { BotDifficulty } from '@mahjong-live/shared/bot';
import { projectEngineEvent, projectRoom } from './projection';
import type {
  ClientId,
  CommandEnvelope,
  CommandErrorCode,
  CommandReceipt,
  JoinResult,
  PublicEngineEvent,
  ReactionBarrierCheckpoint,
  RoomCheckpoint,
  RoomDeadline,
  RoomId,
  RoomMember,
  RoomSeats,
  RoomStatus,
  RoomTransition,
  RoomView,
  SeatAuth,
} from './protocol';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];
/**
 * Idempotency is retained by version window, not by insertion count: a full hanchan runs well
 * past any fixed entry count, and an evicted command is only safe to forget once a retry of it
 * would be rejected as stale anyway.
 */
const COMMAND_VERSION_WINDOW = 256;
/**
 * A settle pass chains draws, forced discards, empty reaction windows and every bot-held seat,
 * so four bots settle a whole hand in one pass. The cap is an infinite-loop guard, not a budget.
 */
const MAX_SETTLE_STEPS = 1024;
/** Section 7: takeover plays at `standard`, and the profile is recorded because output depends on it. */
const TAKEOVER_PROFILE: BotDifficulty = 'standard';

/**
 * A join token is a credential, not a lookup handle, and the distinction decides the source of
 * randomness. Room codes are deliberately `Math.random` (see `roomManager.ts`): a code is read
 * aloud and typed in by hand, so it is a handle people share on purpose. A token is never seen by
 * a human and is the only thing between a stranger who learned a `clientId` and that seat's
 * concealed hand, so it comes from the platform CSPRNG with 192 bits of entropy.
 */
function randomToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Compared in constant time. The token is a secret an attacker can probe repeatedly with a known
 * `clientId`, and `===` on strings short-circuits on the first differing byte.
 */
function tokensMatch(expected: string, given: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export interface RoomTiming {
  /** Window for a real decision on `awaiting-draw` / `awaiting-discard`. */
  turnMs: number;
  /** Shorter window for `reactions` / `kan-reactions`, which every eligible seat shares. */
  reactionMs: number;
  /** Consecutive expiries on one seat before a bot takes it. */
  expiriesBeforeTakeover: number;
  /** Disconnect length before a bot takes the seat, and the age at which the catch-up log is trimmed. */
  disconnectGraceMs: number;
  /** Idle time before a lobby with nobody connected in it is swept. Nothing is lost by dropping it. */
  emptyLobbyTtlMs: number;
  /**
   * How long a playing room outlives its last connected seat. This retention *is* the reconnect
   * window, so it may never be shorter than `disconnectGraceMs`: a seat handed to a bot at the end
   * of the grace period must still have a room to come back to. The constructor enforces it.
   */
  playingRetentionMs: number;
  /** How long a finished room is kept for clients still reading the result. */
  finishedTtlMs: number;
}

export const DEFAULT_ROOM_TIMING: RoomTiming = {
  turnMs: 20_000,
  reactionMs: 8_000,
  expiriesBeforeTakeover: 3,
  disconnectGraceMs: 60_000,
  emptyLobbyTtlMs: 300_000,
  // 15x the disconnect grace: long enough that a phone switching networks still finds its hand.
  playingRetentionMs: 900_000,
  finishedTtlMs: 600_000,
};

interface ReactionBarrier {
  phaseVersion: number;
  eligibleSeats: Set<PlayerIndex>;
  respondedSeats: Set<PlayerIndex>;
}

function emptySeats(): RoomSeats {
  return [null, null, null, null];
}

function replaceSeat(
  seats: RoomSeats,
  seat: PlayerIndex,
  member: RoomMember | null,
): RoomSeats {
  const copy = [...seats] as Array<RoomMember | null>;
  copy[seat] = member;
  return [copy[0], copy[1], copy[2], copy[3]];
}

function isReactionRoundAction(action: RoundAction): boolean {
  return action.type === 'ron' || action.type === 'chi' || action.type === 'pon' || action.type === 'daiminkan';
}

export class AuthoritativeRoom {
  readonly id: RoomId;
  private status: RoomStatus = 'lobby';
  private version = 0;
  private hostClientId: ClientId | null = null;
  private seats: RoomSeats = emptySeats();
  private readonly seed: number;
  private match: MatchState | null = null;
  private reaction: ReactionBarrier | null = null;
  private transitions: RoomTransition[] = [];
  private processed = new Map<string, Extract<CommandReceipt, { ok: true }>>();
  private processedOrder: string[] = [];
  readonly timing: RoomTiming;
  /**
   * Injected time. The room never reads a clock and never holds a timer: the caller passes `now`
   * and that is the only thing that moves. Four clients can therefore run in-process with no
   * sockets and no fake timers, and a test drives an expiry by passing a larger number.
   *
   * Null until the caller first supplies one. A room with no clock has no deadline at all, so a
   * long-restored or never-ticked room cannot expire a turn the instant real time arrives.
   */
  private clock: number | null = null;
  private deadline: RoomDeadline | null = null;
  /** Clock reading when the hanchan ended, for the finished-room TTL. Null while it has not. */
  private finishedAt: number | null = null;
  /** `version:kind` of the wait the current deadline belongs to; a new wait resets the window. */
  private deadlineKey = '';
  private consecutiveExpiries: number[] = [0, 0, 0, 0];
  /** Set once, with the invariant that failed. Non-null means the room is dead. */
  private faultReason: string | null = null;

  /** The seed never leaves the server: a client that picked it could derive the whole wall. */
  constructor(
    id: RoomId,
    seed: number = Math.floor(Math.random() * 0x7fffffff),
    timing: Partial<RoomTiming> = {},
    /** Injected so a test gets deterministic tokens. Production takes the CSPRNG default. */
    private readonly newToken: () => string = randomToken,
  ) {
    if (!id.trim()) throw new Error('Room ID must not be empty');
    if (!Number.isFinite(seed)) throw new Error('Room seed must be a finite number');
    this.id = id;
    this.seed = Math.trunc(seed);
    this.timing = { ...DEFAULT_ROOM_TIMING, ...timing };
    for (const value of [
      this.timing.turnMs,
      this.timing.reactionMs,
      this.timing.disconnectGraceMs,
      this.timing.emptyLobbyTtlMs,
      this.timing.playingRetentionMs,
      this.timing.finishedTtlMs,
    ]) {
      if (!(value > 0)) throw new Error('Room timing windows must be positive');
    }
    if (this.timing.playingRetentionMs < this.timing.disconnectGraceMs) {
      // Evicting a room before the takeover grace elapses would make reconnect unreachable.
      throw new Error('Playing retention must not be shorter than the disconnect grace');
    }
  }

  static restore(
    checkpoint: RoomCheckpoint,
    timing: Partial<RoomTiming> = {},
    newToken: () => string = randomToken,
  ): AuthoritativeRoom {
    const round = checkpoint.match?.round ?? null;
    if (round && isReactionPhase(round) && !checkpoint.reaction) {
      // Rebuilding it would forget every response already given, including passes.
      throw new Error('Checkpoint in a reaction phase must carry its reaction barrier');
    }
    const room = new AuthoritativeRoom(checkpoint.id, checkpoint.seed, timing, newToken);
    room.status = checkpoint.status;
    room.version = checkpoint.version;
    room.hostClientId = checkpoint.hostClientId;
    room.seats = checkpoint.seats;
    room.match = checkpoint.match;
    room.reaction = checkpoint.reaction
      ? {
          phaseVersion: checkpoint.reaction.phaseVersion,
          eligibleSeats: new Set(checkpoint.reaction.eligibleSeats),
          respondedSeats: new Set(checkpoint.reaction.respondedSeats),
        }
      : null;
    return room;
  }

  get publicVersion(): number {
    return this.version;
  }

  get roomStatus(): RoomStatus {
    return this.status;
  }

  /** The authoritative match. Server-side only: it contains the wall. */
  get matchState(): MatchState | null {
    return this.match;
  }

  /**
   * A first join issues the seat's token; a rejoin has to present it. Rejoin is exactly the flow
   * where a client re-asserts an identity it claimed earlier, so it is the one path where a bare
   * `clientId` would hand a stranger a seat that is already occupied.
   */
  join(
    clientId: ClientId,
    displayName: string,
    preferredSeat?: PlayerIndex,
    token?: string,
  ): JoinResult {
    const existing = this.findSeat(clientId);
    if (existing !== null) {
      if (token === undefined || !tokensMatch(this.seats[existing]!.token, token)) {
        return {
          ok: false,
          code: 'INVALID_TOKEN',
          message: 'Rejoining an occupied seat requires the join token issued for it',
        };
      }
      // Re-joining is a return: the seat comes back off the bot even without a presence report.
      this.reclaimSeat(existing);
      return { ok: true, seat: existing, version: this.version, token };
    }
    if (this.status !== 'lobby') {
      return { ok: false, code: 'ROOM_NOT_LOBBY', message: 'Cannot join after the round started' };
    }

    let seat: PlayerIndex | null = null;
    if (preferredSeat !== undefined) {
      if (!PLAYERS.includes(preferredSeat)) {
        return { ok: false, code: 'INVALID_SEAT', message: 'Seat must be 0, 1, 2 or 3' };
      }
      if (this.seats[preferredSeat] !== null) {
        return { ok: false, code: 'SEAT_TAKEN', message: 'Requested seat is already occupied' };
      }
      seat = preferredSeat;
    } else {
      seat = PLAYERS.find((candidate) => this.seats[candidate] === null) ?? null;
    }

    if (seat === null) {
      return { ok: false, code: 'ROOM_FULL', message: 'The room already has four players' };
    }

    const member: RoomMember = {
      clientId,
      token: this.newToken(),
      displayName: displayName.trim() || `Player ${seat + 1}`,
      ready: false,
    };
    this.seats = replaceSeat(this.seats, seat, member);
    if (this.hostClientId === null) this.hostClientId = clientId;
    this.bumpVersion([]);
    return { ok: true, seat, version: this.version, token: member.token };
  }

  /**
   * Section 5 room lifetime, as a pure function of injected time: the instant at which this room
   * is dead weight, or null while something still holds it open. The room neither reads a clock
   * nor sets a timer -- `RoomManager.sweep(now)` decides when to look.
   *
   * - `lobby`: nobody connected in it, so nothing is lost. Short TTL.
   * - `playing`: measured from the last moment any seat was connected, because that retention
   *   *is* the reconnect window. The constructor guarantees it outlasts the disconnect grace, so
   *   a seat that was handed to a bot still has a room to come back to.
   * - `finished`: kept for clients still reading the result. The transport drops it earlier by
   *   calling `RoomManager.remove` once the result is acknowledged.
   */
  evictableAt(): number | null {
    if (this.status === 'finished') {
      return (this.finishedAt ?? this.clock ?? 0) + this.timing.finishedTtlMs;
    }
    let lastPresence: number | null = null;
    for (const seat of PLAYERS) {
      const member = this.seats[seat];
      if (!member) continue;
      // A seat the transport never reported on counts as present: keeping a live room is the
      // right way to be wrong.
      if (member.disconnectedAt == null) return null;
      lastPresence = Math.max(lastPresence ?? member.disconnectedAt, member.disconnectedAt);
    }
    const base = lastPresence ?? this.clock ?? 0;
    return (
      base +
      (this.status === 'playing' ? this.timing.playingRetentionMs : this.timing.emptyLobbyTtlMs)
    );
  }

  /** The deadline the room is currently waiting on, or null when nothing is on the clock. */
  get currentDeadline(): RoomDeadline | null {
    return this.deadline;
  }

  /** The invariant that killed this room, or null while it is healthy. */
  get fault(): string | null {
    return this.faultReason;
  }

  /**
   * Turns a failed invariant into a dead room rather than a dead process. In-memory, throwing was
   * the right instinct: nothing downstream can trust a room whose engine rejected a server action.
   * Behind a socket the same throw unwinds through whatever is pumping every other room, so the
   * blast radius has to stop at this object.
   */
  private fail(error: unknown): void {
    if (this.faultReason === null) {
      this.faultReason = error instanceof Error ? error.message : String(error);
    }
    this.status = 'faulted';
    this.deadline = null;
    this.deadlineKey = '';
    this.reaction = null;
  }

  /**
   * Advances injected time. Fires at most one expiry per call: an expiry restarts the window from
   * `now`, so the seat that inherits the turn gets a full one rather than an already-dead clock.
   */
  tick(now: number): void {
    if (this.faultReason !== null) return;
    this.advanceClock(now);
    try {
      if (this.takeOverDisconnectedSeats()) this.settle();
      if (this.deadline !== null && this.clock! >= this.deadline.expiresAt) this.expireDeadline();
      this.syncDeadline();
      this.trimTransitions();
    } catch (error) {
      this.fail(error);
    }
  }

  /**
   * Presence, as reported by the transport. Deliberately does not bump the version: a bump would
   * invalidate every in-flight `expectedVersion`, and during a reaction window it would break the
   * barrier, whose `phaseVersion` is what keeps all four seats answering the same question.
   */
  setConnected(auth: SeatAuth, connected: boolean, now: number): void {
    if (this.faultReason !== null) return;
    this.advanceClock(now);
    // Presence moves a seat on and off the bot, so an unauthenticated report is a takeover lever.
    const seat = this.authenticate(auth);
    if (seat === null) return;
    const member = this.seats[seat]!;
    this.seats = replaceSeat(this.seats, seat, {
      ...member,
      // A taken-over seat stays reclaimable: coming back takes it off the bot.
      bot: connected ? null : (member.bot ?? null),
      disconnectedAt: connected ? null : (member.disconnectedAt ?? this.clock ?? 0),
    });
    if (connected) this.consecutiveExpiries[seat] = 0;
    this.syncDeadline();
  }

  submit(auth: SeatAuth, envelope: CommandEnvelope, now?: number): CommandReceipt {
    if (this.faultReason === null) {
      try {
        return this.runCommand(auth, envelope, now);
      } catch (error) {
        this.fail(error);
      }
    }
    return this.failure(envelope.commandId, 'ROOM_FAULTED', `Room is faulted: ${this.faultReason}`);
  }

  private runCommand(auth: SeatAuth, envelope: CommandEnvelope, now?: number): CommandReceipt {
    this.advanceClock(now);
    // Authenticated before the idempotency cache is consulted: a cached receipt is still a fact
    // about someone else's seat, and an unproven caller has no business reaching the map.
    const seat = this.findSeat(auth.clientId);
    if (seat === null) {
      return this.failure(envelope.commandId, 'UNKNOWN_CLIENT', 'Client is not seated in this room');
    }
    if (!tokensMatch(this.seats[seat]!.token, auth.token)) {
      return this.failure(envelope.commandId, 'INVALID_TOKEN', 'Join token does not match this seat');
    }

    const key = `${auth.clientId}\u0000${envelope.commandId}`;
    const cached = this.processed.get(key);
    if (cached) return { ...cached, duplicate: true };
    if (envelope.expectedVersion !== this.version) {
      return this.failure(
        envelope.commandId,
        'STALE_VERSION',
        `Expected room version ${this.version}, received ${envelope.expectedVersion}`,
      );
    }

    let receipt: CommandReceipt;
    switch (envelope.command.type) {
      case 'set-ready':
        receipt = this.setReady(seat, envelope.commandId, envelope.command.ready);
        break;
      case 'start-round':
        receipt = this.startMatch(auth.clientId, envelope.commandId);
        break;
      case 'advance-round':
        receipt = this.advanceRound(envelope.commandId);
        break;
      case 'pass':
        receipt = this.passReaction(seat, envelope.commandId);
        break;
      case 'round-action':
        receipt = this.submitRoundAction(seat, envelope.commandId, envelope.command.action as RoundAction);
        break;
    }

    if (receipt.ok) {
      // A client that just acted is present, so it takes its seat back off the bot.
      this.reclaimSeat(seat);
      this.remember(key, receipt);
    }
    this.syncDeadline();
    return receipt;
  }

  /**
   * The seat's own view when the credential checks out. A wrong or missing token does not throw:
   * it falls back to the spectator projection, which is public by construction, so a bad claim
   * gets a safe view rather than a leak.
   */
  viewFor(auth: SeatAuth | null = null): RoomView {
    const viewerSeat = this.authenticate(auth);
    return projectRoom({
      roomId: this.id,
      status: this.status,
      version: this.version,
      hostClientId: this.hostClientId,
      seats: this.seats,
      match: this.match,
      round: this.round,
      viewerSeat,
      respondedSeats: this.reaction?.respondedSeats,
      deadline: this.deadline,
    });
  }

  /** Same rule as `viewFor`: an unproven claim is served the spectator tail, never the seat's. */
  /**
   * The oldest version the catch-up log still reaches back to. A caller resuming from anything
   * older than this has a hole and must fall back to the snapshot.
   *
   * This is stated rather than inferred on purpose. `publicEventsSince` is a plain filter and
   * cannot tell "nothing happened" apart from "it was trimmed", and deducing the difference from
   * contiguous versions would break silently the day a transition stops bumping by exactly one.
   */
  get oldestRetainedVersion(): number {
    return this.transitions[0]?.version ?? this.version;
  }

  publicEventsSince(
    auth: SeatAuth | null,
    afterVersion: number,
  ): Array<{ version: number; events: PublicEngineEvent[] }> {
    const viewerSeat = this.authenticate(auth);
    return this.transitions
      .filter((transition) => transition.version > afterVersion)
      .map((transition) => ({
        version: transition.version,
        events: transition.events
          .map((event) => projectEngineEvent(event, viewerSeat))
          .filter((event): event is PublicEngineEvent => event !== null),
      }));
  }

  checkpoint(): RoomCheckpoint {
    const reaction: ReactionBarrierCheckpoint | null = this.reaction
      ? {
          phaseVersion: this.reaction.phaseVersion,
          eligibleSeats: [...this.reaction.eligibleSeats],
          respondedSeats: [...this.reaction.respondedSeats],
        }
      : null;
    return {
      id: this.id,
      status: this.status,
      version: this.version,
      hostClientId: this.hostClientId,
      seats: this.seats,
      seed: this.seed,
      match: this.match,
      reaction,
    };
  }

  private get round(): RoundState | null {
    return this.match?.round ?? null;
  }

  private setReady(seat: PlayerIndex, commandId: string, ready: boolean): CommandReceipt {
    if (this.status !== 'lobby') {
      return this.failure(commandId, 'ROOM_NOT_LOBBY', 'Ready state can only change in the lobby');
    }
    const member = this.seats[seat]!;
    if (member.ready !== ready) {
      this.seats = replaceSeat(this.seats, seat, { ...member, ready });
      this.bumpVersion([]);
    }
    return this.success(commandId);
  }

  private startMatch(clientId: ClientId, commandId: string): CommandReceipt {
    if (this.status !== 'lobby') {
      return this.failure(commandId, 'ROOM_NOT_LOBBY', 'The room already left the lobby');
    }
    if (clientId !== this.hostClientId) {
      return this.failure(commandId, 'HOST_ONLY', 'Only the room host may start the round');
    }
    if (this.seats.some((member) => member === null || !member.ready)) {
      return this.failure(commandId, 'NOT_READY', 'All four occupied seats must be ready');
    }

    this.match = createSeededMatch(this.seed);
    this.status = 'playing';
    this.bumpVersion([]);
    this.settle();
    return this.success(commandId);
  }

  /** Mirrors `continueSingleGame`: an explicit command starts the next hand of the hanchan. */
  private advanceRound(commandId: string): CommandReceipt {
    if (this.status !== 'playing' || this.match === null) {
      return this.failure(commandId, 'ROOM_NOT_PLAYING', 'No active match exists');
    }
    if (this.match.round.phase.kind !== 'ended') {
      return this.failure(commandId, 'ROUND_NOT_ENDED', 'The current hand is still in progress');
    }
    const advanced = advanceSeededMatch(this.match, this.seed);
    if (!advanced.ok) {
      return this.failure(commandId, 'ROUND_NOT_ENDED', advanced.message);
    }
    this.commitMatch(advanced.state, []);
    this.settle();
    return this.success(commandId);
  }

  private submitRoundAction(seat: PlayerIndex, commandId: string, action: RoundAction): CommandReceipt {
    const round = this.round;
    if (this.status !== 'playing' || round === null) {
      return this.failure(commandId, 'ROOM_NOT_PLAYING', 'No active round exists');
    }
    if (action.type === 'resolve-reactions') {
      return this.failure(commandId, 'SERVER_ONLY', 'Reaction resolution is server-owned');
    }
    if (action.player !== seat) {
      return this.failure(commandId, 'WRONG_SEAT', 'Action player does not match authenticated seat');
    }

    if (isReactionPhase(round)) {
      if (!isReactionRoundAction(action)) {
        return this.failure(commandId, 'NOT_REACTION_PHASE', 'Only a legal reaction or pass is accepted now');
      }
      const barrierError = this.validateReactionSeat(seat, commandId);
      if (barrierError) return barrierError;

      const result = applyAction(round, action);
      if (!result.ok) return this.engineFailure(commandId, result);
      this.match = { ...this.match!, round: result.state };
      this.reaction!.respondedSeats.add(seat);
      this.resolveReactionIfComplete();
      return this.success(commandId);
    }

    const result = applyAction(round, action);
    if (!result.ok) return this.engineFailure(commandId, result);
    this.commitMatch({ ...this.match!, round: result.state }, result.events);
    this.settle();
    return this.success(commandId);
  }

  private passReaction(seat: PlayerIndex, commandId: string): CommandReceipt {
    const round = this.round;
    if (this.status !== 'playing' || round === null) {
      return this.failure(commandId, 'ROOM_NOT_PLAYING', 'No active round exists');
    }
    if (!isReactionPhase(round)) {
      return this.failure(commandId, 'NOT_REACTION_PHASE', 'Pass is only valid during a reaction window');
    }
    const barrierError = this.validateReactionSeat(seat, commandId);
    if (barrierError) return barrierError;
    this.reaction!.respondedSeats.add(seat);
    this.resolveReactionIfComplete();
    return this.success(commandId);
  }

  private validateReactionSeat(seat: PlayerIndex, commandId: string): CommandReceipt | null {
    if (!this.reaction || this.reaction.phaseVersion !== this.version) {
      return this.failure(commandId, 'NOT_REACTION_PHASE', 'No response barrier exists for this version');
    }
    if (!this.reaction.eligibleSeats.has(seat)) {
      return this.failure(commandId, 'NOT_ELIGIBLE', 'This seat has no legal reaction in the current window');
    }
    if (this.reaction.respondedSeats.has(seat)) {
      return this.failure(commandId, 'ALREADY_RESPONDED', 'This seat already answered the current reaction window');
    }
    return null;
  }

  private reactionComplete(): boolean {
    if (!this.reaction) return false;
    for (const seat of this.reaction.eligibleSeats) {
      if (!this.reaction.respondedSeats.has(seat)) return false;
    }
    return true;
  }

  private resolveReactionIfComplete(): void {
    if (!this.match || !this.reactionComplete()) return;
    this.reaction = null;
    this.applyServerAction({ type: 'resolve-reactions' });
    this.settle();
  }

  /**
   * Applies every transition no seat has a choice about — draws, the forced Riichi tsumogiri and
   * an empty reaction window — then leaves the room waiting on a real decision. Same decisions as
   * `driveSingleGame`, via the shared helpers, so the two orchestrators cannot drift.
   */
  private settle(): void {
    for (let step = 0; step < MAX_SETTLE_STEPS; step++) {
      const round = this.round;
      if (round === null || round.phase.kind === 'ended') {
        this.reaction = null;
        return;
      }

      if (isReactionPhase(round)) {
        if (!this.reaction || this.reaction.phaseVersion !== this.version) {
          this.reaction = {
            phaseVersion: this.version,
            eligibleSeats: new Set(reactionEligibleSeats(round)),
            respondedSeats: new Set(),
          };
        }
        this.answerReactionsWithBots();
        if (!this.reactionComplete()) return;
        this.reaction = null;
        this.applyServerAction({ type: 'resolve-reactions' });
        continue;
      }

      this.reaction = null;
      const phase = round.phase;
      if (phase.kind !== 'awaiting-draw' && phase.kind !== 'awaiting-discard') return;
      const forced = forcedSeatAction(round, phase.player);
      if (forced) {
        this.applyServerAction(forced);
        continue;
      }
      const decision = this.botDecision(round, phase.player);
      // A bot that passes on its own turn has nothing legal to add: leave the seat on the clock.
      if (!decision) return;
      this.applyServerAction(decision);
    }
    throw new Error('Server invariant: the room did not settle on a decision');
  }

  private botProfile(seat: PlayerIndex): BotDifficulty | null {
    return this.seats[seat]?.bot?.profile ?? null;
  }

  /** The bot's action for a seat it holds, or null when it holds none or has nothing to play. */
  private botDecision(round: RoundState, seat: PlayerIndex): RoundAction | null {
    const profile = this.botProfile(seat);
    if (!profile) return null;
    const decision = chooseBotDecisionForDifficulty(round, seat, profile);
    if (decision.type !== 'action' || decision.action.type === 'resolve-reactions') return null;
    return decision.action;
  }

  /** Answers the open reaction window for every bot-held seat, exactly as those clients would. */
  private answerReactionsWithBots(): void {
    const barrier = this.reaction;
    if (!barrier) return;
    for (const seat of barrier.eligibleSeats) {
      if (barrier.respondedSeats.has(seat)) continue;
      if (this.botProfile(seat) === null) continue;
      const action = this.botDecision(this.round!, seat);
      if (action) {
        const result = applyAction(this.round!, action);
        // An illegal bot claim degrades to a pass rather than killing the room.
        if (result.ok) this.match = { ...this.match!, round: result.state };
      }
      barrier.respondedSeats.add(seat);
    }
  }

  private advanceClock(now?: number): void {
    if (now === undefined) return;
    if (!Number.isFinite(now)) throw new Error('Injected time must be a finite number');
    if (this.clock === null || now > this.clock) this.clock = now;
  }

  /**
   * Restarts the window whenever the room begins waiting on something new. A reaction window does
   * not bump the version, so its key is stable across claims and passes and all eligible seats
   * share one clock.
   */
  private syncDeadline(): void {
    const phase = this.round?.phase;
    let kind: RoomDeadline['kind'] | null = null;
    if (this.clock !== null && this.status === 'playing' && phase) {
      if (phase.kind === 'reactions' || phase.kind === 'kan-reactions') kind = 'reaction';
      else if (phase.kind === 'awaiting-draw' || phase.kind === 'awaiting-discard') kind = 'turn';
    }
    if (kind === null) {
      this.deadline = null;
      this.deadlineKey = '';
      return;
    }
    const key = `${this.version}:${kind}`;
    if (this.deadline !== null && key === this.deadlineKey) return;
    this.deadlineKey = key;
    this.deadline = {
      kind,
      expiresAt: this.clock! + (kind === 'reaction' ? this.timing.reactionMs : this.timing.turnMs),
    };
  }

  /**
   * Section 7 defaults. A reaction window auto-passes, because an auto-win is irreversible and a
   * seat may be passing on purpose to stay out of Furiten. A turn draws if a draw is pending and
   * then tsumogiri, which is what `single.ts` already does with a forced discard.
   */
  private expireDeadline(): void {
    if (this.deadline === null || this.round === null) return;
    if (this.deadline.kind === 'reaction') {
      const barrier = this.reaction;
      if (!barrier) return;
      for (const seat of barrier.eligibleSeats) {
        if (barrier.respondedSeats.has(seat)) continue;
        // Deliberately NOT counted toward takeover. Letting a reaction window lapse is ordinary
        // play -- a seat that does not want the call simply ignores the prompt, and the outcome
        // is identical to pressing Pass. Only a lapsed turn means a seat has stopped playing.
        // Identical to a human pass: no engine action, the barrier just stops waiting.
        barrier.respondedSeats.add(seat);
      }
      this.resolveReactionIfComplete();
      return;
    }
    const phase = this.round.phase;
    if (phase.kind !== 'awaiting-draw' && phase.kind !== 'awaiting-discard') return;
    const seat = phase.player;
    this.countExpiry(seat);
    this.expireTurn(seat);
    this.settle();
  }

  private expireTurn(seat: PlayerIndex): void {
    if (this.round!.phase.kind === 'awaiting-draw') {
      this.applyServerAction({ type: 'draw', player: seat });
    }
    const phase = this.round!.phase;
    if (phase.kind !== 'awaiting-discard') return;
    const legal = getLegalActions(this.round!, seat).find((action) => action.type === 'discard');
    if (legal?.type !== 'discard' || legal.tileIds.length === 0) return;
    // Section 7 says tsumogiri the drawn tile; after a Chi or Pon there is no drawn tile, so the
    // last discardable tile stands in for it.
    const drawn = phase.drawnTileId;
    const tileId =
      drawn !== null && legal.tileIds.includes(drawn)
        ? drawn
        : legal.tileIds[legal.tileIds.length - 1];
    this.applyServerAction({ type: 'discard', player: seat, tileId });
  }

  private countExpiry(seat: PlayerIndex): void {
    if (this.botProfile(seat) !== null) return;
    this.consecutiveExpiries[seat] += 1;
    if (this.consecutiveExpiries[seat] >= this.timing.expiriesBeforeTakeover) this.takeSeat(seat);
  }

  private takeSeat(seat: PlayerIndex): boolean {
    const member = this.seats[seat];
    if (!member || member.bot) return false;
    this.seats = replaceSeat(this.seats, seat, {
      ...member,
      bot: { profile: TAKEOVER_PROFILE, sinceVersion: this.version },
    });
    return true;
  }

  private reclaimSeat(seat: PlayerIndex): void {
    this.consecutiveExpiries[seat] = 0;
    const member = this.seats[seat];
    if (!member || (!member.bot && member.disconnectedAt == null)) return;
    this.seats = replaceSeat(this.seats, seat, { ...member, bot: null, disconnectedAt: null });
  }

  private takeOverDisconnectedSeats(): boolean {
    let changed = false;
    for (const seat of PLAYERS) {
      const member = this.seats[seat];
      if (!member || member.bot || member.disconnectedAt == null) continue;
      if (this.clock === null) return changed;
      if (this.clock - member.disconnectedAt < this.timing.disconnectGraceMs) continue;
      changed = this.takeSeat(seat) || changed;
    }
    return changed;
  }

  /**
   * The catch-up log is presentation only, and its bound is the disconnect window: past it the
   * seat is bot-held and a returning client resumes from a fresh snapshot instead of a tail.
   */
  private trimTransitions(): void {
    if (this.clock === null) return;
    const oldest = this.clock - this.timing.disconnectGraceMs;
    let cut = 0;
    while (cut < this.transitions.length - 1 && this.transitions[cut].at < oldest) cut += 1;
    if (cut > 0) this.transitions = this.transitions.slice(cut);
  }

  private applyServerAction(action: RoundAction): void {
    const result = applyAction(this.round!, action);
    if (!result.ok) {
      throw new Error(`Server invariant: ${action.type} failed: ${result.error.code} ${result.error.message}`);
    }
    this.commitMatch({ ...this.match!, round: result.state }, result.events);
  }

  private commitMatch(state: MatchState, events: readonly RoundEvent[]): void {
    this.match = state;
    // A finished hand is not a finished room: the hanchan ends only when the match does.
    if (state.status === 'ended') {
      this.status = 'finished';
      this.finishedAt ??= this.clock ?? 0;
    }
    this.bumpVersion(events);
  }

  private bumpVersion(events: readonly RoundEvent[]): void {
    this.version += 1;
    this.transitions.push({ version: this.version, at: this.clock ?? 0, events });
  }

  /**
   * The seat this credential owns, or null. Both halves are required: `clientId` picks the seat,
   * the token proves it. Every read and write path that used to trust a bare `clientId` routes
   * through here, so there is one place to get it right instead of five.
   */
  private authenticate(auth: SeatAuth | null): PlayerIndex | null {
    if (!auth) return null;
    const seat = this.findSeat(auth.clientId);
    if (seat === null) return null;
    return tokensMatch(this.seats[seat]!.token, auth.token) ? seat : null;
  }

  private findSeat(clientId: ClientId): PlayerIndex | null {
    for (const seat of PLAYERS) {
      if (this.seats[seat]?.clientId === clientId) return seat;
    }
    return null;
  }

  private success(commandId: string): Extract<CommandReceipt, { ok: true }> {
    return { ok: true, commandId, version: this.version, duplicate: false };
  }

  private failure(
    commandId: string,
    code: CommandErrorCode,
    message: string,
    engineCode?: string,
  ): Extract<CommandReceipt, { ok: false }> {
    return {
      ok: false,
      commandId,
      version: this.version,
      code,
      message,
      ...(engineCode ? { engineCode } : {}),
    };
  }

  private engineFailure(
    commandId: string,
    result: Extract<ApplyActionResult, { ok: false }>,
  ): Extract<CommandReceipt, { ok: false }> {
    return this.failure(commandId, 'ENGINE_REJECTED', result.error.message, result.error.code);
  }

  private remember(key: string, receipt: Extract<CommandReceipt, { ok: true }>): void {
    this.processed.set(key, receipt);
    this.processedOrder.push(key);
    // Receipt versions are non-decreasing in insertion order, so the front of the queue is oldest.
    const cutoff = this.version - COMMAND_VERSION_WINDOW;
    while (this.processedOrder.length > 0) {
      const oldest = this.processedOrder[0];
      const entry = this.processed.get(oldest);
      if (entry && entry.version >= cutoff) break;
      this.processedOrder.shift();
      this.processed.delete(oldest);
    }
  }
}
