import { describe, it, expect } from 'vitest';
import { detectAllYaku } from './index';
import { decomposeStandardHand } from '../hand/decompose';
import { suited } from '../tiles/tiles';
import type { Tile } from '../tiles/types';
import type { StandardWinningHand } from './context';

// Every other test in this plan hand-builds `Meld[]` literals. This file instead wires the real
// `decomposeStandardHand` output into `detectAllYaku`, exercising the actual integration path.
//
// NOTE: this test does NOT cover the tile-identity hazard documented on `meldContainingTile` /
// `isConcealedMeld` in `context.ts`. That hazard only manifests when a tile type's copies are
// split across meld roles (up to 4 copies, e.g. `345m` + `555m`), where which *object* lands in
// the sequence versus the triplet depends on the caller's input ordering. The fixture below is
// deliberately unambiguous (no tile type appears more than twice, and the winning tile's rank
// appears exactly once), so identity is never in question here. A dedicated test for that hazard
// belongs with the future integration layer that actually constructs a `WinningHand` from a
// decomposition — no such code exists in this repo yet.

describe('decomposeStandardHand -> detectAllYaku integration', () => {
  it('detects Pinfu (and nothing else) on a real decomposition of 123m 234m 456p 789s + 55s', () => {
    // 1m 2m 3m | 4p 5p 6p | 7s 8s 9s | 2m 3m 4m | 5s 5s — a flat 14-tile hand, no manual melds.
    const tiles: Tile[] = [
      suited('man', 1),
      suited('man', 2),
      suited('man', 3),
      suited('pin', 4),
      suited('pin', 5),
      suited('pin', 6),
      suited('sou', 7),
      suited('sou', 8),
      suited('sou', 9),
      suited('man', 2),
      suited('man', 3),
      suited('man', 4),
      suited('sou', 5),
      suited('sou', 5),
    ];

    // Only 5s has two copies that can also leave a decomposable remainder: pairing off 2m2m
    // strands 1m/3m/3m/4m and pairing off 3m3m strands 1m/2m/2m/4m, both undecomposable. With
    // 5s5s as the pair the mans read 123m + 234m uniquely. Hence exactly one decomposition.
    const decompositions = decomposeStandardHand(tiles);
    expect(decompositions).toHaveLength(1);

    const { melds, pair } = decompositions[0];

    // 4p appears exactly once in the hand, so there is no same-type stand-in and reference
    // identity is unambiguous: this object is in the 4p-5p-6p sequence.
    const winningTile = tiles[3];
    const winningMeld = melds.find((m) => m.tiles.includes(winningTile));
    expect(winningMeld?.type).toBe('sequence');
    expect(winningMeld?.tiles).toContain(winningTile);

    const hand: StandardWinningHand = {
      shape: 'standard',
      allTiles: tiles,
      melds,
      pair,
      winningTile,
      winCondition: 'ron',
      seatWind: 'south',
      roundWind: 'east',
      isRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      isHoutei: false,
      isRinshan: false,
      isChankan: false,
    };

    // Hand-traced expectations for this hand (Ron on 4p, no riichi/ippatsu, seat S / round E):
    // - Riichi/Ippatsu: flags are false. Menzen Tsumo: won by Ron.
    // - Chiitoitsu: shape is 'standard'.
    // - Tanyao: 1m and 9s are terminals.
    // - Yakuhai: the hand holds no honor tiles at all.
    // - Pinfu: all four melds are sequences, the 5s pair is not a value tile, and 4p completed
    //   4p-5p-6p from its low end (held 5p6p, waiting 4p/7p) — a ryanmen, not a penchan since
    //   the run's high rank is 6, not 9. FIRES, 1 han.
    // - Iipeikou: sequences are 123m / 234m / 456p / 789s — no two identical.
    // - Sanshoku Doujun: sequence low ranks are 1m, 2m, 4p, 7s; no low rank is shared by all
    //   three suits.
    // - Ittsuu: man holds low ranks {1, 2}, pin {4}, sou {7} — no suit has all of 1/4/7.
    // - Chanta/Junchan: the 234m sequence contains no terminal or honor.
    // - Toitoi/Sanankou: the hand contains no triplets.
    // - Honitsu/Chinitsu: all three suits are present.
    const results = detectAllYaku(hand);
    expect(results).toEqual([{ name: 'Pinfu', han: 1 }]);
  });
});
