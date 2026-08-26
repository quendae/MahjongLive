import { describe, it, expect } from 'vitest';
import {
  suited, wind, dragon, tilesEqual, tileTypeKey, compareTiles, sortTiles,
  allTileTypes, isTerminal, isHonor, isTerminalOrHonor,
} from './tiles';

describe('tiles', () => {
  it('creates a suited tile with correct properties', () => {
    const t = suited('man', 5, true);
    expect(t.kind).toBe('suited');
    expect(t.suit).toBe('man');
    expect(t.rank).toBe(5);
    expect(t.isRed).toBe(true);
  });

  it('treats red and normal five as the same type', () => {
    expect(tilesEqual(suited('man', 5, true), suited('man', 5, false))).toBe(true);
  });

  it('distinguishes different suits at the same rank', () => {
    expect(tilesEqual(suited('man', 5), suited('pin', 5))).toBe(false);
  });

  it('generates exactly 34 distinct tile types', () => {
    const types = allTileTypes();
    const keys = new Set(types.map(tileTypeKey));
    expect(types.length).toBe(34);
    expect(keys.size).toBe(34);
  });

  it('identifies terminals', () => {
    expect(isTerminal(suited('man', 1))).toBe(true);
    expect(isTerminal(suited('man', 9))).toBe(true);
    expect(isTerminal(suited('man', 5))).toBe(false);
  });

  it('identifies honors', () => {
    expect(isHonor(wind('east'))).toBe(true);
    expect(isHonor(dragon('white'))).toBe(true);
    expect(isHonor(suited('man', 1))).toBe(false);
  });

  it('identifies terminal-or-honor for yaku like Chanta/Kokushi', () => {
    expect(isTerminalOrHonor(suited('man', 1))).toBe(true);
    expect(isTerminalOrHonor(wind('east'))).toBe(true);
    expect(isTerminalOrHonor(suited('man', 5))).toBe(false);
  });

  it('sorts tiles into a stable, deterministic order (man < pin < sou < winds < dragons)', () => {
    const shuffled = [dragon('white'), suited('sou', 3), suited('man', 5), wind('east')];
    const sorted = sortTiles(shuffled);
    expect(sorted.map(tileTypeKey)).toEqual([
      tileTypeKey(suited('man', 5)),
      tileTypeKey(suited('sou', 3)),
      tileTypeKey(wind('east')),
      tileTypeKey(dragon('white')),
    ]);
  });

  it('compareTiles is consistent with sortTiles ordering', () => {
    expect(compareTiles(suited('man', 1), suited('man', 2))).toBeLessThan(0);
    expect(compareTiles(suited('man', 9), suited('pin', 1))).toBeLessThan(0);
  });
});
