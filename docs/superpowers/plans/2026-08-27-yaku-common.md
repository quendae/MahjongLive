# Yaku Detection — Common Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect the ~12 most common Riichi Yaku (Riichi/Ippatsu/Menzen Tsumo, Chiitoitsu, Tanyao,
Yakuhai, Pinfu, Iipeikou, Sanshoku Doujun, Ittsuu, Chanta/Junchan, Toitoi, Sanankou, Honitsu/Chinitsu)
against a fully-resolved winning hand, as pure functions with zero I/O.

**Architecture:** Each Yaku is an independent, pure `(WinningHand) => YakuResult | null` function.
A shared `WinningHand` context type (this plan's own addition, not literally in the spec) carries
everything a detector could need: the decomposition, the winning tile, and situational flags. An
aggregator runs every detector and returns the non-null results.

**Tech Stack:** TypeScript (strict mode), Vitest, same `shared` package as the foundation layer.

**Spec:** [docs/superpowers/specs/2026-08-26-core-rules-engine-design.md](../specs/2026-08-26-core-rules-engine-design.md)

This plan is the second of several implementing that spec's "Yaku" scope. It builds on the
already-shipped foundation (`shared/src/engine/{tiles,hand,shanten}`), specifically
`decomposeStandardHand` (`shared/src/engine/hand/decompose.ts`) and `isChiitoitsu`
(`shared/src/engine/hand/specialShapes.ts`). Yakuman and rare/situational yaku (Kokushi, Suuankou,
Daisangen, Tsuuiisou, Chinroutou, Ryuuiisou, Chuurenpoutou, Suukantsu, Haitei/Houtei/Rinshan/Chankan
as standalone yaku, Nagashi Mangan) are a separate follow-up plan. Fu/Han-to-points scoring and the
Dora system are a plan after that.

## Global Constraints

- 4-player (yonma) rules only, matching the foundation layer.
- No configurable RuleSet — kuitan/atozuke/etc. are not parameters anywhere in this plan; every
  detector here evaluates the closed-hand case only (see "Open Hands — Explicitly Out of Scope").
- All code lives under `shared/src/engine/yaku/`, TypeScript strict mode, no `any`.
- Every module is a pure function set — no classes, no mutation of inputs.
- Reuse the foundation's existing types (`Tile` from `tiles/types`, `Meld`/`StandardDecomposition`
  from `hand/decompose`) rather than redefining them.

## Open Hands — Explicitly Out of Scope

The round state machine (a later plan) is what will produce actual open melds (calls). Until it
exists, this plan only ever constructs `WinningHand` values representing fully closed (menzen)
hands — no `WinningHand` in this plan's tests has a called Pon/Chi/Kan. Consequently:

- Riichi, Ippatsu, Menzen Tsumo, and Pinfu's "closed hand" requirement holds automatically by
  construction in this plan and needs no runtime check — there is nothing yet that could open a
  hand. A comment in the code says so, so nobody "fixes" a missing check later without noticing
  the real constraint moved elsewhere.
- Sanshoku Doujun / Ittsuu / Chanta / Junchan / Honitsu / Chinitsu score fewer han when the hand is
  open (per standard rules). This plan only implements and tests the **closed-hand han values**.
  When open melds exist, these detectors will need an `isOpen` check added — noted inline as a
  `// OPEN-HAND TODO` comment at each affected return statement, not implemented now.
- Sanankou (three *concealed* triplets) has one subtlety that already matters for closed hands
  today: a triplet completed by **Ron** on a pair-wait (shanpon) counts as open for this yaku even
  though no call was made. This plan implements that rule now (see Task 1's `isConcealedMeld`)
  since it's a closed-hand concern, not an open-hand one.

## File Structure

```
shared/src/engine/yaku/
  context.ts               — WinningHand types, YakuResult, YakuDetector, shared helpers
  context.test.ts
  riichi.ts                — detectRiichi, detectIppatsu, detectMenzenTsumo
  riichi.test.ts
  chiitoitsuTanyao.ts       — detectChiitoitsu, detectTanyao
  chiitoitsuTanyao.test.ts
  yakuhai.ts                — detectYakuhai
  yakuhai.test.ts
  pinfuIipeikou.ts          — detectPinfu, detectIipeikou
  pinfuIipeikou.test.ts
  sanshokuIttsuu.ts         — detectSanshokuDoujun, detectIttsuu
  sanshokuIttsuu.test.ts
  chantaJunchan.ts          — detectChanta, detectJunchan
  chantaJunchan.test.ts
  toitoiSanankou.ts         — detectToitoi, detectSanankou
  toitoiSanankou.test.ts
  honitsuChinitsu.ts        — detectHonitsu, detectChinitsu
  honitsuChinitsu.test.ts
  index.ts                  — detectAllYaku aggregator
  index.test.ts
```

---

## Task 1: Context Types and Shared Helpers

**Files:**
- Create: `shared/src/engine/yaku/context.ts`
- Test: `shared/src/engine/yaku/context.test.ts`

**Interfaces:**
- Consumes: `Tile`, `Wind` (`../tiles/types`), `Meld` (`../hand/decompose`).
- Produces: `WinCondition`, `WinningHandBase`, `StandardWinningHand`, `ChiitoitsuWinningHand`,
  `WinningHand` (union), `YakuResult { name: string; han: number }`,
  `YakuDetector = (hand: WinningHand) => YakuResult | null`,
  `meldContainingTile(melds: readonly Meld[], tile: Tile): Meld | undefined`,
  `isConcealedMeld(meld: Meld, hand: StandardWinningHand): boolean`,
  `isYakuhaiTile(tile: Tile, hand: WinningHandBase): boolean`. Every later task in this plan
  consumes these.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/context.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { meldContainingTile, isConcealedMeld, isYakuhaiTile } from './context';
import { suited, wind, dragon } from '../tiles/tiles';
import { Meld } from '../hand/decompose';
import type { StandardWinningHand, WinningHandBase } from './context';

function baseContext(overrides: Partial<WinningHandBase> = {}): WinningHandBase {
  return {
    allTiles: [],
    winningTile: suited('man', 5),
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
}

describe('meldContainingTile', () => {
  it('finds the meld holding a specific tile instance', () => {
    // The exact winningTile instance must be one of a meld's tiles by reference, as a real
    // decomposition would produce (decomposeStandardHand shares references with its input) — so
    // it's built into the sequence literal here rather than assigned after construction.
    const winningTile = suited('man', 5);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] },
      { type: 'sequence', tiles: [suited('man', 4), winningTile, suited('man', 6)] },
    ];
    expect(meldContainingTile(melds, winningTile)).toBe(melds[1]);
  });

  it('returns undefined when no meld contains the tile', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] },
    ];
    expect(meldContainingTile(melds, suited('sou', 9))).toBeUndefined();
  });
});

