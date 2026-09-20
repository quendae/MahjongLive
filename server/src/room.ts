import { applyAction } from '@mahjong-live/shared/rules';
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
  RoomId,
  RoomMember,
  RoomSeats,
  RoomStatus,
  RoomTransition,
  RoomView,
} from './protocol';

const PLAYERS: readonly PlayerIndex[] = [0, 1, 2, 3];
const MAX_PROCESSED_COMMANDS = 256;
/** A settle pass only chains draws, forced discards and empty reaction windows. */
const MAX_SETTLE_STEPS = 64;

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

  /** The seed never leaves the server: a client that picked it could derive the whole wall. */
  constructor(id: RoomId, seed: number = Math.floor(Math.random() * 0x7fffffff)) {
    if (!id.trim()) throw new Error('Room ID must not be empty');
    if (!Number.isFinite(seed)) throw new Error('Room seed must be a finite number');
    this.id = id;
    this.seed = Math.trunc(seed);
  }

  static restore(checkpoint: RoomCheckpoint): AuthoritativeRoom {
    const round = checkpoint.match?.round ?? null;
    if (round && isReactionPhase(round) && !checkpoint.reaction) {
      // Rebuilding it would forget every response already given, including passes.
      throw new Error('Checkpoint in a reaction phase must carry its reaction barrier');
    }
    const room = new AuthoritativeRoom(checkpoint.id, checkpoint.seed);
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
    if (existing !== null) return { ok: true, seat: existing, version: this.version };
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

  submit(clientId: ClientId, envelope: CommandEnvelope): CommandReceipt {
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

    if (receipt.ok) this.remember(key, receipt);
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

  private resolveReactionIfComplete(): void {
    if (!this.reaction || !this.match) return;
    for (const seat of this.reaction.eligibleSeats) {
      if (!this.reaction.respondedSeats.has(seat)) return;
    }
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
        if (this.reaction.eligibleSeats.size > 0) return;
        this.reaction = null;
        this.applyServerAction({ type: 'resolve-reactions' });
        continue;
      }

      this.reaction = null;
      const phase = round.phase;
      if (phase.kind !== 'awaiting-draw' && phase.kind !== 'awaiting-discard') return;
      const forced = forcedSeatAction(round, phase.player);
      if (!forced) return;
      this.applyServerAction(forced);
    }
    throw new Error('Server invariant: the room did not settle on a decision');
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
    this.transitions.push({ version: this.version, events });
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
    while (this.processedOrder.length > MAX_PROCESSED_COMMANDS) {
      const oldest = this.processedOrder.shift();
      if (oldest) this.processed.delete(oldest);
    }
  }
}
