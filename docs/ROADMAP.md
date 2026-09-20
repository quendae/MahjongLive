# Mahjong Live Roadmap

Updated: 2026-09-20

This is the authoritative current product backlog. Historical implementation plans under `docs/superpowers/plans/` describe how earlier work was built; they are not necessarily the current priority list.

For a complete handoff snapshot, see [`CURRENT_STATUS.md`](CURRENT_STATUS.md).

## Current stage

Mahjong Live is in **single-player preview playtesting / polish**.

Current implementation branch:

- `feature/visual-table-replay`
- draft PR #33: https://github.com/quendae/MahjongLive/pull/33
- PR intentionally remains unmerged during manual playtesting.

Latest test build:

- `v0.1.0-preview.3`
- https://github.com/quendae/MahjongLive/releases/tag/v0.1.0-preview.3

The project is no longer waiting on major single-player engine features. The immediate goal is to play complete matches, find concrete presentation/gameplay regressions and fix only verified issues before accepting the current preview branch.

## Immediate playtest / polish cycle

- [ ] Complete normal full-match manual playtests of `v0.1.0-preview.3` in 2D.
- [ ] Complete normal full-match manual playtests of `v0.1.0-preview.3` in 3D on real Windows GPU/browser paths.
- [ ] Spot-check a real touch device in portrait and landscape where practical.
- [ ] Fix concrete gameplay/presentation regressions discovered during those playtests.
- [ ] Re-run required engine/browser CI after every accepted fix batch.
- [ ] Decide when PR #33 is ready to leave draft / merge; do not merge solely because automated CI is green.

### Current manual 2D focus

- Riichi declaration tile rotates once and remains stable.
- Left/right/top player discard flight orientation is natural.
- Discard lands without an artificial hop or second landing animation.
- Chi / Pon / Kan groups preserve correct called tile and called-from orientation.
- Dora / Kan-Dora reveal behavior remains stable.
- Ron / Pon / Chi / Pass flow remains readable and correct.
- Round transitions, score explanations and end-of-match settlement remain correct.
- Save/resume survives refresh.
- History and visual replay work after several rounds.

### Current manual 3D focus

- Renderer starts on real GPU/browser combinations.
- Dora remains visible and does not blink during discard rerenders.
- Center counter is readable at normal desktop distance.
- Multiple meld groups stay compact and aligned.
- Discard source/orientation matches the acting seat.
- Hover/lift/settle behavior remains stable.
- Switching 2D <-> 3D does not change game state.
- Failed 3D startup cleanly leaves a playable 2D table with `2D · 3D unavailable`.

## Current focus — table correctness, UX and presentation

- [x] Local FluffyStuff/riichi-mahjong-tiles SVG set for all normal tile faces.
- [x] One face atlas plus merged static face draw path.
- [x] WebGPU-first renderer on Chromium/Edge with WebGL fallback path.
- [x] Built-in FPS/RAF/render telemetry, TXT capture and stress-table benchmark.
- [x] Bottleneck diagnostics: Loop/RAF ratio, scheduler gap, CPU/GPU frame-budget ratios, `syncActors`, reconcile/static-batch cost and shadow-refresh serial.
- [x] Adjustable tile-corner geometry quality.
- [x] Keep renderer/device alive when graphics tuning changes; geometry swaps are in-place.
- [x] WebGL fallback performance work and diagnostics.
- [x] Shared local tile artwork for table, Dora, reactions and choices.
- [x] Strong CHI/PON/KAN/RON announcements with authoritative presentation pauses.
- [x] Human Tenpai/Furiten status and visible waits without concealed-opponent leakage.
- [x] Group-aware meld placement for up to four legal meld groups.
- [x] Live 3D Dev camera/orientation tuning.
- [x] Dedicated live 2D Dev layout tuning.
- [x] Desktop play-space reclaim without permanent move-log column.
- [x] Canonical 2D river clearance and bottom-right human meld placement.
- [x] Source-aware single discard animation with no second landing bounce.
- [x] Stable 2D Riichi declaration orientation across later rerenders.
- [x] Side-seat 2D discard flight rotates into river orientation during travel rather than remaining seat-facing throughout flight.
- [x] 3D Dora mounted outside transient app rerenders so it does not blink/disappear during discards.
- [x] Larger/readable 2D and 3D center counters.
- [x] 3D meld spacing based on actual triplet/Kan size rather than fixed four-tile reservation per group.

