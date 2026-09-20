# Mahjong Live — Current Project Status

Updated: 2026-09-20

This document is the authoritative handoff snapshot for the current development stage.
It is intentionally stored on the default `master` branch even though the newest gameplay/presentation work is still being validated on `feature/visual-table-replay` in draft PR #33.

## Executive summary

Mahjong Live is a browser Riichi Mahjong game built around a deterministic TypeScript rules engine.
The single-player game, bots, scoring, autosave, teaching/advisor layer, 2D table, 3D table, deterministic history and live visual replay are all implemented.

The project is currently in a **playtest / polish / release-candidate validation stage** rather than a foundational implementation stage.
The latest downloadable build is:

- **v0.1.0-preview.3**
- Release: https://github.com/quendae/MahjongLive/releases/tag/v0.1.0-preview.3
- ZIP: https://github.com/quendae/MahjongLive/releases/download/v0.1.0-preview.3/mahjong-live-v0.1.0-preview.3.zip

The active implementation branch is:

- `feature/visual-table-replay`
- draft PR #33: https://github.com/quendae/MahjongLive/pull/33
- PR remains intentionally **unmerged** while manual playtesting continues.

## Branch and release model

### `master`

The default branch. It contains the stable repository baseline and the authoritative project documentation.
The current status and roadmap are kept here even when the newest implementation is still under validation in a feature branch.

### `feature/visual-table-replay`

Current active implementation branch. It contains the latest replay/presentation/accessibility/cross-browser work and the fixes included in preview builds.

### `release-preview/*`

Temporary release branches used to package static preview ZIPs without merging PR #33.
The preview workflow derives the release tag from the branch name, for example:

`release-preview/v0.1.0-preview.3` -> `v0.1.0-preview.3`

## What is implemented

### Rules engine and scoring

The deterministic engine already covers the main Riichi flow and scoring stack:

- round and match progression;
- draws, discards and turn legality;
- Chi / Pon / Kan;
- Riichi;
- Furiten and waits;
- Rinshan / Chankan / Nagashi handling;
- common and rare Yaku;
- Yakuman;
- Dora and Kan-Dora;
- Fu calculation;
- Ron / Tsumo payments;
- dealer continuation, Honba and Riichi sticks;
- match-end placements and score settlement.

Current deliberate product decision:

- **Kan-Dora is revealed immediately when a Kan completes**, including Daiminkan and Shouminkan.

A stable `ruleProfileId` flows through match and round state **on `feature/visual-table-replay`**. Neither `RuleProfile` nor `ruleProfileId` exists on `master`; the plumbing lands when PR #33 merges. Only the production `standard` profile is currently exposed; the plumbing exists so future rule variants do not require hard-coded forks throughout the engine.

Legacy saves that predate `ruleProfileId` are migrated in memory to `standard` and are covered by compatibility tests.

### Deterministic rules audit

`pnpm rules:audit` runs six pinned full-Hanchan seeds through the production engine and verifies the following. The script and its package entry live on `feature/visual-table-replay`; on a fresh `master` checkout the command does not exist yet.

- point conservation;
- Riichi-stick conservation;
- round / wind / dealer continuity;
- Honba continuity;
- terminal placements;
- deterministic replay coverage.

The pinned audit baseline covers:

- 58 rounds;
- 13 Tsumo;
- 41 Ron;
- 4 exhaustive draws;
- 15 dealer repeats;
- 43 dealer advances;
- 61 Riichi declarations;
- 102 calls;
- 6 Kans.

### Single-player

Implemented:

- Casual / Standard / Expert bot profiles;
- deterministic seeded games;
- autosave and resume;
- public-information discard advisor;
- contextual `Hint` / `Why?` teaching for waits, Furiten, legal calls, Riichi, Kan and scoring;
- deterministic bot calibration and `pnpm bot:benchmark`;
- expandable score explanation with Yaku, Han, Dora, Fu, limit and payment details;
- append-only deterministic match history;
- JSON history export;
- replay reconstruction from accepted actions and explicit round advances;
- visual replay directly on the normal 2D or 3D table;
- replay Start / previous / next / Play-Pause / End controls;
- round jumps;
- playback speeds 0.5x / 1x / 2x / 4x;
- replay isolation from the live autosave/history state.

### 2D table

The 2D table is the fast, accessible DOM-first presentation and remains a complete playable fallback.

Implemented/polished:

