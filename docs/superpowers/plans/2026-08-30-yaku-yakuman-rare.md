# Yaku Detection — Rare Yaku & Yakuman Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (preferred) or `superpowers:executing-plans`. Work task-by-task, keep each task reviewable, and
> record domain decisions as `Ruling:` entries in the ledger below.

**Goal:** Finish the V1 Riichi yaku catalogue that remains after the common-yaku plan, including
Yakuman, rare/situational yaku, Ryanpeikou, the omitted standard 2-han family, and Nagashi Mangan.
At the same time, evolve `WinningHand` just enough to represent Kokushi, open melds, and quads so
future scoring/rules code does not need to reinterpret closed-only fixtures.

**Architecture:** Yaku remain pure functions with no I/O. A resolved `WinningHand` carries the
semantic facts detectors need; detectors never infer round history from array ordering. Standard
hands use a context-level `WinningMeld` that can represent sequence/triplet/quad and whether the
meld is open. The foundation decomposer remains unchanged and continues to return only closed
`Meld` sequence/triplet groups. A later integration layer must translate round state/decomposition
into a semantically correct `WinningHand`.

**Tech Stack:** TypeScript strict mode, Vitest, package `@mahjong-live/shared`.

**Spec:** `docs/superpowers/specs/2026-08-26-core-rules-engine-design.md`

This is Plan 3. It builds on:
- Plan 1: tiles / wall / decomposition / special shapes / shanten
- Plan 2: common yaku + `WinningHand` context + `detectAllYaku`

Plan 4 will implement Dora + Fu + Han/Yakuman-to-points scoring.

---

## Scope

### Explicit handoff scope

- Kokushi Musou
- Suuankou
- Daisangen
- Shousuushii / Daisuushii
- Tsuuiisou
- Chinroutou
- Ryuuiisou
- Chuurenpoutou
- Suukantsu
- Haitei / Houtei / Rinshan Kaihou / Chankan
- Nagashi Mangan
- Ryanpeikou

### Gap-closure scope discovered during Plan 3 review

The core spec requires the full standard V1 yaku list. Plan 2 does not yet cover several ordinary
standard yaku. Before scoring is built, Plan 3 also adds:

- Double Riichi
- Sanshoku Doukou
- Sankantsu
- Honroutou
- Shousangen
- Tenhou
- Chihou

Renhou is intentionally **not** added: it is ruleset-dependent and is not part of the V1 hardcoded
rules in the approved core spec.

---

## V1 Rule Decisions

These are not configurable in Plan 3; they follow the approved core spec.

- Yonma only.
- Nagashi Mangan is enabled.
- Double Yakuman variants are disabled. Kokushi 13-sided wait, Suuankou Tanki, Junsei Chuuren and
  Daisuushii therefore still score exactly one Yakuman each.
- Multiple **different** Yakuman may stack; Plan 4 sums their Yakuman multipliers.
- Kuitan is allowed; therefore this plan finally gives `WinningHand` enough open/closed information
  to remove Plan 2's temporary closed-hand-only assumptions.
- Rare abortive draws remain out of scope.

---

## Ruling Ledger

`Ruling:` **Yakuman representation.** Keep `YakuResult.han` for compatibility with Plan 2 and add
optional `yakuman?: number`. Ordinary yaku return only `han`; Yakuman return
`{ name, han: 0, yakuman: 1 }`. Do not encode Yakuman as 13 han — that would conflate a true
Yakuman with counted-yakuman rules that V1 explicitly disables.

`Ruling:` **Nagashi Mangan is not a WinningHand yaku.** It is an exhaustive-draw settlement based
on a player's discard history. Implement it as a separate pure predicate/result over discard
records; do not put it into `detectAllYaku(hand)`.

`Ruling:` **Kokushi gets a real shape variant.** Add `KokushiWinningHand` to the `WinningHand`
union instead of pretending Kokushi is standard or chiitoitsu.

