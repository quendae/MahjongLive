# Mahjong Live

Riichi Mahjong in the browser, with an authoritative TypeScript rules engine, single-player bots and a WebGL 3D table.

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

The normal game now starts with the **3D Table** presentation enabled. The WebGL renderer draws the physical table, discard rivers, opponent racks, melds and wall as lit 3D geometry while the existing rules engine remains the single source of truth.

The local player's rack intentionally remains an HTML interaction layer in this first 3D pass. That preserves excellent mouse, touch and keyboard behavior while the visual table moves to 3D. A header toggle allows instant switching between **3D Table** and **2D Table**.

The 3D renderer currently loads a pinned Three.js build from jsDelivr. If it cannot be loaded or WebGL is unavailable, Mahjong Live automatically keeps the fully playable 2D table instead of blocking game startup.

## Architecture

- `shared/` — deterministic Mahjong rules, scoring, match, bots and single-player orchestration.
- `client/src/main.ts` — authoritative client UI/state flow.
- `client/src/enhance.ts` — tile art, audio and game-feel layer.
- `client/src/table-3d.ts` — Three.js/WebGL table renderer derived from the already-rendered authoritative state.

The 3D renderer does **not** own game rules or mutate match state. This keeps rendering replaceable and prevents visual work from changing Mahjong outcomes.