describe('isConcealedMeld', () => {
  it('treats a triplet not touching the winning tile as concealed', () => {
    const winningTile = suited('man', 6);
    const triplet: Meld = { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] };
    const hand: StandardWinningHand = {
      ...baseContext({ winningTile, winCondition: 'ron' }),
      shape: 'standard',
      melds: [triplet],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(triplet, hand)).toBe(true);
  });

  it('treats a triplet completed by Ron on the winning tile as NOT concealed (shanpon exception)', () => {
    const winningTile = suited('pin', 1);
    const triplet: Meld = { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), winningTile] };
    const hand: StandardWinningHand = {
      ...baseContext({ winningTile, winCondition: 'ron' }),
      shape: 'standard',
      melds: [triplet],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(triplet, hand)).toBe(false);
  });

  it('treats a triplet completed by Tsumo on the winning tile as still concealed', () => {
    const winningTile = suited('pin', 1);
    const triplet: Meld = { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), winningTile] };
    const hand: StandardWinningHand = {
      ...baseContext({ winningTile, winCondition: 'tsumo' }),
      shape: 'standard',
      melds: [triplet],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(triplet, hand)).toBe(true);
  });

  it('never counts a sequence as a concealed-triplet contributor', () => {
    const sequence: Meld = { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] };
    const hand: StandardWinningHand = {
      ...baseContext(),
      shape: 'standard',
      melds: [sequence],
      pair: [suited('sou', 2), suited('sou', 2)],
    };
    expect(isConcealedMeld(sequence, hand)).toBe(false);
  });
});