- seat-oriented concealed opponent racks;
- player discard rivers around the center counter;
- source-aware Tsumogiri / Tedashi discard presentation;
- single discard flight without a second landing bounce;
- Riichi declaration tile rotation that remains stable after later discards;
- Chi / Pon / Kan meld groups and called-from orientation;
- human melds anchored at the bottom-right table edge;
- Dora and Kan-Dora presentation;
- Tenpai / Furiten guidance;
- call / Ron announcements;
- result transitions;
- responsive desktop / tablet / phone layout;
- dedicated Dev tuning controls for 2D layout.

### 3D table

The optional Three.js table is a presentation layer derived from authoritative game state; it does not own rules or mutate the match.

Implemented/polished:

- WebGPU-first path on Chromium/Edge where available;
- WebGL fallback path;
- physical racks, rivers, melds and table geometry;
- local hand interaction, hover/lift/settle and discard motion;
- seat-correct discard orientation;
- exact physical called-tile migration into melds;
- compact meld grouping based on actual 3/4-tile meld size;
- stable Dora tray outside transient app rerenders;
- larger/readable center panel;
- live camera / orientation / geometry tuning in Dev;
- quality presets in user-facing Options: Maximum / High / Balanced / Low;
- renderer/device reuse when graphics tuning changes;
- cached shadow refresh during moving tiles;
- performance telemetry and stress-table diagnostics.

If 3D initialization fails, the game now falls back cleanly to playable 2D and exposes:

`2D · 3D unavailable`

instead of leaving the 3D toggle in an endless loading state.

### Presentation and accessibility

Implemented:

- local public-domain FluffyStuff Riichi SVG artwork;
- shared tile-art source for table, Dora, reactions and choices;
- optional sound cues driven by authoritative presentation event types;
- persistent UI scaling presets: Compact 90%, Normal 100%, Large 115%, Extra large 130%;
- scale changes affect UI chrome/dialogs/guidance but not table geometry;
- keyboard / focus restoration checks;
- responsive mobile/landscape/portrait layout tests;
- user-facing table/background/tile appearance controls shared by 2D and 3D.

## Latest verified QA state

Latest complete automated validation before `v0.1.0-preview.3`:

- Shared engine CI #466: **SUCCESS**;
- Responsive table QA #268: **SUCCESS**;
- Chromium presentation/responsive bundle: **49/49 passed**;
- Firefox cross-browser layouts: **6/6 passed**;
- WebKit cross-browser layouts: **6/6 passed**;
- Chromium mobile real Playwright `tap()` path: **1/1 passed**.

The touch test covers real `tap()` interactions for game setup, Options, UI-scale selection and a human discard rather than substituting mouse clicks.

### Important Firefox CI limitation

Hosted Ubuntu Playwright Firefox exposes no WebGL (`AllowWebgl2:false`). Therefore Firefox CI verifies:

- 2D behavior/layout;
- correct request for 3D;
- clean 2D fallback when WebGL is unavailable;
- correct `3D unavailable` UI state.

It does **not** prove real Firefox/WebGL GPU rendering on Windows hardware.

## Preview.3 manual test focus

Manual playtesting should now concentrate on normal game flow rather than synthetic micro-tests.

### Full-match 2D pass

Check:

- Riichi declaration and sideways tile stability;
- left/right/top player discard flight orientation;
- no artificial discard hop before landing;
- Chi / Pon / Kan placement and called tile orientation;
- Dora and Kan-Dora reveal behavior;
- Ron / Pon / Chi / Pass reaction flow;
- round transitions and end-of-match scoring;
- save/resume after refresh;
- history and visual replay after several rounds.

### Full-match 3D pass

Check:

- renderer startup on real GPU/browser;
- Dora remains visible and does not blink during discards;
- center panel readability;
- meld spacing for multiple meld groups;
- discard source and seat orientation;
- hover/lift/settle behavior;
- switching between 2D and 3D;
- clean fallback if 3D cannot initialize.

### Device pass

Check a real phone/tablet where practical:

- portrait and landscape;
- touch-only play;
- Options and UI scaling;
- no unreachable controls;
- no horizontal page overflow.

## How to run the preview ZIP correctly

The preview ZIP is a **built static site**, not a source checkout.

1. Download and extract `mahjong-live-v0.1.0-preview.3.zip`.
2. Enter the extracted build directory that contains `index.html`.
3. Start the HTTP server **inside that directory**:

```bash
python -m http.server 8080
```

4. Open:

`http://localhost:8080`

