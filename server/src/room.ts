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

export interface RoomTiming {
  /** Window for a real decision on `awaiting-draw` / `awaiting-discard`. */
  turnMs: number;
  /** Shorter window for `reactions` / `kan-reactions`, which every eligible seat shares. */
  reactionMs: number;
  /** Consecutive expiries on one seat before a bot takes it. */
  expiriesBeforeTakeover: number;
  /** Disconnect length before a bot takes the seat, and the age at which the catch-up log is trimmed. */
  disconnectGraceMs: number;
}

export const DEFAULT_ROOM_TIMING: RoomTiming = {
  turnMs: 20_000,
  reactionMs: 8_000,
  expiriesBeforeTakeover: 3,
  disconnectGraceMs: 60_000,
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
  /** `version:kind` of the wait the current deadline belongs to; a new wait resets the window. */
  private deadlineKey = '';
  private consecutiveExpiries: number[] = [0, 0, 0, 0];

  /** The seed never leaves the server: a client that picked it could derive the whole wall. */
  constructor(
    id: RoomId,
    seed: number = Math.floor(Math.random() * 0x7fffffff),
    timing: Partial<RoomTiming> = {},
  ) {
    if (!id.trim()) throw new Error('Room ID must not be empty');
    if (!Number.isFinite(seed)) throw new Error('Room seed must be a finite number');
    this.id = id;
    this.seed = Math.trunc(seed);
    this.timing = { ...DEFAULT_ROOM_TIMING, ...timing };
    for (const value of [this.timing.turnMs, this.timing.reactionMs, this.timing.disconnectGraceMs]) {
      if (!(value > 0)) throw new Error('Room timing windows must be positive');
    }
  }

  static restore(checkpoint: RoomCheckpoint, timing: Partial<RoomTiming> = {}): AuthoritativeRoom {
    const round = checkpoint.match?.round ?? null;
    if (round && isReactionPhase(round) && !checkpoint.reaction) {
      // Rebuilding it would forget every response already given, including passes.
      throw new Error('Checkpoint in a reaction phase must carry its reaction barrier');
    }
    const room = new AuthoritativeRoom(checkpoint.id, checkpoint.seed, timing);
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

  join(clientId: ClientId, displayName: string, preferredSeat?: PlayerIndex): JoinResult {
    const existing = this.findSeat(clientId);
    if (existing !== null) {
      // Re-joining is a return: the seat comes back off the bot even without a presence report.
      this.reclaimSeat(existing);
      return { ok: true, seat: existing, version: this.version };
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
      displayName: displayName.trim() || `Player ${seat + 1}`,
      ready: false,
    };
    this.seats = replaceSeat(this.seats, seat, member);
    if (this.hostClientId === null) this.hostClientId = clientId;
    this.bumpVersion([]);
    return { ok: true, seat, version: this.version };
  }

  /** The deadline the room is currently waiting on, or null when nothing is on the clock. */
  get currentDeadline(): RoomDeadline | null {
    return this.deadline;
  }

  /**
   * Advances injected time. Fires at most one expiry per call: an expiry restarts the window from
   * `now`, so the seat that inherits the turn gets a full one rather than an already-dead clock.
   */
  tick(now: number): void {
    this.advanceClock(now);
    if (this.takeOverDisconnectedSeats()) this.settle();
    if (this.deadline !== null && this.clock! >= this.deadline.expiresAt) this.expireDeadline();
    this.syncDeadline();
    this.trimTransitions();
  }

  /**
   * Presence, as reported by the transport. Deliberately does not bump the version: a bump would
   * invalidate every in-flight `expectedVersion`, and during a reaction window it would break the
   * barrier, whose `phaseVersion` is what keeps all four seats answering the same question.
   */
  setConnected(clientId: ClientId, connected: boolean, now: number): void {
    this.advanceClock(now);
    const seat = this.findSeat(clientId);
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

  submit(clientId: ClientId, envelope: CommandEnvelope, now?: number): CommandReceipt {
    this.advanceClock(now);
    const key = `${clientId}\u0000${envelope.commandId}`;
    const cached = this.processed.get(key);
    if (cached) return { ...cached, duplicate: true };

    const seat = this.findSeat(clientId);
    if (seat === null) {
      return this.failure(envelope.commandId, 'UNKNOWN_CLIENT', 'Client is not seated in this room');
    }
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
        receipt = this.startMatch(clientId, envelope.commandId);
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

  viewFor(clientId: ClientId | null = null): RoomView {
    const viewerSeat = clientId === null ? null : this.findSeat(clientId);
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

  publicEventsSince(clientId: ClientId | null, afterVersion: number): Array<{ version: number; events: PublicEngineEvent[] }> {
    const viewerSeat = clientId === null ? null : this.findSeat(clientId);
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
    if (state.status === 'ended') this.status = 'finished';
    this.bumpVersion(events);
  }

  private bumpVersion(events: readonly RoundEvent[]): void {
    this.version += 1;
    this.transitions.push({ version: this.version, at: this.clock ?? 0, events });
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
