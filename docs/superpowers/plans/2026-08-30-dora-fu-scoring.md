# Dora + Fu + Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (preferred) or `superpowers:executing-plans`. Work task-by-task and record domain calls as
> `Ruling:` entries below.

**Goal:** Turn a semantically-resolved `WinningHand` into a complete V1 score: yaku, Dora/Ura/Aka,
Fu, Han/Yakuman limit tier, Ron/Tsumo payments, Honba and Riichi sticks.

**Architecture:** Scoring consumes a **resolved** `WinningHand`; it never decomposes raw tiles and
never guesses which duplicate tile object was the actual winning tile. The future round-state
integration is responsible for generating valid semantic candidate hands. Plan 4 scores one such
candidate deterministically and also exposes a helper for choosing the highest-paying candidate
from already-resolved candidates.

**Tech Stack:** TypeScript strict mode, Vitest, `@mahjong-live/shared`.

**Spec:** `docs/superpowers/specs/2026-08-26-core-rules-engine-design.md`

**Depends on:** Plan 3 merged to `master` (rare yaku/Yakuman, `WinningMeld`, open/quad semantics,
Nagashi Mangan and `YakuResult.yakuman`).

---

## V1 Rule Decisions

- Yonma only.
- Aka Dora: exactly one red five in each suit; the tile model already carries `isRed`.
- Ura Dora and Kan-Ura apply only to Riichi / Double Riichi winners.
- Dora never satisfies the one-yaku requirement by itself.
- Kiriage Mangan is **enabled**, per the approved core spec: 4 han 30 fu and 3 han 60 fu are Mangan.
- A double-wind pair (seat wind == round wind) is 4 fu: 2 fu for each value role, matching the
  Tenhou-style reference rules chosen by the project.
- Kazoe Yakuman is enabled at 13+ ordinary han (including Dora), matching Tenhou. It is a single
  Yakuman-equivalent cap and does not become double at 26+ han.
- True Yakuman dominate ordinary yaku/Dora for base hand value. Different true Yakuman stack.
- Double-Yakuman wait variants remain disabled (Plan 3 already emits each as `yakuman: 1`).
- No pao/liability calculation in this scoring module; the approved core spec did not define it.
  If later round rules add pao, settlement can extend without changing yaku/Fu calculation.

---

## Ruling Ledger

`Ruling:` **Never construct `WinningHand` from raw decomposition here.** `context.ts` documents a
reference-identity hazard when duplicate copies of the winning tile type can be split between meld
roles. `scoreWinningHand` accepts only an already-resolved `WinningHand`. A future integration layer
must explicitly place the real `winningTile` object in the group it semantically completed.

`Ruling:` **One semantic interpretation per score call.** If a physical hand has several legal
interpretations, the caller supplies several resolved `WinningHand` candidates. `scoreBestCandidate`
scores each candidate and selects the highest winner gain, then base points, then han, then fu as
stable tie-breakers. It never calls `decomposeStandardHand` itself.

`Ruling:` **Yaku-family resolution lives before Han summation.** Plan 3 intentionally left Chanta
and Junchan structurally non-exclusive. Scoring removes Chanta when Junchan is present. Other known
families (Riichi/Double Riichi, Iipeikou/Ryanpeikou, Shousuushii/Daisuushii) are already exclusive in
the detectors.

`Ruling:` **Dora are bonus Han, not yaku.** A hand with no actual yaku returns `no-yaku` even if it
contains Dora/Aka. Ura indicators are ignored unless Riichi or Double Riichi is active.

`Ruling:` **True Yakuman and Kazoe are distinct.** A true Yakuman result uses the Plan 3
`yakuman` multiplier and ignores ordinary Han/Dora for point value. Without true Yakuman, 13+ total
ordinary Han becomes one `kazoe-yakuman` limit. Kazoe never stacks with true Yakuman and never
multiplies at 26+.

`Ruling:` **Fu are calculated from semantic meld state.** A Ron-completed triplet is treated as open
for Fu via `isConcealedMeld`, even when the hand itself remains menzen. Quads use the explicit
`WinningMeld.type === 'quad'` and `isOpen` state.

`Ruling:` **Double-wind pair stacks Fu.** Pair Fu is +2 for seat value and +2 for round value; when
both are the same wind the pair contributes 4 Fu.

`Ruling:` **Pinfu and Chiitoitsu keep their fixed Fu.** Chiitoitsu is exactly 25 Fu. Pinfu Tsumo is
20 Fu; Pinfu Ron naturally becomes 30 Fu from menzen-Ron +10. Tsumo +2 is waived for Pinfu.

`Ruling:` **Open 20-Fu Ron becomes 30 Fu.** An open hand that would otherwise end at exactly 20 Fu
is scored as 30 Fu. All other non-Chiitoitsu Fu totals round upward to the next 10.