describe('isYakuhaiTile', () => {
  it('treats any dragon as a yakuhai tile', () => {
    expect(isYakuhaiTile(dragon('white'), baseContext())).toBe(true);
  });

  it('treats the seat wind as a yakuhai tile', () => {
    expect(isYakuhaiTile(wind('south'), baseContext({ seatWind: 'south', roundWind: 'east' }))).toBe(true);
  });

  it('treats the round wind as a yakuhai tile', () => {
    expect(isYakuhaiTile(wind('east'), baseContext({ seatWind: 'south', roundWind: 'east' }))).toBe(true);
  });

  it('rejects a non-seat, non-round wind', () => {
    expect(isYakuhaiTile(wind('north'), baseContext({ seatWind: 'south', roundWind: 'east' }))).toBe(false);
  });

  it('rejects suited tiles', () => {
    expect(isYakuhaiTile(suited('man', 1), baseContext())).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./context` module does not exist yet.

- [ ] **Step 3: Implement `context.ts`**

`shared/src/engine/yaku/context.ts`:
```typescript
import { Tile, Wind } from '../tiles/types';
import { Meld } from '../hand/decompose';

export type WinCondition = 'tsumo' | 'ron';

export interface WinningHandBase {
  /** All 14 tiles of the winning hand, for shape-agnostic checks (Tanyao, Honitsu, Chinitsu). */
  allTiles: readonly Tile[];
  winningTile: Tile;
  winCondition: WinCondition;
  seatWind: Wind;
  roundWind: Wind;
  isRiichi: boolean;
  isIppatsu: boolean;
  /** Won by Tsumo on the very last live-wall tile. */
  isHaitei: boolean;
  /** Won by Ron on the very last discard of the hand. */
  isHoutei: boolean;
  /** Won by Tsumo on a replacement tile drawn after declaring a Kan. */
  isRinshan: boolean;
  /** Won by Ron by robbing another player's added Kan. */
  isChankan: boolean;
}

/** A hand decomposed into four melds plus a pair. */
export interface StandardWinningHand extends WinningHandBase {
  shape: 'standard';
  melds: readonly Meld[];
  pair: readonly Tile[];
}

/** A hand of seven distinct pairs (Chiitoitsu). Has no meld/pair split. */
export interface ChiitoitsuWinningHand extends WinningHandBase {
  shape: 'chiitoitsu';
}

export type WinningHand = StandardWinningHand | ChiitoitsuWinningHand;

export interface YakuResult {
  name: string;
  han: number;
}

export type YakuDetector = (hand: WinningHand) => YakuResult | null;

/** The meld containing a specific tile instance, found by reference identity. */
export function meldContainingTile(melds: readonly Meld[], tile: Tile): Meld | undefined {
  return melds.find((m) => m.tiles.includes(tile));
}

/**
 * Whether a triplet counts as concealed for Sanankou/Suuankou purposes. Only triplets can be
 * concealed (sequences and the pair never count). A triplet completed by Ron — turning a waiting
 * pair into a triplet (shanpon) — is NOT concealed even though no call was made; a triplet
 * completed by Tsumo, or one that already existed before the winning tile, is concealed.
 */
export function isConcealedMeld(meld: Meld, hand: StandardWinningHand): boolean {
  if (meld.type !== 'triplet') return false;
  const containsWinningTile = meld.tiles.includes(hand.winningTile);
  if (containsWinningTile && hand.winCondition === 'ron') return false;
  return true;
}

/** Whether a tile is a "value" honor: any dragon, or the hand's seat or round wind. */
export function isYakuhaiTile(tile: Tile, hand: WinningHandBase): boolean {
  if (tile.kind !== 'honor') return false;
  if (tile.honorType === 'dragon') return true;
  return tile.value === hand.seatWind || tile.value === hand.roundWind;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/context.ts shared/src/engine/yaku/context.test.ts
git commit -m "feat: add Yaku context types and shared helpers"
```

---

## Task 2: Riichi, Ippatsu, Menzen Tsumo

**Files:**
- Create: `shared/src/engine/yaku/riichi.ts`
- Test: `shared/src/engine/yaku/riichi.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult` (Task 1).
- Produces: `detectRiichi`, `detectIppatsu`, `detectMenzenTsumo` — each a `YakuDetector`.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/riichi.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectRiichi, detectIppatsu, detectMenzenTsumo } from './riichi';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand } from './context';

function hand(overrides: Partial<StandardWinningHand>): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds: [],
    pair: [suited('sou', 2), suited('sou', 2)],
    winningTile: suited('man', 5),
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
}

describe('detectRiichi', () => {
  it('awards 1 han when Riichi was declared', () => {
    expect(detectRiichi(hand({ isRiichi: true }))).toEqual({ name: 'Riichi', han: 1 });
  });

  it('is absent without Riichi', () => {
    expect(detectRiichi(hand({ isRiichi: false }))).toBeNull();
  });
});

describe('detectIppatsu', () => {
  it('awards 1 han when Ippatsu applies', () => {
    expect(detectIppatsu(hand({ isRiichi: true, isIppatsu: true }))).toEqual({ name: 'Ippatsu', han: 1 });
  });

  it('is absent without Ippatsu, even under Riichi', () => {
    expect(detectIppatsu(hand({ isRiichi: true, isIppatsu: false }))).toBeNull();
  });
});

describe('detectMenzenTsumo', () => {
  it('awards 1 han for a self-draw win', () => {
    expect(detectMenzenTsumo(hand({ winCondition: 'tsumo' }))).toEqual({ name: 'Menzen Tsumo', han: 1 });
  });

  it('is absent for a Ron win', () => {
    expect(detectMenzenTsumo(hand({ winCondition: 'ron' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./riichi` module does not exist yet.

- [ ] **Step 3: Implement `riichi.ts`**

`shared/src/engine/yaku/riichi.ts`:
```typescript
import { YakuDetector } from './context';

// OPEN-HAND NOTE: Riichi, Ippatsu, and Menzen Tsumo all require a closed (menzen) hand. This
// plan never constructs an open WinningHand (see the plan's "Open Hands" section), so no
// closed-hand check appears here — add one when open melds exist.

export const detectRiichi: YakuDetector = (hand) => {
  return hand.isRiichi ? { name: 'Riichi', han: 1 } : null;
};

export const detectIppatsu: YakuDetector = (hand) => {
  return hand.isIppatsu ? { name: 'Ippatsu', han: 1 } : null;
};

export const detectMenzenTsumo: YakuDetector = (hand) => {
  return hand.winCondition === 'tsumo' ? { name: 'Menzen Tsumo', han: 1 } : null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/riichi.ts shared/src/engine/yaku/riichi.test.ts
git commit -m "feat: add Riichi, Ippatsu, and Menzen Tsumo yaku detectors"
```

---

## Task 3: Chiitoitsu and Tanyao

**Files:**
- Create: `shared/src/engine/yaku/chiitoitsuTanyao.ts`
- Test: `shared/src/engine/yaku/chiitoitsuTanyao.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult` (Task 1), `isTerminalOrHonor` (`../tiles/tiles`).
- Produces: `detectChiitoitsu`, `detectTanyao` — each a `YakuDetector`.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/chiitoitsuTanyao.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectChiitoitsu, detectTanyao } from './chiitoitsuTanyao';
import { suited, wind } from '../tiles/tiles';
import type { ChiitoitsuWinningHand, StandardWinningHand } from './context';

function chiitoitsuHand(allTiles: ReturnType<typeof suited>[]): ChiitoitsuWinningHand {
  return {
    shape: 'chiitoitsu',
    allTiles,
    winningTile: allTiles[0],
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

function standardHand(allTiles: ReturnType<typeof suited>[]): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles,
    melds: [],
    pair: [suited('sou', 2), suited('sou', 2)],
    winningTile: allTiles[0],
    winCondition: 'tsumo',
    seatWind: 'east',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

describe('detectChiitoitsu', () => {
  it('awards 2 han for a chiitoitsu-shaped hand', () => {
    expect(detectChiitoitsu(chiitoitsuHand([suited('man', 1)]))).toEqual({ name: 'Chiitoitsu', han: 2 });
  });

  it('is absent for a standard-shaped hand', () => {
    expect(detectChiitoitsu(standardHand([suited('man', 1)]))).toBeNull();
  });
});

describe('detectTanyao', () => {
  it('awards 1 han when every tile is a simple (no terminals or honors)', () => {
    const tiles = [suited('man', 2), suited('man', 3), suited('man', 4), suited('pin', 5), suited('pin', 5)];
    expect(detectTanyao(standardHand(tiles))).toEqual({ name: 'Tanyao', han: 1 });
  });

  it('is absent when a terminal is present', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3)];
    expect(detectTanyao(standardHand(tiles))).toBeNull();
  });

  it('is absent when an honor is present', () => {
    const tiles = [wind('east'), suited('man', 2), suited('man', 3)];
    expect(detectTanyao(standardHand(tiles))).toBeNull();
  });

  it('applies equally to a chiitoitsu-shaped hand made of all simples', () => {
    const tiles = [suited('man', 2), suited('man', 2), suited('pin', 5), suited('pin', 5)];
    expect(detectTanyao(chiitoitsuHand(tiles))).toEqual({ name: 'Tanyao', han: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./chiitoitsuTanyao` module does not exist yet.

- [ ] **Step 3: Implement `chiitoitsuTanyao.ts`**

`shared/src/engine/yaku/chiitoitsuTanyao.ts`:
```typescript
import { YakuDetector } from './context';
import { isTerminalOrHonor } from '../tiles/tiles';

export const detectChiitoitsu: YakuDetector = (hand) => {
  return hand.shape === 'chiitoitsu' ? { name: 'Chiitoitsu', han: 2 } : null;
};

export const detectTanyao: YakuDetector = (hand) => {
  const allSimples = hand.allTiles.every((t) => !isTerminalOrHonor(t));
  return allSimples ? { name: 'Tanyao', han: 1 } : null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/chiitoitsuTanyao.ts shared/src/engine/yaku/chiitoitsuTanyao.test.ts
git commit -m "feat: add Chiitoitsu and Tanyao yaku detectors"
```

---

## Task 4: Yakuhai

**Files:**
- Create: `shared/src/engine/yaku/yakuhai.ts`
- Test: `shared/src/engine/yaku/yakuhai.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult`, `isYakuhaiTile` (Task 1).
- Produces: `detectYakuhai` — a `YakuDetector`.

**Design note:** real terminology lists each qualifying triplet as its own 1-han "yaku" (so a
hand with both a dragon triplet and a seat-wind triplet has two named yaku entries). This plan
simplifies to a single combined result with a descriptive name and the summed han, since the
aggregator (Task 10) and the later Scoring plan only need the total han this category
contributes — not a per-source breakdown. This simplification is deliberate, not an oversight.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/yakuhai.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectYakuhai } from './yakuhai';
import { suited, wind, dragon } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[], overrides: Partial<StandardWinningHand> = {}): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair: [suited('sou', 2), suited('sou', 2)],
    winningTile: suited('sou', 2),
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
}

describe('detectYakuhai', () => {
  it('awards 1 han for a single dragon triplet', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [dragon('white'), dragon('white'), dragon('white')] }];
    expect(detectYakuhai(standardHand(melds))?.han).toBe(1);
  });

  it('awards 1 han for a seat-wind triplet', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('south'), wind('south'), wind('south')] }];
    expect(detectYakuhai(standardHand(melds, { seatWind: 'south', roundWind: 'east' }))?.han).toBe(1);
  });

  it('awards 2 han for the dealer holding a triplet of the round/seat wind (East-East)', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('east'), wind('east'), wind('east')] }];
    expect(detectYakuhai(standardHand(melds, { seatWind: 'east', roundWind: 'east' }))?.han).toBe(2);
  });

  it('sums han across two different qualifying triplets', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [dragon('white'), dragon('white'), dragon('white')] },
      { type: 'triplet', tiles: [dragon('red'), dragon('red'), dragon('red')] },
    ];
    expect(detectYakuhai(standardHand(melds))?.han).toBe(2);
  });

  it('is absent when no triplet is a value tile', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('north'), wind('north'), wind('north')] }];
    expect(detectYakuhai(standardHand(melds, { seatWind: 'south', roundWind: 'east' }))).toBeNull();
  });

  it('ignores sequences entirely', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] }];
    expect(detectYakuhai(standardHand(melds))).toBeNull();
  });

  it('is absent for a chiitoitsu-shaped hand (no melds to check)', () => {
    const hand = {
      shape: 'chiitoitsu' as const,
      allTiles: [dragon('white'), dragon('white')],
      winningTile: dragon('white'),
      winCondition: 'tsumo' as const,
      seatWind: 'south' as const,
      roundWind: 'east' as const,
      isRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      isHoutei: false,
      isRinshan: false,
      isChankan: false,
    };
    expect(detectYakuhai(hand)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./yakuhai` module does not exist yet.

- [ ] **Step 3: Implement `yakuhai.ts`**

`shared/src/engine/yaku/yakuhai.ts`:
```typescript
import { YakuDetector, isYakuhaiTile } from './context';

export const detectYakuhai: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;

  const qualifyingTriplets = hand.melds.filter(
    (m) => m.type === 'triplet' && isYakuhaiTile(m.tiles[0], hand),
  );
  if (qualifyingTriplets.length === 0) return null;

  const han = qualifyingTriplets.reduce((total, meld) => {
    const tile = meld.tiles[0];
    if (tile.kind === 'honor' && tile.honorType === 'dragon') return total + 1;
    let value = 0;
    if (tile.kind === 'honor' && tile.value === hand.seatWind) value += 1;
    if (tile.kind === 'honor' && tile.value === hand.roundWind) value += 1;
    return total + value;
  }, 0);

  return { name: 'Yakuhai', han };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/yakuhai.ts shared/src/engine/yaku/yakuhai.test.ts
git commit -m "feat: add Yakuhai detector for dragons and seat/round winds"
```

---

## Task 5: Pinfu and Iipeikou

**Files:**
- Create: `shared/src/engine/yaku/pinfuIipeikou.ts`
- Test: `shared/src/engine/yaku/pinfuIipeikou.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult`, `meldContainingTile`, `isYakuhaiTile` (Task 1);
  `tileTypeKey`, `sortTiles` (`../tiles/tiles`).
- Produces: `detectPinfu`, `detectIipeikou` — each a `YakuDetector`.

**Design note (wait shape):** Pinfu requires all four melds to be sequences, the pair to not be a
value tile, and the wait on the winning tile to be two-sided (ryanmen). Given the sequence
`[a, a+1, a+2]` containing the winning tile `w`: if `w` is the middle rank, the wait was a closed
gap (kanchan) — never Pinfu. Otherwise it's an edge wait (penchan) only in the two boundary cases
where the other completing rank would fall outside 1..9: run `1,2,3` won on the `3`, or run
`7,8,9` won on the `7`. Every other case is a genuine two-sided wait.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/pinfuIipeikou.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectPinfu, detectIipeikou } from './pinfuIipeikou';
import { suited, wind } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(
  melds: Meld[],
  pair: ReturnType<typeof suited>[],
  winningTile: ReturnType<typeof suited>,
  overrides: Partial<StandardWinningHand> = {},
): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair,
    winningTile,
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
}

describe('detectPinfu', () => {
  it('awards 1 han for four sequences, a non-value pair, and a two-sided wait', () => {
    const winningTile = suited('man', 4); // run 4-5-6, won on the low end (held 5,6 -> waits 4 or 7)
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] },
      { type: 'sequence', tiles: [suited('pin', 1), suited('pin', 2), suited('pin', 3)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
    ];
    const pair = [suited('sou', 2), suited('sou', 2)];
    expect(detectPinfu(standardHand(melds, pair, winningTile))).toEqual({ name: 'Pinfu', han: 1 });
  });

  it('is absent when any meld is a triplet', () => {
    const winningTile = suited('man', 4);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] },
      { type: 'triplet', tiles: [suited('pin', 1), suited('pin', 1), suited('pin', 1)] },
    ];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent when the pair is a value tile', () => {
    const winningTile = suited('man', 4);
    const melds: Meld[] = [{ type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] }];
    const pair = [wind('east'), wind('east')]; // round wind, and this hand's roundWind is 'east'
    expect(detectPinfu(standardHand(melds, pair, winningTile))).toBeNull();
  });

  it('is absent for a kanchan (closed gap) wait', () => {
    const winningTile = suited('man', 5); // run 4-5-6, won on the middle tile
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), winningTile, suited('man', 6)] }];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent for a penchan (edge) wait on 1-2-3 won on the 3', () => {
    const winningTile = suited('man', 3);
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 1), suited('man', 2), winningTile] }];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent for a penchan (edge) wait on 7-8-9 won on the 7', () => {
    const winningTile = suited('man', 7);
    const melds: Meld[] = [{ type: 'sequence', tiles: [winningTile, suited('man', 8), suited('man', 9)] }];
    expect(detectPinfu(standardHand(melds, [suited('sou', 2), suited('sou', 2)], winningTile))).toBeNull();
  });

  it('is absent for a chiitoitsu-shaped hand', () => {
    const hand = {
      shape: 'chiitoitsu' as const,
      allTiles: [],
      winningTile: suited('man', 4),
      winCondition: 'tsumo' as const,
      seatWind: 'south' as const,
      roundWind: 'east' as const,
      isRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      isHoutei: false,
      isRinshan: false,
      isChankan: false,
    };
    expect(detectPinfu(hand)).toBeNull();
  });
});