`Ruling:` **Quads belong to the resolved winning context, not the foundation decomposer.** Add a
context-level `WinningMeld` with `type: 'sequence' | 'triplet' | 'quad'`. Do not change
`decomposeStandardHand`; closed 14-tile decomposition and round-state Kan semantics are different
responsibilities.

`Ruling:` **Open state is carried explicitly.** `WinningMeld.isOpen` is optional only to keep the
already-shipped Plan 2 closed-hand fixtures source-compatible; absent means concealed. New code and
future round-state integration must set it explicitly.

`Ruling:` **Physical tile list.** `WinningHandBase.allTiles` means every physical tile held in the
resolved winning hand. It is 14 tiles for a hand without Kans and can be 15–18 for a standard hand
with Kans. Shape-agnostic all-tile yaku work correctly over this representation.

`Ruling:` **Ryanpeikou supersedes Iipeikou in the detector layer.** `detectIipeikou` must return
null when the four sequences can form two identical-sequence pairs; `detectRyanpeikou` returns
3 han. This fixes the known Plan 2 over-reporting bug before the scorer exists.

`Ruling:` **Wind-family Yakuman are mutually exclusive in detector output.** Daisuushii supersedes
Shousuushii; a Big Four Winds hand must not return both.

`Ruling:` **Common non-Yakuman may still structurally appear beside Yakuman in the aggregate.**
Plan 4 treats any Yakuman result as dominant for base hand value and ignores normal han for points.
This keeps detectors independent while avoiding duplicated family results such as Ryanpeikou /
Iipeikou and Daisuushii / Shousuushii.

`Ruling:` **Winning-tile identity hazard is a hard integration invariant.** No task in this plan may
construct a `WinningHand` by blindly passing raw `decomposeStandardHand()` output when duplicate
copies of the winning tile type can be split across different meld roles. The caller must place the
actual `winningTile` object in the meld it semantically completed. This is required for Pinfu,
Sanankou and Suuankou correctness. See the `HAZARD` comments in
`shared/src/engine/yaku/context.ts`.

---

## Target File Structure

```text
shared/src/engine/yaku/
  context.ts                     # evolved WinningHand / WinningMeld / helpers
  context.test.ts
  situational.ts                 # Double Riichi + Haitei/Houtei/Rinshan/Chankan/Tenhou/Chihou
  situational.test.ts
  rarePatterns.ts                # Ryanpeikou, Sanshoku Doukou, Sankantsu, Honroutou, Shousangen
  rarePatterns.test.ts
  yakumanComposition.ts          # Kokushi, Tsuuiisou, Chinroutou, Ryuuiisou, Chuuren
  yakumanComposition.test.ts
  yakumanGroups.ts               # Suuankou, Daisangen, wind Yakuman, Suukantsu
  yakumanGroups.test.ts
  nagashi.ts                     # Nagashi Mangan draw-settlement predicate
  nagashi.test.ts
  index.ts                       # aggregate all hand yaku
  index.test.ts
```

Existing Plan 2 modules are updated only where the richer resolved meld/open-hand model requires it.

---

## Task 1 — Evolve WinningHand Safely

**Files:**
- Modify `shared/src/engine/yaku/context.ts`
- Modify `shared/src/engine/yaku/context.test.ts`
- Modify Plan 2 detector modules affected by `WinningMeld`

### Interfaces

Add:

```ts
export interface WinningMeld {
  type: 'sequence' | 'triplet' | 'quad';
  tiles: readonly Tile[];
  /** Omitted only by legacy Plan 2 closed-hand fixtures; absent means concealed. */
  isOpen?: boolean;
}

export interface KokushiWinningHand extends WinningHandBase {
  shape: 'kokushi';
}

export function isClosedHand(hand: WinningHand): boolean;
export function isTripletLike(meld: WinningMeld): boolean;
```

Change `StandardWinningHand.melds` to `readonly WinningMeld[]`.

Extend `WinningHandBase` with optional backwards-compatible semantic flags:

```ts
isDoubleRiichi?: boolean;
isTenhou?: boolean;
isChiihou?: boolean;
```

Extend `YakuResult`:

```ts
export interface YakuResult {
  name: string;
  han: number;
  yakuman?: number;
}
```

Update `allTiles` documentation to physical-tile semantics (14–18 with Kans).

### Required behavior

- `isClosedHand(kokushi|chiitoitsu) === true`.
- Standard hand is closed iff no meld has `isOpen === true`.
- `isConcealedMeld` accepts triplets **and quads**, rejects sequences and explicitly-open groups,
  and preserves the Ron-shanpon reference-identity rule.
- `meldContainingTile` accepts/returns `WinningMeld`.

### Retrofit Plan 2 detectors

Now that open state exists, remove their temporary closed-only assumptions:

- Riichi / Ippatsu / Menzen Tsumo require closed hand where applicable.
- Pinfu and Iipeikou require closed hand.
- Sanshoku Doujun: 2 closed / 1 open.
- Ittsuu: 2 closed / 1 open.
- Chanta: 2 closed / 1 open.
- Junchan: 3 closed / 2 open.
- Honitsu: 3 closed / 2 open.
- Chinitsu: 6 closed / 5 open.
- Yakuhai accepts triplet or quad.
- Toitoi accepts triplet or quad.
- Sanankou counts concealed triplets or quads.

Keep Tanyao open-capable (V1 kuitan enabled).

### Verification

- Existing Plan 2 tests remain green.
- Add explicit open-value tests for every reduced-value yaku above.
- Add quad regression tests for Yakuhai / Toitoi / Sanankou.
- `pnpm --filter @mahjong-live/shared typecheck`
- `pnpm --filter @mahjong-live/shared test`

---

## Task 2 — Ryanpeikou + Iipeikou Regression Fix

**Files:**
- Modify `pinfuIipeikou.ts` / tests
- Create `rarePatterns.ts` / tests

Implement a shared sequence-signature pairing helper. For the four melds:

- one pair of identical sequences => Iipeikou 1 han
- two pair-units (two different pairs or four copies of one sequence) => Ryanpeikou 3 han
- Ryanpeikou requires a closed standard hand
- Ryanpeikou must not also return Iipeikou

Tests must include:
- two distinct duplicate sequence pairs
- four identical sequences
- one duplicate pair + two unrelated sequences
- open-hand negative case

---

## Task 3 — Remaining Standard Rare Non-Yakuman

**Files:** `rarePatterns.ts`, `rarePatterns.test.ts`

Implement:

- Sanshoku Doukou — same-rank triplet/quad in man/pin/sou, 2 han
- Sankantsu — exactly three quads, 2 han
- Honroutou — all tiles terminal or honor, 2 han
- Shousangen — two dragon triplet/quads + pair of the third dragon, 2 han

Family exclusions:
- Daisangen later supersedes Shousangen.
- Chinroutou later supersedes Honroutou for an all-terminal Yakuman hand at scoring time; detector
  aggregation may still expose both structural truths, but Plan 4 ignores normal han when Yakuman
  exists.

---

## Task 4 — Situational Yaku

**Files:** `situational.ts`, `situational.test.ts`

Implement:

- Double Riichi — 2 han; supersedes normal Riichi (modify `detectRiichi` to return null when
  `isDoubleRiichi === true`)
- Haitei Raoyue — 1 han, requires `isHaitei` + tsumo
- Houtei Raoyui — 1 han, requires `isHoutei` + ron
- Rinshan Kaihou — 1 han, requires `isRinshan` + tsumo
- Chankan — 1 han, requires `isChankan` + ron
- Tenhou — 1 Yakuman, requires `isTenhou` + tsumo
- Chihou — 1 Yakuman, requires `isChiihou` + tsumo

The round-state machine is responsible for making these history flags truthful and mutually legal.
Detectors still reject the wrong win-condition so malformed fixtures do not silently score.

---

## Task 5 — Composition Yakuman

**Files:** `yakumanComposition.ts`, tests

Implement:

- Kokushi Musou — `shape === 'kokushi'`, 1 Yakuman
- Tsuuiisou — all physical tiles are honors, 1 Yakuman
- Chinroutou — all physical tiles are suited rank 1 or 9, no honors, 1 Yakuman
- Ryuuiisou — only sou 2/3/4/6/8 and green dragon, 1 Yakuman
- Chuurenpoutou — closed standard hand, exactly 14 physical tiles, one suit, counts satisfy
  `1112345678999 + one extra tile of same suit`, 1 Yakuman

Do not detect double variants based on wait shape; V1 double Yakuman is disabled.

---

## Task 6 — Group Yakuman

**Files:** `yakumanGroups.ts`, tests

Implement:

- Suuankou — standard hand with four concealed triplet-like groups. Tsumo is valid; Ron is valid
  only when the winning tile completed the pair (the existing reference-identity helper makes a
  Ron-completed triplet non-concealed).
- Daisangen — triplet/quad of white + green + red dragons.
- Shousuushii — exactly three wind triplet/quads + pair of the fourth wind.
- Daisuushii — four wind triplet/quads; Shousuushii detector must return null in this case.
- Suukantsu — four quads.

Add tests containing quads, not only triplets.

---

## Task 7 — Nagashi Mangan

**Files:** `nagashi.ts`, tests

Define a round-history value object independent of `WinningHand`:

```ts
export interface NagashiDiscard {
  tile: Tile;
  wasCalled: boolean;
}

export interface NagashiManganResult {
  name: 'Nagashi Mangan';
  limit: 'mangan';
}

export function detectNagashiMangan(
  discards: readonly NagashiDiscard[],
): NagashiManganResult | null;
```

Qualifies iff:
- there is at least one discard,
- every discarded tile is terminal or honor,
- none of that player's discards was called by another player.

Whether the round actually reached exhaustive draw belongs to the future round-settlement caller;
this predicate only evaluates the player's discard history.

---

## Task 8 — Aggregate All Hand Yaku

**Files:** `index.ts`, `index.test.ts`

Add all Plan 3 hand detectors to the central aggregator. Keep `detectAllYaku(hand)` as the single
entry point for a resolved winning hand.

Required aggregate regressions:
- Ryanpeikou present, Iipeikou absent.
- Double Riichi present, Riichi absent.
- Daisuushii present, Shousuushii absent.
- A valid multi-Yakuman hand returns multiple separate `yakuman: 1` results.
- A Kokushi hand passes safely through every detector without a standard-shape cast crash.

Document for Plan 4:
- if one or more results have `yakuman`, sum Yakuman multipliers and ignore ordinary han for base
  hand value;
- otherwise sum han after any remaining family exclusivity resolution.

---

## Task 9 — Integration / Hazard Tests

**Files:** add `yaku/rare.integration.test.ts` or extend existing integration tests.

Create at least one ambiguous duplicate-tile case where the same tile type is split between a
sequence and triplet. Verify the test harness explicitly chooses the winning tile object in the
semantic winning group rather than depending on `decomposeStandardHand` input order.

Add a comment pointing to `context.ts` `HAZARD` documentation.

No production helper that constructs `WinningHand` from raw decomposition is allowed in this plan.
That helper belongs with the first real round/scoring integration and must encode the winning-group
choice explicitly.

---

## Task 10 — Final Review Gate

Run:

```bash
pnpm --filter @mahjong-live/shared typecheck
pnpm --filter @mahjong-live/shared test
```

Then review the whole Plan 3 diff for:

1. No Yakuman encoded as 13 han.
2. No double-Yakuman variant accidentally awarded.
3. No Iipeikou + Ryanpeikou stacking.
4. No Shousuushii + Daisuushii stacking.
5. Quads accepted by every triplet-like yaku that should accept them.
6. Open-hand reduced values correct and closed-only yaku gated.
7. Kokushi shape never enters standard-only logic without a shape guard.
8. `WinningHand` construction hazard remains documented and unviolated.
9. Nagashi is kept out of winning-hand aggregation.
10. Plan 4 has a clear contract for han vs Yakuman vs Nagashi Mangan.

After review, merge Plan 3 before writing Plan 4 (Dora + Fu + Scoring).
