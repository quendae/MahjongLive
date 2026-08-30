import { AuthoritativeRoom } from './room';
import type { RoomId } from './protocol';

export class RoomManager {
  private rooms = new Map<RoomId, AuthoritativeRoom>();

  create(roomId: RoomId): AuthoritativeRoom {
    if (this.rooms.has(roomId)) throw new Error(`Room already exists: ${roomId}`);
    const room = new AuthoritativeRoom(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  get(roomId: RoomId): AuthoritativeRoom | null {
    return this.rooms.get(roomId) ?? null;
  }

  list(): readonly RoomId[] {
    return [...this.rooms.keys()];
  }

  remove(roomId: RoomId): boolean {
    return this.rooms.delete(roomId);
  }

  restore(room: AuthoritativeRoom): void {
    if (this.rooms.has(room.id)) throw new Error(`Room already exists: ${room.id}`);
    this.rooms.set(room.id, room);
  }
}