describe('detectIipeikou', () => {
  it('awards 1 han for two identical sequences', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
    ];
    expect(detectIipeikou(standardHand(melds, [suited('sou', 2), suited('sou', 2)], suited('man', 2)))).toEqual({
      name: 'Iipeikou',
      han: 1,
    });
  });

  it('is absent when all sequences are distinct', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
      { type: 'sequence', tiles: [suited('pin', 2), suited('pin', 3), suited('pin', 4)] },
    ];
    expect(detectIipeikou(standardHand(melds, [suited('sou', 2), suited('sou', 2)], suited('man', 2)))).toBeNull();
  });

  it('is absent when the matching melds are triplets, not sequences', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('man', 2), suited('man', 2), suited('man', 2)] },
    ];
    expect(detectIipeikou(standardHand(melds, [suited('sou', 2), suited('sou', 2)], suited('man', 2)))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./pinfuIipeikou` module does not exist yet.

- [ ] **Step 3: Implement `pinfuIipeikou.ts`**

`shared/src/engine/yaku/pinfuIipeikou.ts`:
```typescript
import { YakuDetector, meldContainingTile, isYakuhaiTile } from './context';
import { tileTypeKey } from '../tiles/tiles';
import { Tile } from '../tiles/types';
import { Meld } from '../hand/decompose';

function isRyanmenWait(meld: Meld, winningTile: Tile): boolean {
  const sorted = [...meld.tiles].sort((a, b) => {
    if (a.kind !== 'suited' || b.kind !== 'suited') return 0;
    return a.rank - b.rank;
  });
  const winIndex = sorted.indexOf(winningTile);
  if (winIndex === 1) return false; // middle of the run: kanchan

  const lowRank = sorted[0].kind === 'suited' ? sorted[0].rank : 0;
  const highRank = sorted[2].kind === 'suited' ? sorted[2].rank : 0;
  const isPenchanLow = lowRank === 1 && winIndex === 2; // run 1-2-3, won on the 3
  const isPenchanHigh = highRank === 9 && winIndex === 0; // run 7-8-9, won on the 7
  return !isPenchanLow && !isPenchanHigh;
}

export const detectPinfu: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  if (hand.melds.some((m) => m.type !== 'sequence')) return null;
  if (isYakuhaiTile(hand.pair[0], hand)) return null;

  const winningMeld = meldContainingTile(hand.melds, hand.winningTile);
  if (!winningMeld) return null; // won on the pair tile: always a tanki (single) wait, not Pinfu
  if (!isRyanmenWait(winningMeld, hand.winningTile)) return null;

  return { name: 'Pinfu', han: 1 };
};

