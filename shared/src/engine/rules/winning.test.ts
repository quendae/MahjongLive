import { describe, expect, it } from 'vitest';
import { dragon, suited, wind } from '../tiles/tiles';
import { detectSanankou } from '../yaku/toitoiSanankou';
import type { WinningMeld } from '../yaku/context';
import { resolveWinningHands } from './winning';

const CONTEXT = {
  winCondition: 'ron' as const,
  seatWind: 'south' as const,
  roundWind: 'east' as const,
};

describe('resolveWinningHands', () => {
  it('emits Chiitoitsu and standard readings when the same closed tiles support both', () => {
    const winningTile = suited('sou', 7);
    const before = [
      suited('man', 1), suited('man', 1),
      suited('man', 2), suited('man', 2),
      suited('man', 3), suited('man', 3),
      suited('pin', 4), suited('pin', 4),
      suited('pin', 5), suited('pin', 5),
      suited('pin', 6), suited('pin', 6),
      suited('sou', 7),
    ];
    const hands = resolveWinningHands({ ...CONTEXT, concealedBeforeWin: before, winningTile });
    expect(hands.some((hand) => hand.shape === 'chiitoitsu')).toBe(true);
    expect(hands.some((hand) => hand.shape === 'standard')).toBe(true);
  });

  it('emits Kokushi as a real special-shape candidate', () => {
    const winningTile = wind('east');
    const before = [
      suited('man', 1), suited('man', 9),
      suited('pin', 1), suited('pin', 9),
      suited('sou', 1), suited('sou', 9),
      wind('east'), wind('south'), wind('west'), wind('north'),
      dragon('white'), dragon('green'), dragon('red'),
    ];
    const hands = resolveWinningHands({ ...CONTEXT, concealedBeforeWin: before, winningTile });
    expect(hands.some((hand) => hand.shape === 'kokushi')).toBe(true);
  });

  it('turns the duplicate-copy hazard into explicit sequence-vs-triplet winning candidates', () => {
    // Completed types: 345m + 555m + 111p + 999s + EE. All four physical 5m copies are used,
    // split between a sequence and a triplet. The exact discarded 5m could semantically complete
    // either group. Raw decomposition object placement is therefore not authoritative.
    const winningTile = suited('man', 5);
    const before = [
      suited('man', 3), suited('man', 4),
      suited('man', 5), suited('man', 5), suited('man', 5),
      suited('pin', 1), suited('pin', 1), suited('pin', 1),
      suited('sou', 9), suited('sou', 9), suited('sou', 9),
      wind('east'), wind('east'),
    ];
    const hands = resolveWinningHands({ ...CONTEXT, concealedBeforeWin: before, winningTile });
    const standard = hands.filter((hand) => hand.shape === 'standard');

    const sequenceWin = standard.find((hand) =>
      hand.melds.some((meld) => meld.type === 'sequence' && meld.tiles.includes(winningTile)),
    );
    const tripletWin = standard.find((hand) =>
      hand.melds.some((meld) => meld.type === 'triplet' && meld.tiles.includes(winningTile)),
    );

    expect(sequenceWin).toBeDefined();
    expect(tripletWin).toBeDefined();
    expect(detectSanankou(sequenceWin!)).toEqual({ name: 'Sanankou', han: 2 });
    expect(detectSanankou(tripletWin!)).toBeNull();
  });

  it('combines an already-open fixed meld with the concealed winning decomposition', () => {
    const fixed: WinningMeld = {
      type: 'triplet',
      tiles: [wind('east'), wind('east'), wind('east')],
      isOpen: true,
    };
    const winningTile = suited('man', 3);
    const before = [
      suited('man', 1), suited('man', 2),
      suited('pin', 4), suited('pin', 5), suited('pin', 6),
      suited('sou', 7), suited('sou', 8), suited('sou', 9),
      suited('man', 2), suited('man', 2),
    ];
    const hands = resolveWinningHands({
      ...CONTEXT,
      concealedBeforeWin: before,
      winningTile,
      fixedMelds: [fixed],
    });
    const standard = hands.filter((hand) => hand.shape === 'standard');
    expect(standard.length).toBeGreaterThan(0);
    expect(standard.every((hand) => hand.melds[0] === fixed)).toBe(true);
    expect(standard.every((hand) => hand.allTiles.length === 14)).toBe(true);
    expect(hands.some((hand) => hand.shape !== 'standard')).toBe(false);
  });

  it('rejects a concealed tile count inconsistent with the number of fixed melds', () => {
    const fixed: WinningMeld = {
      type: 'triplet',
      tiles: [wind('east'), wind('east'), wind('east')],
      isOpen: true,
    };
    expect(resolveWinningHands({
      ...CONTEXT,
      concealedBeforeWin: Array.from({ length: 13 }, () => suited('man', 1)),
      winningTile: suited('man', 2),
      fixedMelds: [fixed],
    })).toEqual([]);
  });
});
