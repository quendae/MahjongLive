# Mahjong Live

Riichi Mahjong in the browser with an authoritative deterministic TypeScript rules engine, single-player bots, a fast 2D table and an optional WebGPU/WebGL 3D table.

## Current development status

Mahjong Live is currently in a **single-player playtest / polish stage** rather than early implementation.
The newest gameplay/presentation work is still being validated on `feature/visual-table-replay` in draft PR #33 and has **not** been merged into `master` yet.

Latest downloadable test build:

- **v0.1.0-preview.3**
- Release: https://github.com/quendae/MahjongLive/releases/tag/v0.1.0-preview.3
- ZIP: https://github.com/quendae/MahjongLive/releases/download/v0.1.0-preview.3/mahjong-live-v0.1.0-preview.3.zip

For the complete current-stage handoff, implemented feature inventory, QA evidence, known limitations and manual test checklist, see:

- [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)

## What is already implemented

### Game / rules

- deterministic Riichi round and match engine;
- Chi / Pon / Kan, Riichi, Furiten, Rinshan, Chankan and Nagashi handling;
- common/rare Yaku and Yakuman;
- Dora / Kan-Dora, Fu and payment calculation;
- result explanation with Yaku, Han, Dora, Fu, limits and payments;
- stable production `standard` rule profile plumbing;
- legacy save compatibility;
- deterministic full-match rules audit.

Current product ruling: **Kan-Dora is revealed immediately when a Kan completes**, including Daiminkan and Shouminkan.

### Single-player

- Casual / Standard / Expert bots;
- seeded deterministic games;
- autosave and resume;
- public-information discard advisor;
- contextual `Hint` / `Why?` teaching;
- reproducible bot benchmark/calibration;
- append-only deterministic match history and JSON export;
- read-only visual replay on the normal 2D or 3D table;
- replay seek, pause/play, round jumps and 0.5x / 1x / 2x / 4x speed controls.

### Presentation

- full playable 2D DOM table;
- optional Three.js 3D table;
- WebGPU-first rendering on supported Chromium/Edge environments;
- WebGL fallback path;
- safe fallback to playable 2D when 3D initialization fails;
- local public-domain FluffyStuff Riichi SVG artwork;
- seat-aware racks, rivers and melds;
- source-aware discard presentation;
- Riichi markers, Dora/Kan-Dora, call/Ron announcements and result transitions;
- user-facing appearance controls and 3D quality presets;
- persistent UI scale presets: 90% / 100% / 115% / 130%;
- optional sound synchronized to authoritative presentation events.

## Latest automated QA snapshot

Before `v0.1.0-preview.3` the current implementation passed:

- Shared engine CI #466: **SUCCESS**;
- Responsive table QA #268: **SUCCESS**;
- Chromium presentation/responsive suite: **49/49**;
- Firefox cross-browser layouts: **6/6**;
- WebKit cross-browser layouts: **6/6**;
- Chromium mobile real Playwright `tap()` path: **1/1**.

Hosted Linux Firefox has WebGL disabled by the environment, so CI validates the production 2D fallback there; real Firefox/WebGL GPU behavior remains a hardware spot-check rather than a CI guarantee.

## Test the latest preview

The preview ZIP is a built static site.

1. Download and extract `mahjong-live-v0.1.0-preview.3.zip`.
2. Enter the extracted directory that contains `index.html`.
3. Start a local server **from that directory**:

```bash
python -m http.server 8080
```

4. Open:

```text
http://localhost:8080
```

### If you see `Directory listing for /`

If the page lists `.github/`, `client/`, `shared/`, `package.json`, `README.md`, etc., you started Python from the **source repository root** instead of the built preview directory.

For a source checkout, use the normal project launcher instead.

## Play locally from source — easiest way

### Windows

1. Install **Node.js 20+** if needed.
2. Download / clone the repository.
3. Double-click **`START_GAME.bat`**.

On first run the launcher installs project dependencies, starts the local game server and opens the browser.
If Node.js is missing, it opens the Node.js download page instead of failing silently.

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
pnpm dev               # start without opening a browser
pnpm client:build      # production client build
pnpm client:typecheck  # client TypeScript validation
pnpm rules:audit       # deterministic six-seed full-match audit (feature/visual-table-replay only)
pnpm bot:benchmark     # reproducible bot calibration benchmark
pnpm check             # shared typecheck/tests + client typecheck/build
```

## 2D and 3D architecture

The authoritative Mahjong state lives outside the visual renderer.

- `shared/` — deterministic Mahjong rules, scoring, match flow, bots and single-player orchestration.
- `client/src/main.ts` — authoritative client UI/state flow.
- `client/src/enhance.ts` — tile art, audio and game-feel layer.
- `client/src/table-3d.ts` — Three.js renderer derived from already-authoritative table state.

The **2D table remains a complete playable path** and accessibility/fallback surface.
The **3D renderer does not own game rules or mutate match state**. This keeps visual work replaceable and prevents rendering bugs from changing Mahjong outcomes.

The 3D renderer loads a pinned Three.js build from jsDelivr. If the requested GPU backend cannot initialize, Mahjong Live remains playable in 2D and reports `2D · 3D unavailable` rather than blocking startup.

## Current project direction

Immediate work is:

1. manually playtest `v0.1.0-preview.3` through full matches;
2. fix concrete gameplay/presentation regressions found during play;
3. keep PR #33 draft/unmerged until the preview is accepted.

The next major implementation stage is **multiplayer architecture**: authoritative transport/state boundaries, hidden-information-safe projections, lobby/reconnect semantics, validation and four-client E2E coverage.

The previously investigated **120 Hz renderer scheduling work is deferred and is not a blocker** for the current single-player preview.

## Documentation

- [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md) — authoritative current project snapshot and handoff.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — active backlog and next stages.
- [`docs/MULTIPLAYER_ARCHITECTURE.md`](docs/MULTIPLAYER_ARCHITECTURE.md) — multiplayer Phase 1 decision record.
- `docs/superpowers/plans/` — historical implementation plans; useful context, but not necessarily the current backlog.