export const detectIipeikou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;

  const sequenceKeys = hand.melds
    .filter((m) => m.type === 'sequence')
    .map((m) => m.tiles.map(tileTypeKey).sort().join(','));

  const hasDuplicate = sequenceKeys.some((key, i) => sequenceKeys.indexOf(key) !== i);
  return hasDuplicate ? { name: 'Iipeikou', han: 1 } : null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green. If `isRyanmenWait`'s sort-by-rank comparator misbehaves on a
specific test case, trace that exact meld by hand against the wait-shape rule in this task's
design note — do not weaken the assertion.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/pinfuIipeikou.ts shared/src/engine/yaku/pinfuIipeikou.test.ts
git commit -m "feat: add Pinfu and Iipeikou yaku detectors"
```

---

## Task 6: Sanshoku Doujun and Ittsuu

**Files:**
- Create: `shared/src/engine/yaku/sanshokuIttsuu.ts`
- Test: `shared/src/engine/yaku/sanshokuIttsuu.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult` (Task 1).
- Produces: `detectSanshokuDoujun`, `detectIttsuu` — each a `YakuDetector`. Closed-hand han
  values only (2 han each) — see the plan's `OPEN-HAND TODO` convention.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/sanshokuIttsuu.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectSanshokuDoujun, detectIttsuu } from './sanshokuIttsuu';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[]): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair: [suited('sou', 9), suited('sou', 9)],
    winningTile: suited('man', 1),
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

describe('detectSanshokuDoujun', () => {
  it('awards 2 han for the same sequence in all three suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 3), suited('man', 4), suited('man', 5)] },
      { type: 'sequence', tiles: [suited('pin', 3), suited('pin', 4), suited('pin', 5)] },
      { type: 'sequence', tiles: [suited('sou', 3), suited('sou', 4), suited('sou', 5)] },
    ];
    expect(detectSanshokuDoujun(standardHand(melds))).toEqual({ name: 'Sanshoku Doujun', han: 2 });
  });

  it('is absent when the matching sequence spans only two suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 3), suited('man', 4), suited('man', 5)] },
      { type: 'sequence', tiles: [suited('pin', 3), suited('pin', 4), suited('pin', 5)] },
    ];
    expect(detectSanshokuDoujun(standardHand(melds))).toBeNull();
  });

  it('is absent when the ranks do not line up across suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 3), suited('man', 4), suited('man', 5)] },
      { type: 'sequence', tiles: [suited('pin', 4), suited('pin', 5), suited('pin', 6)] },
      { type: 'sequence', tiles: [suited('sou', 3), suited('sou', 4), suited('sou', 5)] },
    ];
    expect(detectSanshokuDoujun(standardHand(melds))).toBeNull();
  });
});

describe('detectIttsuu', () => {
  it('awards 2 han for 1-9 straight in one suit', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
      { type: 'sequence', tiles: [suited('man', 7), suited('man', 8), suited('man', 9)] },
    ];
    expect(detectIttsuu(standardHand(melds))).toEqual({ name: 'Ittsuu', han: 2 });
  });

  it('is absent when the three runs span different suits', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [suited('pin', 4), suited('pin', 5), suited('pin', 6)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
    ];
    expect(detectIttsuu(standardHand(melds))).toBeNull();
  });

  it('is absent when a needed run is missing', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'sequence', tiles: [suited('man', 7), suited('man', 8), suited('man', 9)] },
    ];
    expect(detectIttsuu(standardHand(melds))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./sanshokuIttsuu` module does not exist yet.

- [ ] **Step 3: Implement `sanshokuIttsuu.ts`**

