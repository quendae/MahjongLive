# Deterministic Rules Edge-Case Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable full-match Riichi rules audit that pins deterministic regression seeds, verifies cross-round invariants, and is runnable locally and in CI.

**Architecture:** Reuse the production `simulateBotMatch` path rather than create a second rules runner. Add QA-only trace data to the existing simulator, then place the invariant checker in a focused bot/rules-audit module. The audit validates completed rounds and match transitions independently from the UI and never changes gameplay state or rule decisions.

**Tech Stack:** TypeScript, Vitest, pnpm, GitHub Actions.

**Spec:** `docs/ROADMAP.md` — “Continue edge-case audit using deterministic full-match simulation and regression seeds.”

## Global Constraints

- Keep the existing deterministic reducer / scoring / match-advance path authoritative.
- Do not change rule behavior unless a regression seed proves a production defect first.
- Audit only public engine state and deterministic bot decisions; no UI dependency.
- Default match safety limits remain 64 rounds and 2048 actions per round unless the test explicitly supplies stricter limits.
- Keep the audit seed list stable so future engine changes replay the same matches.

---

### Task 1: Add full-match trace data to the existing simulator

**Files:**
- Modify: `shared/src/engine/bot/simulate.ts`
- Test: `shared/src/engine/bot/rulesAudit.test.ts`

**Interfaces:**
- Produces `BotRoundTrace` with round number/position, dealer, honba, start/end riichi sticks, start/end points, result, action count and action-type counters.
- `BotMatchSimulation` success and failure results expose `rounds: readonly BotRoundTrace[]`.

- [ ] **Step 1: Write the failing test**

Create `rulesAudit.test.ts` and first assert that a deterministic match returns a non-empty round trace with conserved point ledger:

```ts
const result = simulateBotMatch(20260918, 64, 2048);
expect(result.ok, result.ok ? '' : result.message).toBe(true);
if (!result.ok) return;
expect(result.rounds.length).toBe(result.roundCount);
for (const round of result.rounds) {
  expect(round.endPoints.reduce((sum, value) => sum + value, 0) + round.endRiichiSticks * 1000).toBe(100_000);
}
```

- [ ] **Step 2: Run RED**

Run the focused shared Vitest file in CI. Expected failure: `rounds` / `BotRoundTrace` does not exist yet.

- [ ] **Step 3: Implement minimal trace capture**

Count applied `RoundAction.type` values inside `simulateBotRoundState`, return them with the completed round, and capture start/end match metadata around each call from `simulateBotMatch`.

- [ ] **Step 4: Run GREEN**

Focused audit test must pass without changing any rule reducer behavior.

### Task 2: Add deterministic regression-seed invariant audit

**Files:**
- Create: `shared/src/engine/bot/rulesAudit.ts`
- Modify: `shared/src/engine/bot/index.ts`
- Test: `shared/src/engine/bot/rulesAudit.test.ts`

**Interfaces:**
- `RULE_REGRESSION_SEEDS: readonly number[]`
- `runDeterministicRulesAudit(options?)`
- Result contains one record per seed plus aggregate coverage for `tsumo`, `ron`, `exhaustive-draw`, dealer repeats/advances, Riichi declarations, calls and Kan actions.

- [ ] **Step 1: Extend the failing test**

Assert that the exported fixed seed list runs successfully twice with identical per-seed summaries, that every match ends with four unique placements and conserved final points, and that every adjacent round transition preserves points/riichi sticks while obeying dealer/hand/honba progression.

- [ ] **Step 2: Verify RED**

Expected failure: audit API is not exported.

- [ ] **Step 3: Implement invariant checker**

For every fixed seed:
- require `simulateBotMatch(...).ok === true`;
- require each trace result to be ended and point ledger to remain 100,000 including table Riichi sticks;
- require next-round starting points and Riichi sticks to equal the previous round end;
- independently derive dealer repeat from the previous `RoundEndResult` and verify dealer/position/honba transition;
- require final placements 1..4 with unique players, placement points matching `finalPoints`, and total final points 100,000;
- aggregate action/result coverage.

- [ ] **Step 4: Run seed sweep and pin useful seeds**

Use a deterministic candidate range, inspect aggregate coverage, and keep the smallest stable set that exercises ordinary wins, exhaustive draws, dealer repeat/advance, Riichi, calls and at least one Kan action. Do not weaken invariants to make a seed pass.

### Task 3: Add a repeatable command and CI gate

**Files:**
- Create: `scripts/rules-audit.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/shared-ci.yml`

**Interfaces:**
- `pnpm rules:audit`
- Optional CLI overrides: `--seeds`, `--max-rounds`, `--max-actions`.

- [ ] **Step 1: Add CLI wrapper**

Mirror the existing `bot-benchmark.mjs` pattern and invoke only `src/engine/bot/rulesAudit.test.ts` with `RULE_AUDIT_RUN=1` and optional environment overrides.

- [ ] **Step 2: Add CI gate**

Run a bounded regression-seed audit in Shared engine CI after shared tests and before client build.

- [ ] **Step 3: Verify full CI**

Require Shared engine CI success, including shared typecheck/tests, rules audit, bot benchmark, client typecheck and client build.

### Task 4: Record verified coverage

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update only after GREEN**

Mark the deterministic edge-case audit item complete and record the pinned seed count plus the verified invariant/coverage categories. Keep rule-profile plumbing and save-state compatibility as separate open work.