`Ruling:` **Settlement rounds each payment independently to 100.** Ron uses base x4 (non-dealer) or
x6 (dealer). Tsumo: dealer winner receives base x2 from each opponent; non-dealer winner receives
base x2 from dealer and base x1 from each other non-dealer. Honba adds 300 total on Ron, or 100 to
each Tsumo payer. Riichi sticks add 1000 each to winner gain after hand payments.

`Ruling:` **Nagashi Mangan remains outside `scoreWinningHand`.** It has no WinningHand/Yaku/Fu
calculation. A small settlement helper may reuse Mangan payment rules later, but the Plan 3
`detectNagashiMangan` predicate stays separate.

---

## Target File Structure

```text
shared/src/engine/scoring/
  dora.ts
  dora.test.ts
  fu.ts
  fu.test.ts
  limits.ts
  limits.test.ts
  payments.ts
  payments.test.ts
  score.ts
  score.test.ts
  integration.test.ts
  index.ts
```

---

## Task 1 — Dora Indicator Mapping and Bonus Counting

**Files:** `scoring/dora.ts`, `scoring/dora.test.ts`

Interfaces:

```ts
export interface DoraContext {
  doraIndicators: readonly Tile[];
  uraIndicators?: readonly Tile[];
}

export interface DoraBreakdown {
  dora: number;
  uraDora: number;
  akaDora: number;
  total: number;
}

export function doraFromIndicator(indicator: Tile): Tile;
export function countDora(hand: WinningHand, context: DoraContext): DoraBreakdown;
```

Mapping:
- suited 1→2 ... 8→9, 9→1
- winds East→South→West→North→East
- dragons White→Green→Red→White

Counting:
- every physical matching tile counts once **per indicator** (duplicate indicators stack)
- `isRed === true` adds one Aka Dora independently of normal indicator Dora
- Ura indicators count only when `hand.isRiichi || hand.isDoubleRiichi`
- all active normal + Kan indicators are simply supplied in `doraIndicators`; scorer does not infer
  Kan timing from hand shape

Tests include rank/honor wraparound, duplicate indicators, a red five that is also normal Dora, Ura
with/without Riichi, and quads containing four matching Dora tiles.

---

## Task 2 — Fu Breakdown

**Files:** `scoring/fu.ts`, `scoring/fu.test.ts`

Interfaces:

```ts
export interface FuComponent {
  source: string;
  fu: number;
}

export interface FuResult {
  fu: number;
  rawFu: number;
  components: readonly FuComponent[];
  fixed: 'chiitoitsu' | 'pinfu-tsumo' | null;
}

export function calculateFu(hand: WinningHand, yaku: readonly YakuResult[]): FuResult | null;
```

Rules:
- Kokushi: `null` (Fu irrelevant).
- Chiitoitsu: fixed 25.
- Standard base: 20.
- closed Ron: +10.
- Tsumo: +2 except when Pinfu is present.
- sequence: 0.
- triplet simple: open 2 / concealed 4.
- triplet terminal/honor: open 4 / concealed 8.
- quad simple: open 8 / concealed 16.
- quad terminal/honor: open 16 / concealed 32.
- value pair: +2 dragon, +2 seat wind, +2 round wind; double wind therefore +4.
- wait: +2 tanki / kanchan / penchan; +0 ryanmen / shanpon.
- open Ron with raw 20 => 30.
- otherwise round upward to next multiple of 10.
- Pinfu Tsumo => fixed 20.

Wait classification must use the exact `winningTile` object reference. The test suite includes a
comment linking to the `context.ts` HAZARD.

---

## Task 3 — Han/Fu to Base-Point Limit

**Files:** `scoring/limits.ts`, tests

Interfaces:

```ts
export type LimitName =
  | 'none'
  | 'mangan'
  | 'haneman'
  | 'baiman'
  | 'sanbaiman'
  | 'kazoe-yakuman'
  | 'yakuman'
  | 'multiple-yakuman';

export interface BasePointResult {
  basePoints: number;
  limit: LimitName;
}

export function calculateBasePoints(han: number, fu: number, yakuman: number): BasePointResult;
```

Rules:
- `yakuman >= 1`: base 8000 × multiplier, `yakuman` / `multiple-yakuman`.
- no true Yakuman:
  - 13+ Han => Kazoe Yakuman, base 8000.
  - 11–12 => Sanbaiman, 6000.
  - 8–10 => Baiman, 4000.
  - 6–7 => Haneman, 3000.
  - 5 => Mangan, 2000.
  - Kiriage: 4h30f and 3h60f => Mangan.
  - Otherwise `fu * 2^(han+2)`, capped at 2000 (so 4h40f / 3h70f naturally become Mangan).

Tests cover every boundary, including 12→13 Han, 26 Han still one Kazoe, Kiriage cases, and
multiple true Yakuman.

---

## Task 4 — Ron/Tsumo Settlement

**Files:** `scoring/payments.ts`, tests

Interfaces:

```ts
export interface SettlementContext {
  honba: number;
  riichiSticks: number;
}

export type PaymentResult =
  | {
      type: 'ron';
      fromDiscarder: number;
      handPayment: number;
      riichiBonus: number;
      winnerGain: number;
    }
  | {
      type: 'tsumo-dealer';
      fromEach: number;
      handPayment: number;
      riichiBonus: number;
      winnerGain: number;
    }
  | {
      type: 'tsumo-nondealer';
      fromDealer: number;
      fromEachNonDealer: number;
      handPayment: number;
      riichiBonus: number;
      winnerGain: number;
    };

export function calculatePayments(
  basePoints: number,
  hand: WinningHand,
  context: SettlementContext,
): PaymentResult;
```

Round each payer's base obligation upward to 100 before adding Honba. Add Honba exactly once per
payer obligation as described in the Ruling ledger.

---

## Task 5 — Score Orchestration

**Files:** `scoring/score.ts`, tests

Interfaces:

```ts
export interface ScoredHand {
  status: 'scored';
  yaku: readonly YakuResult[];
  scoringYaku: readonly YakuResult[];
  dora: DoraBreakdown;
  yakuHan: number;
  bonusHan: number;
  han: number;
  yakuman: number;
  fu: FuResult | null;
  base: BasePointResult;
  payments: PaymentResult;
}

export interface NoYakuScore {
  status: 'no-yaku';
  yaku: readonly YakuResult[];
  dora: DoraBreakdown;
}

export type ScoreResult = ScoredHand | NoYakuScore;

export function scoreWinningHand(
  hand: WinningHand,
  dora: DoraContext,
  settlement: SettlementContext,
): ScoreResult;
```

Pipeline:
1. `detectAllYaku(hand)`.
2. Count Dora independently.
3. If no actual yaku at all: return `no-yaku` even if Dora > 0.
4. Resolve ordinary family exclusivity (Junchan removes Chanta).
5. Sum true Yakuman multipliers.
6. If true Yakuman > 0: ordinary yaku/Dora remain available for display but do not contribute to
   point value; `han = 0`, `fu = null`, calculate true-Yakuman base.
7. Otherwise sum ordinary yaku Han + Dora/Ura/Aka bonus Han.
8. Calculate Fu and base limit.
9. Calculate payments including Honba and Riichi sticks.

---

## Task 6 — Highest-Scoring Resolved Interpretation

**Files:** `score.ts`, `score.test.ts`

```ts
export function scoreBestCandidate(
  hands: readonly WinningHand[],
  dora: DoraContext,
  settlement: SettlementContext,
): ScoreResult | null;
```

- empty candidate list => null
- discard `no-yaku` candidates if any scored candidate exists
- choose largest `payments.winnerGain`
- tie-break by `base.basePoints`, then `han`, then `fu?.fu ?? 0`
- if all candidates are `no-yaku`, return the first stable result

This helper does **not** build candidates and therefore does not violate the winning-tile identity
hazard.

---

## Task 7 — End-to-End Scoring Regressions

**Files:** `scoring/integration.test.ts`

Cover at minimum:

1. Closed Ron, ordinary yaku + Fu + Dora.
2. Non-dealer Tsumo split payments.
3. Dealer Tsumo split payments.
4. Chiitoitsu fixed 25 Fu.
5. Pinfu Tsumo fixed 20 Fu.
6. Double-wind pair contributes 4 Fu.
7. Ron-completed shanpon triplet uses open-triplet Fu while hand remains menzen.
8. Open hand reduced yaku + open meld Fu.
9. Red five simultaneously counted as Aka and indicator Dora.
10. Riichi with Ura Dora versus identical non-Riichi hand.
11. Kiriage 4h30f and 3h60f Mangan boundaries.
12. 13+ Han Kazoe Yakuman.
13. True single/multiple Yakuman ignoring ordinary Han/Dora for point value.
14. No-yaku hand with several Dora remains illegal/no-yaku.
15. Two semantic candidates where the lower-Han interpretation wins on points because of Fu, or
    where yaku difference beats Fu; highest winner gain must be selected.

---

## Task 8 — Public Exports and Final Gate

**Files:** `scoring/index.ts`

Export the Plan 4 public surface from the scoring module.

Run:

```bash
pnpm --filter @mahjong-live/shared typecheck
pnpm --filter @mahjong-live/shared test
```

Final review checklist:

1. Dora cannot create a legal hand without yaku.
2. Ura Dora is impossible without Riichi/Double Riichi.
3. Red Dora stacks with indicator Dora.
4. Kans count all physical copies for Dora and correct Fu class.
5. Ron shanpon uses open-triplet Fu through semantic winning-tile identity.
6. Double-wind pair = 4 Fu.
7. Chiitoitsu = 25 Fu; Pinfu Tsumo = 20 Fu.
8. Open 20-Fu Ron becomes 30 Fu.
9. Kiriage is enabled despite Tenhou's different default.
10. 13+ ordinary Han = single Kazoe Yakuman; true Yakuman stack separately.
11. Honba and Riichi-stick arithmetic is separated and payer rounding is per obligation.
12. No production code reconstructs `WinningHand` from `decomposeStandardHand`.