`shared/src/engine/yaku/sanshokuIttsuu.ts`:
```typescript
import { YakuDetector } from './context';
import { Tile, Suit } from '../tiles/types';

function sequenceLowRank(tiles: readonly Tile[]): number {
  const ranks = tiles
    .filter((t): t is Extract<Tile, { kind: 'suited' }> => t.kind === 'suited')
    .map((t) => t.rank);
  return Math.min(...ranks);
}

function sequenceSuit(tiles: readonly Tile[]): Suit | null {
  const first = tiles[0];
  return first.kind === 'suited' ? first.suit : null;
}

export const detectSanshokuDoujun: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const sequences = hand.melds.filter((m) => m.type === 'sequence');

  for (const low of sequences) {
    const lowRank = sequenceLowRank(low.tiles);
    const suits = new Set(
      sequences
        .filter((m) => sequenceLowRank(m.tiles) === lowRank)
        .map((m) => sequenceSuit(m.tiles)),
    );
    if (suits.size === 3) return { name: 'Sanshoku Doujun', han: 2 };
  }
  return null;
};

export const detectIttsuu: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const sequences = hand.melds.filter((m) => m.type === 'sequence');

  const bySuit = new Map<Suit, Set<number>>();
  for (const seq of sequences) {
    const suit = sequenceSuit(seq.tiles);
    if (!suit) continue;
    const lowRanks = bySuit.get(suit) ?? new Set<number>();
    lowRanks.add(sequenceLowRank(seq.tiles));
    bySuit.set(suit, lowRanks);
  }

  for (const lowRanks of bySuit.values()) {
    if (lowRanks.has(1) && lowRanks.has(4) && lowRanks.has(7)) {
      return { name: 'Ittsuu', han: 2 };
    }
  }
  return null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/sanshokuIttsuu.ts shared/src/engine/yaku/sanshokuIttsuu.test.ts
git commit -m "feat: add Sanshoku Doujun and Ittsuu yaku detectors"
```

---

## Task 7: Chanta and Junchan

**Files:**
- Create: `shared/src/engine/yaku/chantaJunchan.ts`
- Test: `shared/src/engine/yaku/chantaJunchan.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult` (Task 1), `isTerminal`, `isTerminalOrHonor`
  (`../tiles/tiles`).
- Produces: `detectChanta`, `detectJunchan` — each a `YakuDetector`. Closed-hand han values (2 and
  3 respectively) — see the plan's `OPEN-HAND TODO` convention.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/chantaJunchan.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectChanta, detectJunchan } from './chantaJunchan';
import { suited, wind } from '../tiles/tiles';
import type { StandardWinningHand, ChiitoitsuWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[], pair: ReturnType<typeof suited>[]): StandardWinningHand {
  // allTiles is derived from melds+pair (not hardcoded) because detectJunchan reads allTiles
  // directly to check for honors — a fixture that doesn't reflect the melds would let that check
  // silently pass for the wrong reason.
  const allTiles = [...melds.flatMap((m) => m.tiles), ...pair];
  return {
    shape: 'standard',
    allTiles,
    melds,
    pair,
    winningTile: suited('man', 1),
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

function chiitoitsuHand(allTiles: ReturnType<typeof suited>[]): ChiitoitsuWinningHand {
  return {
    shape: 'chiitoitsu',
    allTiles,
    winningTile: allTiles[0],
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

describe('detectChanta', () => {
  it('awards 2 han when every meld and the pair contain a terminal or honor', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'triplet', tiles: [wind('east'), wind('east'), wind('east')] },
    ];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectChanta(standardHand(melds, pair))).toEqual({ name: 'Chanta', han: 2 });
  });

  it('is absent when one meld has no terminal or honor', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectChanta(standardHand(melds, pair))).toBeNull();
  });

  it('is absent when the pair has no terminal or honor', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] }];
    const pair = [suited('pin', 5), suited('pin', 5)];
    expect(detectChanta(standardHand(melds, pair))).toBeNull();
  });

  it('accepts a chiitoitsu-shaped hand where every pair contains a terminal or honor', () => {
    const tiles = [suited('man', 1), suited('man', 1), wind('east'), wind('east')];
    expect(detectChanta(chiitoitsuHand(tiles))).toEqual({ name: 'Chanta', han: 2 });
  });
});

