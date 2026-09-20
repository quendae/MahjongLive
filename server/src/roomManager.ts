import { AuthoritativeRoom } from './room';
import type { RoomId } from './protocol';

/**
 * Codes are read aloud and typed in by hand, so the alphabet drops the six characters that
 * get transcribed wrongly: I, L, O and U, and the digits 0 and 1. At this scale ambiguity
 * costs more than length does.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 6;
const MAX_ALLOCATION_ATTEMPTS = 32;

/** Codes are compared case-insensitively, so a player typing a lowercase code still lands. */
function normalize(roomId: RoomId): RoomId {
  return roomId.toUpperCase();
}

export class RoomManager {
  private rooms = new Map<RoomId, AuthoritativeRoom>();

  // ponytail: Math.random is fine because the code is a lookup handle, not a credential --
  // seat identity is meant to be established by a join token. Swap in a CSPRNG if a code
  // ever becomes the only thing standing between a stranger and a seat.
  constructor(private readonly random: () => number = Math.random) {}

  /** Allocates an unused room code. Prefer this over inventing ids at the call site. */
  allocate(seed?: number): AuthoritativeRoom {
    for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt++) {
      let code = '';
      for (let index = 0; index < CODE_LENGTH; index++) {
        code += CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)];
      }
      if (code.length === CODE_LENGTH && !this.rooms.has(code)) return this.create(code, seed);
    }
    throw new Error('Could not allocate an unused room code');
  }

  create(roomId: RoomId, seed?: number): AuthoritativeRoom {
    const id = normalize(roomId);
    if (this.rooms.has(id)) throw new Error(`Room already exists: ${id}`);
    const room = new AuthoritativeRoom(id, seed);
    this.rooms.set(id, room);
    return room;
  }

  get(roomId: RoomId): AuthoritativeRoom | null {
    return this.rooms.get(normalize(roomId)) ?? null;
  }

  list(): readonly RoomId[] {
    return [...this.rooms.keys()];
  }

  remove(roomId: RoomId): boolean {
    return this.rooms.delete(normalize(roomId));
  }

  restore(room: AuthoritativeRoom): void {
    const id = normalize(room.id);
    if (this.rooms.has(id)) throw new Error(`Room already exists: ${id}`);
    this.rooms.set(id, room);
  }
}
