# Plan 12 — Single-player UX and bot difficulty

Date: 2026-08-30
Branch: `plan12-single-ux-difficulty`

## Goal

Make the browser single-player client easier to learn and tune without weakening the authoritative rules engine or allowing bots/advisor code to read hidden opponent information.

## Scope

1. Bot difficulty profiles:
   - **Casual** — legal wins/draws, shanten-first discards, no public-information defense/ukeire tie-breaks, no voluntary Chi/Pon/Daiminkan.
   - **Standard** — shanten + genbutsu + Dora/shape preservation and yaku-safe calls, but no ukeire tie-break.
   - **Expert** — current strongest profile including public-information ukeire.
2. Persist difficulty inside `SingleGameState`; old saves without the field resolve to Expert for behavior compatibility.
3. Add a public-information discard advisor for the human player using the same structural shanten/ukeire primitives. Hidden opponent concealed tiles must not affect its result.
4. Client preferences:
   - difficulty selector,
   - optional advisor toggle,
   - first-run tutorial acknowledgement.
5. UX:
   - recommended-discard highlighting when advisor is enabled,
   - compact shanten/ukeire explanation in the action dock,
   - difficulty visible in the header,
   - setup/tutorial overlay for first launch/new hanchan,
   - preserve autosave/resume.
6. Keep multiplayer/server out of scope.

## Validation

- TDD for difficulty behavior and save compatibility.
- Advisor invariance test against changes to hidden opponent hands.
- Existing bot full-hanchan deterministic simulation remains green for default/Expert behavior.
- Client strict typecheck and production Vite build remain green.
- Frozen lockfile remains unchanged.