## Browser / responsive / touch QA

Automated coverage is substantially complete for the current preview.

- [x] Chromium responsive-layout screenshots for 2D and 3D across desktop/tablet/phone viewports.
- [x] Existing Chromium presentation/responsive bundle: **49/49 passed** before preview.3.
- [x] Firefox cross-browser layouts: **6/6 passed**.
- [x] WebKit cross-browser layouts: **6/6 passed**.
- [x] Chromium mobile touch path using real Playwright `tap()`: **1/1 passed**.
- [x] UI-scale persistence, Escape/focus restoration and no-overflow checks.
- [x] 2D/3D replay parity and autosave isolation checks.
- [x] Clean 2D fallback if 3D/WebGL startup fails.
- [ ] Physical-device spot check for behavior that emulation cannot guarantee.
- [ ] Real Firefox/WebGL GPU spot check on Windows hardware.

Important hosted-CI limitation: Ubuntu Playwright Firefox reports WebGL disabled (`AllowWebgl2:false`). Its 3D request cases therefore validate the production 2D fallback, not actual Firefox GPU rendering.

## Rules and scoring

The production engine has dedicated modules/tests for round flow, waits/Furiten, Riichi, Chi/Pon/Kan, Chankan, Rinshan, Nagashi, scoring, common/rare Yaku and Yakuman.

Current deliberate product ruling:

- **Kan-Dora is revealed immediately when a Kan completes**, including Daiminkan and Shouminkan.
  This supersedes the older historical Tenhou-style delayed-Dora plan.

Completed rule/scoring work:

- [x] Result explanation for Yaku/Han, Dora, Fu, limits and payments.
- [x] Deterministic full-match edge-case audit with pinned regression seeds.
- [x] Central `RuleProfile` plumbing with production `standard` profile. *(on `feature/visual-table-replay` only — no `RuleProfile` or `ruleProfileId` exists on `master`)*
- [x] Persist `ruleProfileId` through match/round state. *(same branch)*
- [x] Legacy save migration when `ruleProfileId` is missing. *(same branch)*
- [x] Save-state compatibility regression tests.

### Deterministic rules audit baseline

`pnpm rules:audit` (present on `feature/visual-table-replay`; **not yet on `master`**) runs six pinned full Hanchan seeds and checks point/Riichi-stick conservation, dealer/wind/hand/Honba continuity, terminal placements and deterministic replay coverage.

Current pinned baseline:

- 58 rounds;
- 13 Tsumo;
- 41 Ron;
- 4 exhaustive draws;
- 15 dealer repeats;
- 43 dealer advances;
- 61 Riichi declarations;
- 102 calls;
- 6 Kans.

Future rule variants should extend the central profile instead of introducing UI-local rule branches.

## Single-player

- [x] Casual / Standard / Expert bot profiles.
- [x] Public-information discard advisor.
- [x] Autosave/resume and seeded deterministic games.
- [x] Deterministic bot calibration statistics with seat rotation and `pnpm bot:benchmark`.
- [x] Better contextual teaching for waits, Furiten, Riichi, calls, Kan and scoring.
- [x] Bot tuning based on calibration statistics.
- [x] Versioned append-only deterministic match history.
- [x] Exact accepted-action and explicit round-advance history.
- [x] JSON history export.
- [x] Visual replay directly on the normal 2D/3D table.
- [x] Replay Start / previous / next / Play-Pause / End seeking and round jumps.
- [x] Replay speeds 0.5x / 1x / 2x / 4x.
- [x] Closing replay restores the exact live state without mutating autosave/history.
- [x] Persistent UI scaling: Compact / Normal / Large / Extra large = 90% / 100% / 115% / 130%.
- [x] Keyboard/focus and automated touch QA.

## Presentation and game feel