If the browser shows **Directory listing for /** with entries such as `.github/`, `client/`, `shared/`, `package.json`, etc., the HTTP server was started from the **repository source root**, not from the built preview directory.

For a source checkout, use the repository launcher instead:

### Windows

```text
START_GAME.bat
```

### macOS / Linux

```bash
sh start-game.sh
```

or:

```bash
pnpm start
```

## Developer commands

```bash
pnpm dev               # start source checkout without auto-opening browser
pnpm client:build      # production client build
pnpm client:typecheck  # client TypeScript validation
pnpm rules:audit       # deterministic six-seed full-match rules audit (feature/visual-table-replay only)
pnpm bot:benchmark     # reproducible bot calibration benchmark
pnpm check             # shared typecheck/tests + client typecheck/build
```

## Current open work

### Immediate

- manual playtest of `v0.1.0-preview.3`;
- fix only concrete gameplay/presentation regressions discovered during normal play;
- keep PR #33 draft/unmerged until the preview is accepted.

### Next major stage

**Multiplayer.** The design pass is done and an authoritative in-memory core now exists.
Playable multiplayer does not: there is no transport, so nothing can connect yet.

An earlier revision of this file said multiplayer had not been touched. That was inaccurate.
A complete authoritative server core was written on `plan8-authoritative-server` (open PR #6) on
2026-08-30, then abandoned and never recorded here. Its branch tip does not typecheck, and it
forked before the match layer, the bots, the single-player orchestrator and the deterministic
history landed, so it was re-landed fresh rather than rebased.

Current multiplayer branch: `feature/multiplayer-server-core`.

Landed there:

- `server/` workspace filling the slot `pnpm-workspace.yaml` already declared;
- room sessions, seating, host-only start and a room registry;
- command envelope with `commandId` at-most-once execution and `expectedVersion` concurrency;
- allowlist-shaped per-viewer projection, with leakage tests over all four viewpoints;
- reaction-barrier arbitration;
- checkpoint / restore as plain JSON;
- server-held round seed, so a client can no longer choose it and derive the wall;
- server typecheck and tests in `Shared engine CI`.

Design contract: [`MULTIPLAYER_ARCHITECTURE.md`](MULTIPLAYER_ARCHITECTURE.md).

Since landed on the same branch: the room holds `MatchState` and plays a full hanchan; seeding goes
through `shared/src/engine/match/orchestration.ts` so a recorded match cannot replay to a different
game; event projection is an exhaustive switch, making a new `RoundEvent` a compile error rather
than a leak; match-level position is projected into the room view; and a reaction-phase checkpoint
that lost its barrier is rejected rather than silently dropping a pass.

Also landed: turn and reaction deadlines with time injected rather than read, so the room stays
synchronous and testable without fake timers; bot takeover at the `standard` profile, reclaimable,
verified deterministic; room-code allocation; and bounded retention for the catch-up log and the
idempotency cache.

Seats are now authenticated by a server-issued join token, and rooms expire on injected time.

A room now survives its own invariant failures without taking the process down, and there is a
running server: `pnpm --filter @mahjong-live/server start` serves create/join over HTTP and the
match over one WebSocket per client.

Phase 3 validation passes on the server side: four clients play a full match over real sockets
deciding only from their own projections, a whole-match wire audit finds no hidden tile on any
client's stream, reconnect resumes in both the tail and trimmed cases, and two rooms on one seed
produce identical spectator streams.

Not built, in dependency order: the client multiplayer state layer (the largest remaining item —
the client is built around `SingleGameState` end to end, and this collides with draft PR #33),
four-client browser E2E, mobile/touch multiplayer smoke tests, and history emission with
`MatchHistoryRecord` v2 (deferred — it changes a persisted format the client reads).

PR #6 should be closed in favour of the fresh branch.

### Deferred / non-blocking

120 Hz renderer scheduling work is **deferred** and is not a release blocker for the current single-player preview.
The existing code already records RAF/loop/GPU/CPU timing and uses elapsed-time/delta-driven animation rather than frame-count-driven animation.

If revisited later, the remaining useful measurement is a real Windows hardware capture on:

- Firefox with real WebGL/D3D path;
- Edge/ANGLE;
- a 120 Hz monitor;
- long discard rivers.

## Architecture guardrails

- `shared/` remains the deterministic source of truth for Mahjong state and rules.
- The client presentation must not silently own or mutate Mahjong rules.
- 2D remains a complete playable path and fallback.
- 3D is derived presentation, not a second rules implementation.
- Save compatibility requires regression coverage whenever engine state schema changes.
- Rule changes belong in the central rule profile / explicit product decisions, not ad-hoc UI conditionals.
- Multiplayer must preserve hidden information and deterministic validation boundaries.

## Handoff rule

Before starting a large new feature, update this file and `docs/ROADMAP.md` if the actual project state has changed.
Historical plans under `docs/superpowers/plans/` are implementation history, not necessarily the current backlog.
