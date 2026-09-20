import { describe, expect, it } from 'vitest';
import { RoomManager } from './roomManager';

const AMBIGUOUS = ['I', 'L', 'O', 'U', '0', '1'];

describe('room code allocation', () => {
  it('allocates a distinct code per room, drawn from the unambiguous alphabet', () => {
    const manager = new RoomManager();
    const codes = new Set<string>();

    for (let index = 0; index < 200; index++) {
      const room = manager.allocate();
      expect(room.id).toHaveLength(6);
      for (const character of room.id) expect(AMBIGUOUS).not.toContain(character);
      expect(codes.has(room.id)).toBe(false);
      codes.add(room.id);
    }
  });

  it('retries past a collision instead of throwing', () => {
    // A random source that yields the same code twice, then moves on.
    const values = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5];
    let call = 0;
    const manager = new RoomManager(() => values[Math.min(call++, values.length - 1)]!);

    const first = manager.allocate();
    const second = manager.allocate();
    expect(second.id).not.toBe(first.id);
    expect(manager.list()).toHaveLength(2);
  });

  it('gives up rather than spinning forever when every code is taken', () => {
    const manager = new RoomManager(() => 0);
    manager.allocate();
    expect(() => manager.allocate()).toThrow(/allocate/i);
  });

  it('looks a code up however it was typed', () => {
    const manager = new RoomManager();
    const room = manager.allocate();

    expect(manager.get(room.id.toLowerCase())?.id).toBe(room.id);
    expect(manager.remove(room.id.toLowerCase())).toBe(true);
    expect(manager.get(room.id)).toBeNull();
  });
});