describe('detectJunchan', () => {
  it('awards 3 han when every meld and the pair contain a terminal, and no honors are present', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectJunchan(standardHand(melds, pair))).toEqual({ name: 'Junchan', han: 3 });
  });

  it('is absent when an honor tile is present (that would be Chanta, not Junchan)', () => {
    const melds: Meld[] = [{ type: 'triplet', tiles: [wind('east'), wind('east'), wind('east')] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectJunchan(standardHand(melds, pair))).toBeNull();
  });

  it('is absent when a meld has no terminal', () => {
    const melds: Meld[] = [{ type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] }];
    const pair = [suited('pin', 9), suited('pin', 9)];
    expect(detectJunchan(standardHand(melds, pair))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./chantaJunchan` module does not exist yet.

- [ ] **Step 3: Implement `chantaJunchan.ts`**

`shared/src/engine/yaku/chantaJunchan.ts`:
```typescript
import { YakuDetector, WinningHand } from './context';
import { isTerminal, isTerminalOrHonor, tileTypeKey } from '../tiles/tiles';
import { Tile } from '../tiles/types';
import { Meld } from '../hand/decompose';

function groupsOf(hand: WinningHand): (readonly Tile[])[] {
  if (hand.shape === 'standard') {
    return [...hand.melds.map((m: Meld) => m.tiles), hand.pair];
  }
  // Chiitoitsu: reconstruct the 7 pairs from allTiles, grouped by tile type.
  const seen = new Map<string, Tile[]>();
  for (const tile of hand.allTiles) {
    const key = tileTypeKey(tile);
    const list = seen.get(key) ?? [];
    list.push(tile);
    seen.set(key, list);
  }
  return [...seen.values()];
}

export const detectChanta: YakuDetector = (hand) => {
  const groups = groupsOf(hand);
  const allQualify = groups.every((group) => group.some(isTerminalOrHonor));
  return allQualify ? { name: 'Chanta', han: 2 } : null;
};

export const detectJunchan: YakuDetector = (hand) => {
  const groups = groupsOf(hand);
  const anyHonor = hand.allTiles.some((t) => t.kind === 'honor');
  if (anyHonor) return null;
  const allQualify = groups.every((group) => group.some(isTerminal));
  return allQualify ? { name: 'Junchan', han: 3 } : null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/chantaJunchan.ts shared/src/engine/yaku/chantaJunchan.test.ts
git commit -m "feat: add Chanta and Junchan yaku detectors"
```

---

## Task 8: Toitoi and Sanankou

**Files:**
- Create: `shared/src/engine/yaku/toitoiSanankou.ts`
- Test: `shared/src/engine/yaku/toitoiSanankou.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult`, `isConcealedMeld` (Task 1).
- Produces: `detectToitoi`, `detectSanankou` — each a `YakuDetector`.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/toitoiSanankou.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectToitoi, detectSanankou } from './toitoiSanankou';
import { suited } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

function standardHand(melds: Meld[], overrides: Partial<StandardWinningHand> = {}): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles: [],
    melds,
    pair: [suited('sou', 2), suited('sou', 2)],
    winningTile: suited('man', 1),
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
    ...overrides,
  };
}

describe('detectToitoi', () => {
  it('awards 2 han when all four melds are triplets', () => {
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('man', 1), suited('man', 1), suited('man', 1)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'triplet', tiles: [suited('sou', 9), suited('sou', 9), suited('sou', 9)] },
      { type: 'triplet', tiles: [suited('man', 7), suited('man', 7), suited('man', 7)] },
    ];
    expect(detectToitoi(standardHand(melds))).toEqual({ name: 'Toitoi', han: 2 });
  });

  it('is absent when any meld is a sequence', () => {
    const melds: Meld[] = [
      { type: 'sequence', tiles: [suited('man', 1), suited('man', 2), suited('man', 3)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
    ];
    expect(detectToitoi(standardHand(melds))).toBeNull();
  });

  it('is absent for a chiitoitsu-shaped hand', () => {
    const hand = {
      shape: 'chiitoitsu' as const,
      allTiles: [],
      winningTile: suited('man', 1),
      winCondition: 'tsumo' as const,
      seatWind: 'south' as const,
      roundWind: 'east' as const,
      isRiichi: false,
      isIppatsu: false,
      isHaitei: false,
      isHoutei: false,
      isRinshan: false,
      isChankan: false,
    };
    expect(detectToitoi(hand)).toBeNull();
  });
});

describe('detectSanankou', () => {
  it('awards 2 han for three concealed triplets, won by Tsumo', () => {
    const winningTile = suited('man', 1);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [winningTile, suited('man', 1), suited('man', 1)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'triplet', tiles: [suited('sou', 9), suited('sou', 9), suited('sou', 9)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
    ];
    expect(detectSanankou(standardHand(melds, { winningTile, winCondition: 'tsumo' }))).toEqual({
      name: 'Sanankou',
      han: 2,
    });
  });

  it('is absent when the winning Ron tile completes one of the three triplets (shanpon exception)', () => {
    const winningTile = suited('man', 1);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [suited('man', 1), suited('man', 1), winningTile] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'triplet', tiles: [suited('sou', 9), suited('sou', 9), suited('sou', 9)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
    ];
    expect(detectSanankou(standardHand(melds, { winningTile, winCondition: 'ron' }))).toBeNull();
  });

  it('is absent with only two concealed triplets', () => {
    const winningTile = suited('man', 1);
    const melds: Meld[] = [
      { type: 'triplet', tiles: [winningTile, suited('man', 1), suited('man', 1)] },
      { type: 'triplet', tiles: [suited('pin', 5), suited('pin', 5), suited('pin', 5)] },
      { type: 'sequence', tiles: [suited('man', 4), suited('man', 5), suited('man', 6)] },
      { type: 'sequence', tiles: [suited('sou', 7), suited('sou', 8), suited('sou', 9)] },
    ];
    expect(detectSanankou(standardHand(melds, { winningTile, winCondition: 'tsumo' }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./toitoiSanankou` module does not exist yet.

- [ ] **Step 3: Implement `toitoiSanankou.ts`**

`shared/src/engine/yaku/toitoiSanankou.ts`:
```typescript
import { YakuDetector, isConcealedMeld } from './context';

export const detectToitoi: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const allTriplets = hand.melds.every((m) => m.type === 'triplet');
  return allTriplets ? { name: 'Toitoi', han: 2 } : null;
};

export const detectSanankou: YakuDetector = (hand) => {
  if (hand.shape !== 'standard') return null;
  const concealedTriplets = hand.melds.filter((m) => isConcealedMeld(m, hand));
  return concealedTriplets.length >= 3 ? { name: 'Sanankou', han: 2 } : null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/toitoiSanankou.ts shared/src/engine/yaku/toitoiSanankou.test.ts
git commit -m "feat: add Toitoi and Sanankou yaku detectors"
```

---

## Task 9: Honitsu and Chinitsu

**Files:**
- Create: `shared/src/engine/yaku/honitsuChinitsu.ts`
- Test: `shared/src/engine/yaku/honitsuChinitsu.test.ts`

**Interfaces:**
- Consumes: `WinningHand`, `YakuResult` (Task 1).
- Produces: `detectHonitsu`, `detectChinitsu` — each a `YakuDetector`. Closed-hand han values (3
  and 6 respectively) — see the plan's `OPEN-HAND TODO` convention.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/honitsuChinitsu.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectHonitsu, detectChinitsu } from './honitsuChinitsu';
import { suited, wind } from '../tiles/tiles';
import type { StandardWinningHand } from './context';

function standardHand(allTiles: ReturnType<typeof suited>[]): StandardWinningHand {
  return {
    shape: 'standard',
    allTiles,
    melds: [],
    pair: [],
    winningTile: allTiles[0],
    winCondition: 'tsumo',
    seatWind: 'south',
    roundWind: 'east',
    isRiichi: false,
    isIppatsu: false,
    isHaitei: false,
    isHoutei: false,
    isRinshan: false,
    isChankan: false,
  };
}

describe('detectHonitsu', () => {
  it('awards 3 han for one suit plus honors', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3), wind('east'), wind('east')];
    expect(detectHonitsu(standardHand(tiles))).toEqual({ name: 'Honitsu', han: 3 });
  });

  it('is absent when two suits are present', () => {
    const tiles = [suited('man', 1), suited('pin', 2), wind('east')];
    expect(detectHonitsu(standardHand(tiles))).toBeNull();
  });

  it('is absent for a pure one-suit hand with no honors (that is Chinitsu instead)', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3)];
    expect(detectHonitsu(standardHand(tiles))).toBeNull();
  });
});

