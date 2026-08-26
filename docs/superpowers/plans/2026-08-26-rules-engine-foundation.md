# Rules Engine Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational, isomorphic layer of the Riichi rules engine — tile representation, wall construction/shuffling, hand decomposition, special hand shapes (Chiitoitsu/Kokushi), and a Shanten calculator — as pure, fully-tested TypeScript with zero I/O.

**Architecture:** Pure functions and immutable data structures throughout. No classes, no shared mutable state, no I/O (no network, no rendering, no system clock). Every module is independently unit-testable.

**Tech Stack:** TypeScript (strict mode), Vitest, pnpm workspaces (`shared` package).

**Spec:** [docs/superpowers/specs/2026-08-26-core-rules-engine-design.md](../specs/2026-08-26-core-rules-engine-design.md)

This plan covers the **foundation** portion of that spec's scope (sections "W zakresie": tile
representation, wall, hand decomposition incl. special shapes, Shanten calculator). Yaku
detection, Fu/scoring, and the round state machine (also in the spec's scope) are deliberately
deferred to follow-up plans, written once this foundation's interfaces are stable — those layers
consume the types and functions defined here.

## Global Constraints

- 4-player (yonma) rules only — no Sanma support in this plan.
- Full standard Yaku list, full Dora system (indicator + kan-dora + ura-dora + aka), full Kan
  mechanics are the eventual engine scope, but **not implemented in this plan** — this plan only
  builds what those layers will depend on (tiles, wall, hand decomposition, shanten).
- No configurable `RuleSet` — nothing in this plan takes rule-variant parameters.
- All code lives under `shared/src/engine/`, TypeScript strict mode, no `any` except where
  explicitly noted for narrow type coercion.
- Every module is a pure function set — no classes, no mutation of inputs.

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/vitest.config.ts`

**Interfaces:**
- Produces: a working `pnpm --filter @mahjong-live/shared test` command that later tasks can run.

- [ ] **Step 1: Create the workspace root files**

`package.json`:
```json
{
  "name": "mahjong-live",
  "private": true,
  "version": "0.0.0"
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'shared'
  - 'server'
  - 'client'
```

`.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 2: Create the `shared` package**

`shared/package.json`:
```json
{
  "name": "@mahjong-live/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`shared/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 4: Verify the test pipeline runs**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: Vitest runs and reports "No test files found" (or exits 0) — confirms config wiring
before Task 2 adds real tests.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .gitignore shared/package.json shared/tsconfig.json shared/vitest.config.ts pnpm-lock.yaml
git commit -m "chore: scaffold pnpm workspace and shared package"
```

---

## Task 2: Tile Types and Core Tile Functions

**Files:**
- Create: `shared/src/engine/tiles/types.ts`
- Create: `shared/src/engine/tiles/tiles.ts`
- Test: `shared/src/engine/tiles/tiles.test.ts`

**Interfaces:**
- Produces: `Tile`, `SuitedTile`, `HonorTile`, `Suit`, `SuitRank`, `Wind`, `Dragon` types;
  `suited(suit, rank, isRed?)`, `wind(value)`, `dragon(value)`, `tileTypeKey(tile): string`,
  `tilesEqual(a, b): boolean`, `allTileTypes(): Tile[]` (34 types), `compareTiles(a, b): number`,
  `sortTiles(tiles): Tile[]`, `isTerminal(tile): boolean`, `isHonor(tile): boolean`,
  `isTerminalOrHonor(tile): boolean`. All later tasks import from this module.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/tiles/types.ts`:
```typescript
export type Suit = 'man' | 'pin' | 'sou';
export type SuitRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Wind = 'east' | 'south' | 'west' | 'north';
export type Dragon = 'white' | 'green' | 'red';

export interface SuitedTile {
  kind: 'suited';
  suit: Suit;
  rank: SuitRank;
  isRed: boolean;
}

export interface HonorTile {
  kind: 'honor';
  honorType: 'wind' | 'dragon';
  value: Wind | Dragon;
}

export type Tile = SuitedTile | HonorTile;
```

`shared/src/engine/tiles/tiles.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./tiles` module does not exist yet.

- [ ] **Step 3: Implement `tiles.ts`**

`shared/src/engine/tiles/tiles.ts`:
```typescript
import { Tile, SuitedTile, HonorTile, Suit, SuitRank, Wind, Dragon } from './types';

const SUITS: Suit[] = ['man', 'pin', 'sou'];
const WINDS: Wind[] = ['east', 'south', 'west', 'north'];
const DRAGONS: Dragon[] = ['white', 'green', 'red'];

export function suited(suit: Suit, rank: SuitRank, isRed = false): SuitedTile {
  return { kind: 'suited', suit, rank, isRed };
}

export function wind(value: Wind): HonorTile {
  return { kind: 'honor', honorType: 'wind', value };
}

export function dragon(value: Dragon): HonorTile {
  return { kind: 'honor', honorType: 'dragon', value };
}

export function tileTypeKey(tile: Tile): string {
  if (tile.kind === 'suited') return `${tile.suit}${tile.rank}`;
  return `${tile.honorType[0]}-${tile.value}`;
}

export function tilesEqual(a: Tile, b: Tile): boolean {
  return tileTypeKey(a) === tileTypeKey(b);
}

export function allTileTypes(): Tile[] {
  const types: Tile[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) {
      types.push(suited(suit, rank as SuitRank));
    }
  }
  for (const w of WINDS) types.push(wind(w));
  for (const d of DRAGONS) types.push(dragon(d));
  return types;
}

const TYPE_ORDER = allTileTypes().map(tileTypeKey);

export function compareTiles(a: Tile, b: Tile): number {
  return TYPE_ORDER.indexOf(tileTypeKey(a)) - TYPE_ORDER.indexOf(tileTypeKey(b));
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort(compareTiles);
}

export function isTerminal(tile: Tile): boolean {
  return tile.kind === 'suited' && (tile.rank === 1 || tile.rank === 9);
}

export function isHonor(tile: Tile): boolean {
  return tile.kind === 'honor';
}

export function isTerminalOrHonor(tile: Tile): boolean {
  return isTerminal(tile) || isHonor(tile);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/tiles
git commit -m "feat: add tile types and core tile functions"
```

---

## Task 3: Seeded PRNG

**Files:**
- Create: `shared/src/engine/wall/prng.ts`
- Test: `shared/src/engine/wall/prng.test.ts`

**Interfaces:**
- Produces: `RNG` type (`() => number`, returns float in `[0, 1)`), `createRNG(seed: number): RNG`.
  Task 4 (Wall) consumes this for deterministic shuffling.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/wall/prng.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createRNG } from './prng';

describe('createRNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRNG(42);
    const b = createRNG(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces a different first value for a different seed', () => {
    const a = createRNG(1);
    const b = createRNG(2);
    expect(a()).not.toBe(b());
  });

  it('produces values in the [0, 1) range', () => {
    const rng = createRNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./prng` module does not exist yet.

- [ ] **Step 3: Implement `prng.ts`**

`shared/src/engine/wall/prng.ts`:
```typescript
export type RNG = () => number;

/**
 * Mulberry32 — small, fast, deterministic PRNG. Used for wall shuffling so
 * games can be seeded and replayed for tests/debugging.
 */
export function createRNG(seed: number): RNG {
  let state = seed >>> 0;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/wall/prng.ts shared/src/engine/wall/prng.test.ts
git commit -m "feat: add seeded PRNG for deterministic wall shuffling"
```

---

## Task 4: Wall — Construction, Shuffle, Draw, Dead Wall, Dora Indicators

**Files:**
- Create: `shared/src/engine/wall/wall.ts`
- Test: `shared/src/engine/wall/wall.test.ts`

**Interfaces:**
- Consumes: `Tile` (Task 2), `RNG` (Task 3).
- Produces: `Wall { liveWall: Tile[]; deadWall: Tile[]; doraIndicators: Tile[] }`,
  `build136Tiles(): Tile[]`, `buildWall(rng: RNG): Wall`,
  `drawTile(wall: Wall): { tile: Tile; wall: Wall }`, `revealKanDora(wall: Wall): Wall`,
  `remainingDraws(wall: Wall): number`, `doraFromIndicator(indicator: Tile): Tile`.
  Later plans (rules state machine) consume all of these.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/wall/wall.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  build136Tiles, buildWall, drawTile, revealKanDora, remainingDraws, doraFromIndicator,
} from './wall';
import { createRNG } from './prng';
import { suited, wind, dragon, tileTypeKey } from '../tiles/tiles';

describe('build136Tiles', () => {
  it('creates exactly 136 tiles', () => {
    expect(build136Tiles().length).toBe(136);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./wall` module does not exist yet.

- [ ] **Step 3: Implement `wall.ts`**

`shared/src/engine/wall/wall.ts`:
```typescript
import { Tile, SuitRank, Wind, Dragon } from '../tiles/types';
import { allTileTypes, suited } from '../tiles/tiles';
import { RNG } from './prng';

export interface Wall {
  liveWall: Tile[];
  deadWall: Tile[];
  doraIndicators: Tile[];
}

const RED_FIVE_SUITS = ['man', 'pin', 'sou'] as const;

export function build136Tiles(): Tile[] {
  const tiles: Tile[] = [];
  for (const type of allTileTypes()) {
    for (let copy = 0; copy < 4; copy++) {
      const isRedFive =
        type.kind === 'suited' &&
        type.rank === 5 &&
        copy === 0 &&
        (RED_FIVE_SUITS as readonly string[]).includes(type.suit);
      tiles.push({ ...type, isRed: isRedFive } as Tile);
    }
  }
  return tiles;
}

function shuffle(tiles: Tile[], rng: RNG): Tile[] {
  const result = [...tiles];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildWall(rng: RNG): Wall {
  const shuffled = shuffle(build136Tiles(), rng);
  const deadWall = shuffled.slice(0, 14);
  const liveWall = shuffled.slice(14);
  return { liveWall, deadWall, doraIndicators: [deadWall[0]] };
}

export function drawTile(wall: Wall): { tile: Tile; wall: Wall } {
  if (wall.liveWall.length === 0) {
    throw new Error('Cannot draw from an empty live wall');
  }
  const [tile, ...rest] = wall.liveWall;
  return { tile, wall: { ...wall, liveWall: rest } };
}

export function revealKanDora(wall: Wall): Wall {
  const nextIndex = wall.doraIndicators.length;
  const indicator = wall.deadWall[nextIndex];
  if (!indicator) {
    throw new Error('No more dead wall tiles available for a new dora indicator');
  }
  return { ...wall, doraIndicators: [...wall.doraIndicators, indicator] };
}

export function remainingDraws(wall: Wall): number {
  return wall.liveWall.length;
}

const NEXT_RANK: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 1 };
const NEXT_WIND: Record<Wind, Wind> = { east: 'south', south: 'west', west: 'north', north: 'east' };
const NEXT_DRAGON: Record<Dragon, Dragon> = { white: 'green', green: 'red', red: 'white' };

export function doraFromIndicator(indicator: Tile): Tile {
  if (indicator.kind === 'suited') {
    return suited(indicator.suit, NEXT_RANK[indicator.rank] as SuitRank, false);
  }
  if (indicator.honorType === 'wind') {
    return { kind: 'honor', honorType: 'wind', value: NEXT_WIND[indicator.value as Wind] };
  }
  return { kind: 'honor', honorType: 'dragon', value: NEXT_DRAGON[indicator.value as Dragon] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/wall/wall.ts shared/src/engine/wall/wall.test.ts
git commit -m "feat: add wall construction, shuffling, drawing, and dora indicators"
```

---

## Task 5: Standard Hand Decomposition

**Files:**
- Create: `shared/src/engine/hand/decompose.ts`
- Test: `shared/src/engine/hand/decompose.test.ts`

**Interfaces:**
- Consumes: `Tile`, `tileTypeKey`, `sortTiles` (Task 2).
- Produces: `Meld { type: 'sequence' | 'triplet'; tiles: Tile[] }`,
  `decomposeMelds(tiles: Tile[]): Meld[][]` (all valid ways to split a multiple-of-3-length tile
  array into complete melds), `StandardDecomposition { pair: Tile[]; melds: Meld[] }`,
  `decomposeStandardHand(tiles: Tile[]): StandardDecomposition[]` (all valid 4-melds-plus-pair
  decompositions of a 14-tile hand). Later Yaku/Scoring plans consume `decomposeStandardHand` to
  enumerate candidate readings of a winning hand and pick the highest-scoring one.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/hand/decompose.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { decomposeMelds, decomposeStandardHand } from './decompose';
import { suited, wind } from '../tiles/tiles';

describe('decomposeMelds', () => {
  it('decomposes a single triplet', () => {
    const results = decomposeMelds([suited('man', 5), suited('man', 5), suited('man', 5)]);
    expect(results).toHaveLength(1);
    expect(results[0][0].type).toBe('triplet');
  });

  it('decomposes a single sequence', () => {
    const results = decomposeMelds([suited('man', 3), suited('man', 4), suited('man', 5)]);
    expect(results).toHaveLength(1);
    expect(results[0][0].type).toBe('sequence');
  });

  it('decomposes two non-overlapping sequences with only one valid reading', () => {
    const tiles = [
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('man', 7), suited('man', 8), suited('man', 9),
    ];
    const results = decomposeMelds(tiles);
    expect(results).toHaveLength(1);
    expect(results[0].every((m) => m.type === 'sequence')).toBe(true);
  });

  it('finds both readings of the classic 555666777 ambiguous shape (triplets vs. three sequences)', () => {
    const tiles = [
      suited('man', 5), suited('man', 5), suited('man', 5),
      suited('man', 6), suited('man', 6), suited('man', 6),
      suited('man', 7), suited('man', 7), suited('man', 7),
    ];
    const results = decomposeMelds(tiles);
    expect(results).toHaveLength(2);
    const asTriplets = results.some((r) => r.every((m) => m.type === 'triplet'));
    const asSequences = results.some((r) => r.every((m) => m.type === 'sequence'));
    expect(asTriplets).toBe(true);
    expect(asSequences).toBe(true);
  });

  it('returns no decomposition for an invalid group', () => {
    const tiles = [suited('man', 1), suited('man', 2), suited('pin', 3)];
    expect(decomposeMelds(tiles)).toEqual([]);
  });

  it('returns an empty array when tile count is not a multiple of three', () => {
    expect(decomposeMelds([suited('man', 1), suited('man', 2)])).toEqual([]);
  });

  it('returns a single empty decomposition for zero tiles', () => {
    expect(decomposeMelds([])).toEqual([[]]);
  });
});

describe('decomposeStandardHand', () => {
  it('decomposes a complete 14-tile hand into 4 melds + 1 pair', () => {
    const tiles = [
      suited('man', 1), suited('man', 2), suited('man', 3),
      suited('man', 4), suited('man', 5), suited('man', 6),
      suited('pin', 7), suited('pin', 8), suited('pin', 9),
      suited('sou', 2), suited('sou', 2), suited('sou', 2),
      wind('east'), wind('east'),
    ];
    const results = decomposeStandardHand(tiles);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.pair).toHaveLength(2);
      expect(r.melds).toHaveLength(4);
    }
  });

  it('returns an empty array for a hand with no valid decomposition', () => {
    const tiles = [
      suited('man', 1), suited('man', 2), suited('man', 4),
      suited('pin', 1), suited('pin', 2), suited('pin', 4),
      suited('sou', 1), suited('sou', 2), suited('sou', 4),
      wind('east'), wind('south'), wind('west'), wind('north'), wind('north'),
    ];
    expect(decomposeStandardHand(tiles)).toEqual([]);
  });

  it('finds two decompositions when the only valid pair leaves an ambiguous meld run', () => {
    const tiles = [
      suited('man', 5), suited('man', 5), suited('man', 5),
      suited('man', 6), suited('man', 6), suited('man', 6),
      suited('man', 7), suited('man', 7), suited('man', 7),
      suited('pin', 1), suited('pin', 1), suited('pin', 1),
      wind('east'), wind('east'),
    ];
    const results = decomposeStandardHand(tiles);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.pair[0].kind).toBe('honor');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./decompose` module does not exist yet.

- [ ] **Step 3: Implement `decompose.ts`**

`shared/src/engine/hand/decompose.ts`:
```typescript
import { Tile } from '../tiles/types';
import { tileTypeKey, sortTiles } from '../tiles/tiles';

export interface Meld {
  type: 'sequence' | 'triplet';
  tiles: Tile[];
}

export interface StandardDecomposition {
  pair: Tile[];
  melds: Meld[];
}

function groupByType(tiles: Tile[]): Map<string, Tile[]> {
  const map = new Map<string, Tile[]>();
  for (const t of tiles) {
    const key = tileTypeKey(t);
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return map;
}

function removeTiles(tiles: Tile[], toRemove: Tile[]): Tile[] {
  const result = [...tiles];
  for (const tile of toRemove) {
    const index = result.indexOf(tile);
    result.splice(index, 1);
  }
  return result;
}

function findNextRank(tiles: Tile[], reference: Tile, rankOffset: number): Tile | undefined {
  if (reference.kind !== 'suited') return undefined;
  const targetRank = reference.rank + rankOffset;
  if (targetRank > 9) return undefined;
  return tiles.find((t) => t.kind === 'suited' && t.suit === reference.suit && t.rank === targetRank);
}

export function decomposeMelds(tiles: Tile[]): Meld[][] {
  if (tiles.length === 0) return [[]];
  if (tiles.length % 3 !== 0) return [];

  const sorted = sortTiles(tiles);
  const first = sorted[0];
  const byType = groupByType(sorted);
  const results: Meld[][] = [];

  const sameType = byType.get(tileTypeKey(first))!;
  if (sameType.length >= 3) {
    const used = sameType.slice(0, 3);
    for (const rest of decomposeMelds(removeTiles(sorted, used))) {
      results.push([{ type: 'triplet', tiles: used }, ...rest]);
    }
  }

  if (first.kind === 'suited') {
    const second = findNextRank(sorted, first, 1);
    const third = findNextRank(sorted, first, 2);
    if (second && third) {
      const used = [first, second, third];
      for (const rest of decomposeMelds(removeTiles(sorted, used))) {
        results.push([{ type: 'sequence', tiles: used }, ...rest]);
      }
    }
  }

  return results;
}

export function decomposeStandardHand(tiles: Tile[]): StandardDecomposition[] {
  if (tiles.length !== 14) return [];

  const sorted = sortTiles(tiles);
  const byType = groupByType(sorted);
  const results: StandardDecomposition[] = [];

  for (const group of byType.values()) {
    if (group.length < 2) continue;
    const pair = group.slice(0, 2);
    const remaining = removeTiles(sorted, pair);
    for (const melds of decomposeMelds(remaining)) {
      results.push({ pair, melds });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/hand/decompose.ts shared/src/engine/hand/decompose.test.ts
git commit -m "feat: add standard hand meld/pair decomposition"
```

---

## Task 6: Special Hand Shapes — Chiitoitsu and Kokushi

**Files:**
- Create: `shared/src/engine/hand/specialShapes.ts`
- Test: `shared/src/engine/hand/specialShapes.test.ts`

**Interfaces:**
- Consumes: `Tile`, `tileTypeKey`, `isTerminal`, `isHonor` (Task 2).
- Produces: `isChiitoitsu(tiles: Tile[]): boolean`, `isKokushi(tiles: Tile[]): boolean`. Consumed
  by the Shanten calculator (Task 7) and later by Yaku detection.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/hand/specialShapes.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./specialShapes` module does not exist yet.

- [ ] **Step 3: Implement `specialShapes.ts`**

`shared/src/engine/hand/specialShapes.ts`:
```typescript
import { Tile } from '../tiles/types';
import { tileTypeKey, isTerminal, isHonor } from '../tiles/tiles';

function countByType(tiles: Tile[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tiles) map.set(tileTypeKey(t), (map.get(tileTypeKey(t)) ?? 0) + 1);
  return map;
}

export function isChiitoitsu(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = countByType(tiles);
  if (counts.size !== 7) return false;
  return [...counts.values()].every((c) => c === 2);
}

export function isKokushi(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = countByType(tiles);
  let pairSeen = false;
  for (const [key, count] of counts) {
    const tile = tiles.find((t) => tileTypeKey(t) === key)!;
    if (!(isTerminal(tile) || isHonor(tile))) return false;
    if (count === 2) {
      if (pairSeen) return false;
      pairSeen = true;
    } else if (count !== 1) {
      return false;
    }
  }
  return counts.size === 13 && pairSeen;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/hand/specialShapes.ts shared/src/engine/hand/specialShapes.test.ts
git commit -m "feat: add Chiitoitsu and Kokushi shape detection"
```

---

## Task 7: Shanten Calculator

**Files:**
- Create: `shared/src/engine/shanten/shanten.ts`
- Test: `shared/src/engine/shanten/shanten.test.ts`

**Interfaces:**
- Consumes: `Tile`, `tileTypeKey`, `sortTiles` (Task 2), `isChiitoitsu`, `isKokushi` shape logic
  concepts (Task 6 — reimplemented here as counting formulas, not by calling the boolean checks,
  since shanten needs a distance-to-complete rather than a yes/no).
- Produces: `standardShanten(tiles: Tile[]): number`, `chiitoitsuShanten(tiles: Tile[]): number`,
  `kokushiShanten(tiles: Tile[]): number`, `shanten(tiles: Tile[]): number` (the minimum of the
  three). **Precondition: all four functions require exactly 13 tiles** (a closed hand about to
  draw; 0 = tenpai). Open-hand support (fewer concealed tiles because melds are already called)
  is deferred to the rules state machine plan, which will extend this with a called-melds count.
  This calculator is later reused by the AI bots (sub-project 3) to pick discards.

- [ ] **Step 1: Write the failing tests**

`shared/src/engine/shanten/shanten.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: FAIL — `./shanten` module does not exist yet.

- [ ] **Step 3: Implement `shanten.ts`**

`shared/src/engine/shanten/shanten.ts`:
```typescript
import { Tile } from '../tiles/types';
import { tileTypeKey, sortTiles, isTerminal, isHonor } from '../tiles/tiles';

function countByType(tiles: Tile[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tiles) map.set(tileTypeKey(t), (map.get(tileTypeKey(t)) ?? 0) + 1);
  return map;
}

function computeShantenFormula(melds: number, partials: number, hasPair: boolean): number {
  const useful = Math.min(partials, 4 - melds);
  let value = 8 - 2 * melds - useful - (hasPair ? 1 : 0);
  if (!hasPair && melds + useful === 4) value += 1;
  return value;
}

function nextTypeKey(tiles: Tile[], type: string, offset: number): string | undefined {
  const tile = tiles.find((t) => tileTypeKey(t) === type);
  if (!tile || tile.kind !== 'suited') return undefined;
  const targetRank = tile.rank + offset;
  if (targetRank < 1 || targetRank > 9) return undefined;
  return `${tile.suit}${targetRank}`;
}

export function standardShanten(tiles: Tile[]): number {
  if (tiles.length !== 13) {
    throw new Error('standardShanten requires exactly 13 tiles (closed hand, no calls)');
  }
  const sorted = sortTiles(tiles);
  const counts = countByType(sorted);
  const types = [...counts.keys()].sort();

  let best = Infinity;

  function search(
    startIndex: number,
    melds: number,
    partials: number,
    hasPair: boolean,
    remaining: Map<string, number>
  ): void {
    let index = startIndex;
    while (index < types.length && (remaining.get(types[index]) ?? 0) === 0) index++;

    if (index >= types.length) {
      best = Math.min(best, computeShantenFormula(melds, partials, hasPair));
      return;
    }

    const type = types[index];
    const count = remaining.get(type)!;

    if (count >= 3 && melds < 4) {
      const next = new Map(remaining);
      next.set(type, count - 3);
      search(index, melds + 1, partials, hasPair, next);
    }

    const seqNext = nextTypeKey(sorted, type, 1);
    const seqNext2 = nextTypeKey(sorted, type, 2);
    if (seqNext && seqNext2 && melds < 4 && (remaining.get(seqNext) ?? 0) > 0 && (remaining.get(seqNext2) ?? 0) > 0) {
      const next = new Map(remaining);
      next.set(type, count - 1);
      next.set(seqNext, (next.get(seqNext) ?? 0) - 1);
      next.set(seqNext2, (next.get(seqNext2) ?? 0) - 1);
      search(index, melds + 1, partials, hasPair, next);
    }

    if (count >= 2 && !hasPair) {
      const next = new Map(remaining);
      next.set(type, count - 2);
      search(index, melds, partials, true, next);
    }

    if (melds + partials < 4) {
      if (count >= 2) {
        const next = new Map(remaining);
        next.set(type, count - 2);
        search(index, melds, partials + 1, hasPair, next);
      }
      if (seqNext && (remaining.get(seqNext) ?? 0) > 0) {
        const next = new Map(remaining);
        next.set(type, count - 1);
        next.set(seqNext, (next.get(seqNext) ?? 0) - 1);
        search(index, melds, partials + 1, hasPair, next);
      }
      if (seqNext2 && (remaining.get(seqNext2) ?? 0) > 0) {
        const next = new Map(remaining);
        next.set(type, count - 1);
        next.set(seqNext2, (next.get(seqNext2) ?? 0) - 1);
        search(index, melds, partials + 1, hasPair, next);
      }
    }

    search(index + 1, melds, partials, hasPair, remaining);
  }

  search(0, 0, 0, false, counts);
  return best;
}

export function chiitoitsuShanten(tiles: Tile[]): number {
  if (tiles.length !== 13) {
    throw new Error('chiitoitsuShanten requires exactly 13 tiles (closed hand, no calls)');
  }
  const counts = countByType(tiles);
  const pairs = [...counts.values()].filter((c) => c >= 2).length;
  const kinds = counts.size;
  return 6 - pairs + Math.max(0, 7 - kinds);
}

export function kokushiShanten(tiles: Tile[]): number {
  if (tiles.length !== 13) {
    throw new Error('kokushiShanten requires exactly 13 tiles (closed hand, no calls)');
  }
  const counts = countByType(tiles);
  const relevantKeys = new Set<string>();
  for (const t of tiles) {
    if (isTerminal(t) || isHonor(t)) relevantKeys.add(tileTypeKey(t));
  }

  let kinds = 0;
  let hasPair = false;
  for (const key of relevantKeys) {
    const count = counts.get(key) ?? 0;
    if (count > 0) kinds++;
    if (count >= 2) hasPair = true;
  }
  return 13 - kinds - (hasPair ? 1 : 0);
}

export function shanten(tiles: Tile[]): number {
  return Math.min(standardShanten(tiles), chiitoitsuShanten(tiles), kokushiShanten(tiles));
}
```

Note: the unused `KOKUSHI_TYPES` constant and the empty `for` loop in `kokushiShanten` are dead
code left from an intermediate draft — remove both during implementation; `kokushiShanten`'s real
logic is entirely in the `relevantKeys` loop below them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS. If any shanten value doesn't match, treat the test's hand as ground truth, trace
`search()`'s branches by hand for that specific hand, and fix `computeShantenFormula` or the
branch conditions — do not weaken the test.

- [ ] **Step 5: Commit**

```bash
git add shared/src/engine/shanten
git commit -m "feat: add shanten calculator for standard, chiitoitsu, and kokushi hands"
```

---

## Plan Completion Check

After Task 7, run the full suite once more to confirm nothing regressed:

Run: `pnpm --filter @mahjong-live/shared test`
Expected: PASS, all tests across all 7 tasks green.

This completes the foundation layer. Next plans (written after this one is implemented and its
interfaces are exercised): **Yaku + Scoring** (consumes `decomposeStandardHand`, `isChiitoitsu`,
`isKokushi`), then **Round State Machine** (consumes everything above, plus Yaku/Scoring).
