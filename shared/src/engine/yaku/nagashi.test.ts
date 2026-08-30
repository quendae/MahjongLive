import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import { detectNagashiMangan } from './nagashi';

describe('Nagashi Mangan', () => {
  it('qualifies when every discard is an uncalled terminal or honor', () => {
    expect(
      detectNagashiMangan([
        { tile: suited('man', 1), wasCalled: false },
        { tile: wind('north'), wasCalled: false },
        { tile: dragon('red'), wasCalled: false },
        { tile: suited('sou', 9), wasCalled: false },
      ]),
    ).toEqual({ name: 'Nagashi Mangan', limit: 'mangan' });
  });

  it('rejects a simple-tile discard', () => {
    expect(
      detectNagashiMangan([
        { tile: suited('man', 1), wasCalled: false },
        { tile: suited('pin', 5), wasCalled: false },
      ]),
    ).toBeNull();
  });

  it('rejects when any discard was called', () => {
    expect(
      detectNagashiMangan([
        { tile: suited('man', 1), wasCalled: false },
        { tile: wind('east'), wasCalled: true },
      ]),
    ).toBeNull();
  });

  it('rejects an empty discard history', () => {
    expect(detectNagashiMangan([])).toBeNull();
  });
});
