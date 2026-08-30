import { describe, it, expect } from 'vitest';
import {
  build136Tiles, buildWall, drawTile, drawRinshan, revealKanDora, remainingDraws, doraFromIndicator,
} from './wall';
import { createRNG } from './prng';
import { suited, wind, dragon, tileTypeKey } from '../tiles/tiles';

describe('build136Tiles', () => {
  it('creates exactly 136 tiles', () => {
    expect(build136Tiles().length).toBe(136);
  });

  it('assigns one stable physical ID to every wall tile', () => {
    const ids = build136Tiles().map((tile) => tile.id);
    expect(ids.every((id) => typeof id === 'number')).toBe(true);
    expect(new Set(ids).size).toBe(136);
    expect([...ids].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: 136 }, (_, index) => index),
    );
  });

  it('creates exactly one red five per suit', () => {
    const redFives = build136Tiles().filter(
      (t) => t.kind === 'suited' && t.rank === 5 && t.isRed
    );
    expect(redFives.length).toBe(3);
  });

  it('creates exactly 4 copies of every tile type', () => {
    const counts = new Map<string, number>();
    for (const t of build136Tiles()) {
      counts.set(tileTypeKey(t), (counts.get(tileTypeKey(t)) ?? 0) + 1);
    }
    expect(counts.size).toBe(34);
    expect([...counts.values()].every((c) => c === 4)).toBe(true);
  });
});

describe('buildWall', () => {
  it('splits 136 tiles into a 14-tile dead wall and a 122-tile live wall', () => {
    const wall = buildWall(createRNG(1));
    expect(wall.deadWall.length).toBe(14);
    expect(wall.liveWall.length).toBe(122);
  });

  it('starts with exactly one revealed dora indicator, taken from the dead wall', () => {
    const wall = buildWall(createRNG(1));
    expect(wall.doraIndicators.length).toBe(1);
    expect(wall.doraIndicators[0]).toBe(wall.deadWall[0]);
  });

  it('produces the same shuffled wall for the same seed', () => {
    const a = buildWall(createRNG(7));
    const b = buildWall(createRNG(7));
    expect(a.liveWall.map(tileTypeKey)).toEqual(b.liveWall.map(tileTypeKey));
    expect(a.liveWall.map((tile) => tile.id)).toEqual(b.liveWall.map((tile) => tile.id));
  });
});

describe('drawTile', () => {
  it('returns the front tile and shrinks the live wall by one, without mutating the input', () => {
    const wall = buildWall(createRNG(1));
    const before = wall.liveWall.length;
    const frontTile = wall.liveWall[0];
    const { tile, wall: after } = drawTile(wall);
    expect(tile).toBe(frontTile);
    expect(after.liveWall.length).toBe(before - 1);
    expect(wall.liveWall.length).toBe(before);
  });

  it('throws when the live wall is empty', () => {
    const empty = { liveWall: [], deadWall: [], doraIndicators: [] };
    expect(() => drawTile(empty)).toThrow();
  });
});

describe('drawRinshan', () => {
  it('draws dead-wall slot 10, replenishes from the live-wall tail and preserves 14 dead tiles', () => {
    const wall = buildWall(createRNG(11));
    const expected = wall.deadWall[10];
    const replacement = wall.liveWall[wall.liveWall.length - 1];
    const beforeIds = [
      ...wall.liveWall.map((tile) => tile.id),
      ...wall.deadWall.map((tile) => tile.id),
    ];

    const draw = drawRinshan(wall);
    expect(draw.tile).toBe(expected);
    expect(draw.wall.liveWall).toHaveLength(wall.liveWall.length - 1);
    expect(draw.wall.deadWall).toHaveLength(14);
    expect(draw.wall.deadWall[13]).toBe(replacement);
    expect(wall.deadWall).toHaveLength(14);

    const afterIds = [
      draw.tile.id,
      ...draw.wall.liveWall.map((tile) => tile.id),
      ...draw.wall.deadWall.map((tile) => tile.id),
    ];
    expect(new Set(afterIds).size).toBe(afterIds.length);
    expect(new Set(afterIds)).toEqual(new Set(beforeIds));
  });

  it('consumes the original four Rinshan slots in order across repeated draws', () => {
    const wall = buildWall(createRNG(12));
    const expected = wall.deadWall.slice(10, 14);
    let current = wall;
    const drawn = [];
    for (let i = 0; i < 4; i++) {
      const result = drawRinshan(current);
      drawn.push(result.tile);
      current = result.wall;
    }
    expect(drawn).toEqual(expected);
    expect(current.deadWall).toHaveLength(14);
    expect(current.liveWall).toHaveLength(wall.liveWall.length - 4);
  });
});

describe('revealKanDora', () => {
  it('adds a second dora indicator from the dead wall, without mutating the input', () => {
    const wall = buildWall(createRNG(1));
    const after = revealKanDora(wall);
    expect(after.doraIndicators.length).toBe(2);
    expect(after.doraIndicators[1]).toBe(wall.deadWall[1]);
    expect(wall.doraIndicators.length).toBe(1);
  });
});

describe('remainingDraws', () => {
  it('reports the live wall length', () => {
    const wall = buildWall(createRNG(1));
    expect(remainingDraws(wall)).toBe(122);
  });
});

describe('doraFromIndicator', () => {
  it('wraps suited ranks 1-9, with 9 rolling over to 1', () => {
    expect(tileTypeKey(doraFromIndicator(suited('man', 3)))).toBe(tileTypeKey(suited('man', 4)));
    expect(tileTypeKey(doraFromIndicator(suited('man', 9)))).toBe(tileTypeKey(suited('man', 1)));
  });

  it('cycles winds east -> south -> west -> north -> east', () => {
    expect(tileTypeKey(doraFromIndicator(wind('east')))).toBe(tileTypeKey(wind('south')));
    expect(tileTypeKey(doraFromIndicator(wind('north')))).toBe(tileTypeKey(wind('east')));
  });

  it('cycles dragons white -> green -> red -> white', () => {
    expect(tileTypeKey(doraFromIndicator(dragon('white')))).toBe(tileTypeKey(dragon('green')));
    expect(tileTypeKey(doraFromIndicator(dragon('red')))).toBe(tileTypeKey(dragon('white')));
  });
});