- [x] Stage A polish for the fast 2D table.
- [x] User-facing background/table/tile appearance controls shared by 2D and 3D.
- [x] 2D live appearance updates not masked by old Dev preview styles.
- [x] Seat-oriented concealed racks and rivers.
- [x] Source-aware Tsumogiri/Tedashi presentation.
- [x] Clearer player badges and seat-oriented meld groups.
- [x] 3D moving-tile shadow refresh.
- [x] Call/Ron presentation, Dora reveal behavior and result transitions.
- [x] Riichi-stick/table-state presentation.
- [x] Meld orientation based on called-from seat while preserving the exact physical called tile.
- [x] Optional sound cues synchronized from authoritative presentation `RoundEvent` types.
- [x] User-facing 3D quality profiles: Maximum / High / Balanced / Low.

## Performance work — deferred / non-blocking

The previously planned 120 Hz renderer scheduling investigation is **deferred**. It is not a blocker for the current single-player preview or the next multiplayer design stage.

Already completed:

- [x] 96-tile / 24-discards-per-seat automated stress telemetry.
- [x] independent Three-loop Hz vs browser RAF Hz capture.
- [x] scheduler-gap / CPU / GPU / headroom classification.
- [x] elapsed-time / frame-delta animation audit.
- [x] no known frame-count-dependent interaction animation remains in the renderer loop.

If this work is resumed later, the remaining useful evidence is a real Windows hardware capture on:

- Firefox with real WebGL/D3D path;
- Edge/ANGLE;
- a 120 Hz monitor;
- long discard rivers.

Do not change renderer scheduling based only on Linux/headless CI because it cannot reproduce the relevant D3D11/ANGLE/monitor-refresh path.

## Next major stage — multiplayer

Playable multiplayer has **not** shipped. Phase 1 is now closed and an in-memory authoritative
core exists; there is still no transport, so nobody can connect to anything.

