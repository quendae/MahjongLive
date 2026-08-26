import { describe, it, expect } from 'vitest';
import { standardShanten, chiitoitsuShanten, kokushiShanten, shanten } from './shanten';
import { suited, wind, dragon } from '../tiles/tiles';

describe('standardShanten', () => {
  it('is 0 (tenpai) for 3 complete sequences + a pair + a partial triplet', () => {
    const tiles = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('man', 7), suited('man', 8), suited('man', 9),
      suited('pin', 1), suited('pin', 1),
      suited('sou', 2), suited('sou', 2),
    ];
    expect(standardShanten(tiles)).toBe(0);
  });

  it('is 1 for 3 complete sequences + a pair + two unrelated isolated tiles', () => {
    const tiles = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('man', 7), suited('man', 8), suited('man', 9),
      suited('pin', 1), suited('pin', 1),
      wind('east'), wind('south'),
    ];
    expect(standardShanten(tiles)).toBe(1);
  });

  it('is 4 for four partial runs and no pair (a fifth block costs nothing extra)', () => {
    // 12m 45m 78m 23p + 9p E S W N: four two-sided runs, no pair, five isolated tiles.
    // Best complete hand to aim at: 123m 456m 789m 123p + a pair grown from one isolated tile,
    // which shares 2+2+2+2+1 = 9 tiles with this hand, so 13 - 9 = 4 exchanges from tenpai.
    const tiles = [
      suited('man', 1), suited('man', 2),
      suited('man', 4), suited('man', 5),
      suited('man', 7), suited('man', 8),
      suited('pin', 2), suited('pin', 3),
      suited('pin', 9),
      wind('east'), wind('south'), wind('west'), wind('north'),
    ];
    expect(standardShanten(tiles)).toBe(4);
  });

  it('is 4 for five partial runs and no pair (the fifth block still counts)', () => {
    // 12m 45m 78m 23p 56p + 9s E W: five two-sided runs, none of them a pair.
    // Best complete hand: 123m 456m 789m 123p + 5p5p, sharing 2+2+2+2+1 = 9 tiles, so 4.
    const tiles = [
      suited('man', 1), suited('man', 2),
      suited('man', 4), suited('man', 5),
      suited('man', 7), suited('man', 8),
      suited('pin', 2), suited('pin', 3),
      suited('pin', 5), suited('pin', 6),
      suited('sou', 9), wind('east'), wind('west'),
    ];
    expect(standardShanten(tiles)).toBe(4);
  });

  it('is 1, not 0, when the only block left needs a fifth copy of a tile', () => {
    // 666s 777s 888s + all four white dragons. Three melds, a white pair and a second white pair
    // look like tenpai, but completing that second pair would need a fifth white dragon and the
    // hand holds all four, so no tile in the game completes this hand.
    const tiles = [
      suited('sou', 6), suited('sou', 6), suited('sou', 6),
      suited('sou', 7), suited('sou', 7), suited('sou', 7),
      suited('sou', 8), suited('sou', 8), suited('sou', 8),
      dragon('white'), dragon('white'), dragon('white'), dragon('white'),
    ];
    expect(standardShanten(tiles)).toBe(1);
  });
});

describe('chiitoitsuShanten', () => {
  it('is 0 (tenpai) for six pairs plus one isolated tile', () => {
    const tiles = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 3), suited('pin', 3),
      suited('sou', 4), suited('sou', 4),
      wind('east'), wind('east'),
      wind('south'), wind('south'),
      wind('west'),
    ];
    expect(chiitoitsuShanten(tiles)).toBe(0);
  });

  it('is 1 for five pairs plus three distinct isolated tiles', () => {
    const tiles = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('pin', 3), suited('pin', 3),
      suited('sou', 4), suited('sou', 4),
      wind('east'), wind('east'),
      wind('south'), wind('west'), wind('north'),
    ];
    expect(chiitoitsuShanten(tiles)).toBe(1);
  });
});

describe('kokushiShanten', () => {
  it('is 0 (tenpai) for 13 distinct required types with no pair yet', () => {
    const tiles = [
      suited('man', 1), suited('man', 9),
      suited('pin', 1), suited('pin', 9),
      suited('sou', 1), suited('sou', 9),
      wind('east'), wind('south'), wind('west'), wind('north'),
      dragon('white'), dragon('green'), dragon('red'),
    ];
    expect(kokushiShanten(tiles)).toBe(0);
  });

  it('is 4 for 8 distinct required types (one paired) plus 4 unrelated tiles', () => {
    const tiles = [
      suited('man', 1), suited('man', 9),
      suited('pin', 1), suited('pin', 9),
      suited('sou', 1), suited('sou', 9),
      wind('east'), wind('south'),
      wind('east'), // pair of east
      suited('man', 4), suited('man', 5), suited('pin', 4), suited('pin', 5),
    ];
    expect(kokushiShanten(tiles)).toBe(4);
  });
});

describe('shanten (combined minimum)', () => {
  it('picks the standard reading when it is better than chiitoitsu/kokushi', () => {
    const tiles = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('man', 7), suited('man', 8), suited('man', 9),
      suited('pin', 1), suited('pin', 1),
      suited('sou', 2), suited('sou', 2),
    ];
    expect(shanten(tiles)).toBe(0);
  });

  it('picks the chiitoitsu reading when it is better than the standard one', () => {
    const tiles = [
      suited('man', 1), suited('man', 1),
      suited('man', 3), suited('man', 3),
      suited('pin', 5), suited('pin', 5),
      suited('sou', 7), suited('sou', 7),
      wind('east'), wind('east'),
      wind('south'), wind('south'),
      wind('west'),
    ];
    expect(shanten(tiles)).toBe(chiitoitsuShanten(tiles));
    expect(shanten(tiles)).toBeLessThanOrEqual(standardShanten(tiles));
  });
});

describe('the 13-tile precondition', () => {
  const twelve = [
    suited('man', 1), suited('man', 2), suited('man', 3),
    suited('man', 4), suited('man', 5), suited('man', 6),
    suited('man', 7), suited('man', 8), suited('man', 9),
    suited('pin', 1), suited('pin', 1), suited('sou', 2),
  ];

  it('rejects hands that are not exactly 13 tiles', () => {
    expect(() => standardShanten(twelve)).toThrow(/exactly 13 tiles/);
    expect(() => chiitoitsuShanten(twelve)).toThrow(/exactly 13 tiles/);
    expect(() => kokushiShanten(twelve)).toThrow(/exactly 13 tiles/);
    expect(() => shanten(twelve)).toThrow(/exactly 13 tiles/);
    expect(() => shanten([...twelve, suited('sou', 2), suited('sou', 3)])).toThrow(
      /exactly 13 tiles/,
    );
  });
});
