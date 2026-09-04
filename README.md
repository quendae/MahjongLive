# Mahjong Live

Riichi Mahjong in the browser, with an authoritative TypeScript rules engine, single-player bots and a WebGPU/WebGL 3D table.

## Play locally — easiest way

### Windows

1. Install **Node.js 20+** once if it is not already installed.
2. Download / clone this repository.
3. Double-click **`START_GAME.bat`**.

That is all. On the first run Mahjong Live installs its project dependencies automatically. Then it starts the local game server and opens the browser.

If Node.js is missing, the launcher opens the Node.js download page instead of failing with a cryptic terminal error.

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
pnpm client:typecheck  # TypeScript client validation
pnpm check             # engine typecheck + tests + client typecheck + build
```

## 3D table

The normal game starts with the **3D Table** presentation enabled. Chromium/Edge prefers WebGPU when available, while Firefox and unsupported devices use the WebGL2 path. The renderer draws the physical table, discard rivers, racks and melds while the existing rules engine remains the single source of truth.

The local player's rack is rendered in 3D while the authoritative DOM remains the accessible interaction/state source. A header toggle allows instant switching between **3D Table** and **2D Table**. Tile artwork is stored locally and uses the public-domain FluffyStuff Riichi SVG set.

The 3D renderer loads a pinned Three.js build from jsDelivr. If the requested GPU backend cannot initialize, Mahjong Live falls back safely instead of blocking game startup.

## Architecture

- `shared/` — deterministic Mahjong rules, scoring, match, bots and single-player orchestration.
- `client/src/main.ts` — authoritative client UI/state flow.
- `client/src/enhance.ts` — tile art, audio and game-feel layer.
- `client/src/table-3d.ts` — Three.js/WebGL table renderer derived from the already-rendered authoritative state.

The 3D renderer does **not** own game rules or mutate match state. This keeps rendering replaceable and prevents visual work from changing Mahjong outcomes.

## Roadmap

Current work and future expansion are tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md). Historical implementation plans remain under `docs/superpowers/plans/`.
