import { describe, it, expect } from 'vitest';
import { isChiitoitsu, isKokushi } from './specialShapes';
import { suited, wind, dragon } from '../tiles/tiles';

describe('isChiitoitsu', () => {
  it('accepts seven distinct pairs', () => {
    const tiles = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 3), suited('pin', 3),
      suited('sou', 4), suited('sou', 4),
      wind('east'), wind('east'),
      wind('south'), wind('south'),
      dragon('white'), dragon('white'),
    ];
    expect(isChiitoitsu(tiles)).toBe(true);
  });

  it('rejects four of the same tile (not seven distinct pairs)', () => {
    const tiles = [
      suited('man', 1), suited('man', 1), suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 3), suited('pin', 3),
      suited('sou', 4), suited('sou', 4),
      wind('east'), wind('east'),
      wind('south'), wind('south'),
    ];
    expect(isChiitoitsu(tiles)).toBe(false);
  });

  it('rejects a hand that is not 14 tiles', () => {
    expect(isChiitoitsu([suited('man', 1), suited('man', 1)])).toBe(false);
  });
});

describe('isKokushi', () => {
  it('accepts all 13 terminal/honor types plus one duplicate', () => {
    const tiles = [
      suited('man', 1), suited('man', 9),
      suited('pin', 1), suited('pin', 9),
      suited('sou', 1), suited('sou', 9),
      wind('east'), wind('south'), wind('west'), wind('north'),
      dragon('white'), dragon('green'), dragon('red'),
      suited('man', 1),
    ];
    expect(isKokushi(tiles)).toBe(true);
  });

  it('rejects a hand containing a non-terminal, non-honor tile', () => {
    const tiles = [
      suited('man', 1), suited('man', 9),
      suited('pin', 1), suited('pin', 9),
      suited('sou', 1), suited('sou', 9),
      wind('east'), wind('south'), wind('west'), wind('north'),
      dragon('white'), dragon('green'), dragon('red'),
      suited('man', 5),
    ];
    expect(isKokushi(tiles)).toBe(false);
  });

  it('rejects a hand missing one of the 13 required types', () => {
    const tiles = [
      suited('man', 1), suited('man', 9),
      suited('pin', 1), suited('pin', 9),
      suited('sou', 1), suited('sou', 9),
      wind('east'), wind('south'), wind('west'), wind('north'),
      dragon('white'), dragon('green'), dragon('green'),
      suited('man', 1),
    ];
    expect(isKokushi(tiles)).toBe(false);
  });
});