describe('detectChinitsu', () => {
  it('awards 6 han for tiles from one suit only, no honors', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('man', 3)];
    expect(detectChinitsu(standardHand(tiles))).toEqual({ name: 'Chinitsu', han: 6 });
  });

  it('is absent when any honor is present', () => {
    const tiles = [suited('man', 1), suited('man', 2), wind('east')];
    expect(detectChinitsu(standardHand(tiles))).toBeNull();
  });

  it('is absent when two suits are present', () => {
    const tiles = [suited('man', 1), suited('pin', 2)];
    expect(detectChinitsu(standardHand(tiles))).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./honitsuChinitsu` module does not exist yet.

- [ ] **Step 3: Implement `honitsuChinitsu.ts`**

`shared/src/engine/yaku/honitsuChinitsu.ts`:
```typescript
import { YakuDetector, WinningHand } from './context';

function suitsPresent(hand: WinningHand): Set<string> {
  return new Set(
    hand.allTiles.filter((t) => t.kind === 'suited').map((t) => (t.kind === 'suited' ? t.suit : '')),
  );
}

export const detectHonitsu: YakuDetector = (hand) => {
  const suits = suitsPresent(hand);
  const hasHonor = hand.allTiles.some((t) => t.kind === 'honor');
  return suits.size === 1 && hasHonor ? { name: 'Honitsu', han: 3 } : null;
};

export const detectChinitsu: YakuDetector = (hand) => {
  const suits = suitsPresent(hand);
  const hasHonor = hand.allTiles.some((t) => t.kind === 'honor');
  return suits.size === 1 && !hasHonor ? { name: 'Chinitsu', han: 6 } : null;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/honitsuChinitsu.ts shared/src/engine/yaku/honitsuChinitsu.test.ts
git commit -m "feat: add Honitsu and Chinitsu yaku detectors"
```

---

## Task 10: Yaku Aggregator

**Files:**
- Create: `shared/src/engine/yaku/index.ts`
- Test: `shared/src/engine/yaku/index.test.ts`

**Interfaces:**
- Consumes: every detector from Tasks 2-9, `WinningHand`, `YakuResult`, `YakuDetector` (Task 1).
- Produces: `ALL_YAKU_DETECTORS: readonly YakuDetector[]`,
  `detectAllYaku(hand: WinningHand): YakuResult[]`. The later Scoring plan consumes
  `detectAllYaku` to get every matched yaku and sum `han` across the results.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/yaku/index.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { detectAllYaku } from './index';
import { suited, wind } from '../tiles/tiles';
import type { StandardWinningHand } from './context';
import type { Meld } from '../hand/decompose';

describe('detectAllYaku', () => {
  it('collects every matching yaku for a hand that qualifies for exactly two at once', () => {
    // 567m 234p 345s 234m + 66s pair, won by Ron on the 5m (a low-end ryanmen: held 6m7m,
    // waiting on 5m or 8m). All 14 tiles are simples (ranks 2-7, no terminals/honors), all four
    // melds are sequences, and the pair (6s) isn't a value tile — so exactly Tanyao and Pinfu
    // should fire. No triplets, no single suit, no matching sequences, no terminal/honor in any
    // group: every other detector in this plan's set is independently ruled out below.
    const winningTile = suited('man', 5);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 6), suited('man', 7)] },
      { type: 'sequence', tiles: [suited('pin', 2), suited('pin', 3), suited('pin', 4)] },
      { type: 'sequence', tiles: [suited('sou', 3), suited('sou', 4), suited('sou', 5)] },
      { type: 'sequence', tiles: [suited('man', 2), suited('man', 3), suited('man', 4)] },
    ];
    const pair = [suited('sou', 6), suited('sou', 6)];
    const hand: StandardWinningHand = {
      shape: 'standard',
      allTiles: [...melds.flatMap((m) => m.tiles), ...pair],
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
    const results = detectAllYaku(hand);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(['Pinfu', 'Tanyao']);
    expect(results.every((r) => r.han > 0)).toBe(true);
  });

  it('returns an empty array when no yaku applies', () => {
    // 456m 333p 123s 789p + 77s pair, won by Ron on the 4m. A triplet rules out Pinfu/Toitoi
    // (only one triplet, so also not Sanankou); the 9p terminal rules out Tanyao; three suits
    // are present (rules out Honitsu/Chinitsu, and no suit alone carries a 1-4-7 run so Ittsuu is
    // out too); no meld+pair pair all contain a terminal/honor (rules out Chanta/Junchan); no two
    // sequences match (rules out Iipeikou); no matching low rank across all three suits (rules
    // out Sanshoku); no honor tile exists at all (rules out Yakuhai).
    const winningTile = suited('man', 4);
    const melds: Meld[] = [
      { type: 'sequence', tiles: [winningTile, suited('man', 5), suited('man', 6)] },
      { type: 'triplet', tiles: [suited('pin', 3), suited('pin', 3), suited('pin', 3)] },
      { type: 'sequence', tiles: [suited('sou', 1), suited('sou', 2), suited('sou', 3)] },
      { type: 'sequence', tiles: [suited('pin', 7), suited('pin', 8), suited('pin', 9)] },
    ];
    const pair = [suited('sou', 7), suited('sou', 7)];
    const hand: StandardWinningHand = {
      shape: 'standard',
      allTiles: [...melds.flatMap((m) => m.tiles), ...pair],
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
    expect(detectAllYaku(hand)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./index` module does not exist yet.

- [ ] **Step 3: Implement `index.ts`**

`shared/src/engine/yaku/index.ts`:
```typescript
import { WinningHand, YakuDetector, YakuResult } from './context';
import { detectRiichi, detectIppatsu, detectMenzenTsumo } from './riichi';
import { detectChiitoitsu, detectTanyao } from './chiitoitsuTanyao';
import { detectYakuhai } from './yakuhai';
import { detectPinfu, detectIipeikou } from './pinfuIipeikou';
import { detectSanshokuDoujun, detectIttsuu } from './sanshokuIttsuu';
import { detectChanta, detectJunchan } from './chantaJunchan';
import { detectToitoi, detectSanankou } from './toitoiSanankou';
import { detectHonitsu, detectChinitsu } from './honitsuChinitsu';

export const ALL_YAKU_DETECTORS: readonly YakuDetector[] = [
  detectRiichi,
  detectIppatsu,
  detectMenzenTsumo,
  detectChiitoitsu,
  detectTanyao,
  detectYakuhai,
  detectPinfu,
  detectIipeikou,
  detectSanshokuDoujun,
  detectIttsuu,
  detectChanta,
  detectJunchan,
  detectToitoi,
  detectSanankou,
  detectHonitsu,
  detectChinitsu,
];

export function detectAllYaku(hand: WinningHand): YakuResult[] {
  return ALL_YAKU_DETECTORS.map((detect) => detect(hand)).filter((r): r is YakuResult => r !== null);
}

export * from './context';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/yaku/index.ts shared/src/engine/yaku/index.test.ts
git commit -m "feat: add Yaku aggregator collecting all common-set detectors"
```

---

## Plan Completion Check

After Task 10, run the full suite and typecheck once more:

Run: `pnpm --filter @mahjong-live/shared test && pnpm --filter @mahjong-live/shared typecheck`
Expected: PASS, all tests across all 10 tasks green, typecheck clean.

This completes the common-yaku layer. Next plans: **Yakuman + Rare Yaku** (Kokushi, Suuankou,
Daisangen, Shousuushii/Daisuushii, Tsuuiisou, Chinroutou, Ryuuiisou, Chuurenpoutou, Suukantsu,
Haitei/Houtei/Rinshan/Chankan, Nagashi Mangan), then **Dora + Fu + Scoring** (consumes
`detectAllYaku` from both Yaku plans, plus `decomposeStandardHand`/`isChiitoitsu`/`isKokushi` for
Fu calculation).