Earlier revisions of this roadmap stated multiplayer was untouched. That was wrong: an
authoritative server core was written on `plan8-authoritative-server` (open PR #6) on
2026-08-30 and then abandoned without ever being mentioned here.

Current multiplayer branch:

- `feature/multiplayer-server-core`
- contract: [`MULTIPLAYER_ARCHITECTURE.md`](MULTIPLAYER_ARCHITECTURE.md)

### Phase 1 — architecture contract

Closed. Every decision, and each one's status, is recorded in
[`MULTIPLAYER_ARCHITECTURE.md`](MULTIPLAYER_ARCHITECTURE.md).

- [x] Define authoritative multiplayer state/transport boundary around the deterministic engine.
- [x] Define hidden-information-safe state projection per player.
- [x] Decide server-authoritative validation model vs any deterministic peer responsibilities.
- [x] Define action sequencing, idempotency and replay/event identity.
- [x] Define lobby / room-code lifecycle. *(seating settled; code allocation and join tokens recommended, not settled)*
- [x] Define reconnect / resume semantics.
- [x] Define timeout / disconnect / AFK policy. *(recommended; no clock exists yet)*
- [x] Define spectator/public-history protocol.

### Phase 1b — authoritative core landed

The plan8 core was re-landed fresh against the current engine rather than rebased, because its
branch tip does not typecheck and it forked before the match layer, the bots, the single-player
orchestrator and the deterministic history existed.

- [x] `server/` workspace, filling the slot `pnpm-workspace.yaml` already declared.
- [x] Room session: join/seating, host-only start, ready flags, room registry.
- [x] Command envelope: `commandId` at-most-once execution, `expectedVersion` optimistic concurrency.
- [x] Hidden-information-safe per-viewer projection, allowlist-shaped.
- [x] Reaction-barrier arbitration across concurrently responding seats.
- [x] Room checkpoint / restore as plain JSON.
- [x] Server-held round seed; a client can no longer choose it and derive the wall.
- [x] Leakage tests sweeping all four viewpoints for concealed, live-wall and dead-wall tile IDs.
- [x] Server typecheck and tests wired into `Shared engine CI`.

**PR #6 should be closed** in favour of this branch.

### Phase 2 — multiplayer MVP

Ordered by dependency. Items 1-3 are corrections the landed core needs before transport is
worth writing.

- [x] Match-level room loop: the room holds `MatchState`, advances hands through `advance-round`, settles forced actions like `driveSingleGame`, and `'finished'` now means the *match* ended.
- [x] Derive round seeds with `deriveSingleRoundSeed`. Seeding is unstatable by a caller: `createSeededMatch` / `advanceSeededMatch` in `shared/src/engine/match/orchestration.ts` are the only entry points, and a parity test compares a full hanchan through the room against single-player on the same seed, walls included.
- [x] Project match-level position (`wind`, `hand`, `roundNumber`, status, result) into `RoomView`.
- [x] Invert event projection from a denylist to an exhaustive switch. A new `RoundEvent` is now `TS2366` in `projection.ts` rather than a silent leak.
- [x] Fix checkpoint restore: a reaction-phase checkpoint with no barrier is now rejected instead of silently discarding a pass.
- [ ] Emit `MatchHistoryRecord` from the room; extend it to v2 with a four-seat descriptor instead of `humanSeat` / `botDifficulty`. Deliberately deferred — it changes a persisted format the client reads, and there is no multiplayer match to record until transport exists.
- [x] Turn and reaction deadlines. Time is injected (`tick(now)`, `submit(..., now?)`, `setConnected(..., now)`), never read, so the room stays synchronous and a four-client test needs no fake timers. A room with no clock has no deadline.
- [x] Bot takeover at the `standard` profile after three lapsed turns or a disconnect past the grace period, reclaimable on any accepted command or reconnect. Determinism verified against two independently seeded rooms. Lapsed *reaction* windows deliberately do not count: ignoring a call prompt is ordinary play. History recording of the takeover waits on `MatchHistoryRecord` v2; `SeatBotControl.sinceVersion` is the hook.
- [x] Room-code allocation: six characters, alphabet without `I L O U 0 1`, collision retry, case-insensitive lookup.
- [ ] Join tokens and room TTL. `ClientId` is still unauthenticated, so anyone who learns one can act as that seat. This is a prerequisite for reconnect, not an enhancement.
- [ ] Network transport: WebSocket, envelope framing, per-viewer fan-out.
- [x] Trim the catch-up transition log to the disconnect window, and retain the idempotency cache by version window rather than by 256-entry count.
- [ ] Client multiplayer state layer beside the existing `SingleGameState` path. Largest single item.
- [x] Extract forced-action / seeding / reaction-eligibility decisions into `shared/src/engine/match/orchestration.ts` so the room and `single.ts` cannot drift into two rulesets. The empty-window auto-resolve stays duplicated on purpose: the two control flows differ, and only the eligibility scan is genuinely shared.

### Phase 3 — validation

- [ ] Engine/transport integration tests.
- [ ] Hidden-information leakage tests.
- [ ] Reconnect/resume regression tests.
- [ ] Four-client browser E2E.
- [ ] Deterministic spectator/replay consistency checks.
- [ ] Mobile/touch multiplayer smoke tests.

## Preview acceptance / release policy

A preview build is considered useful for advancement when:

- automated shared engine gates are green;
- browser/responsive gates are green;
- no known blocker corrupts authoritative game state;
- normal manual full-match play does not reveal a repeatable critical gameplay/presentation regression;
- save/resume and deterministic history remain intact.

A green CI run by itself is **not** a reason to merge the large draft PR. Manual normal-play validation is part of the acceptance process.

## Historical plans

Detailed implementation plans under `docs/superpowers/plans/` cover, among other topics:

- rules-engine foundation;
- common, rare and Yakuman Yaku;
- Dora, Fu and scoring;
- Riichi, calls and Furiten;
- Kan / Rinshan / Chankan / Nagashi;
- bot Ukeire and full single-player bots/match flow;
- browser single-player client and presentation timeline;
- bot difficulty/advisor UX;
- game feel and 3D launch;
- full-3D stabilization;
- beginner clarity, Dora tray, reaction popup, central counter, meld and river layout;
- standing-hand face visibility;
- deterministic history and live visual replay.

When a new feature changes a deliberate rules ruling or project-stage decision, update this roadmap and [`CURRENT_STATUS.md`](CURRENT_STATUS.md) rather than silently contradicting an old historical plan.
