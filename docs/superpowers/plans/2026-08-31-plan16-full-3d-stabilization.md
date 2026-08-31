# Plan 16 — Full 3D table stabilization and interaction

Date: 2026-08-31
Branch: `ux/plan16-full-3d`
Base: `master` after Plan 15 (`9e9f260`)

## Current project status

Mahjong Live currently has a complete deterministic Riichi rules/match/scoring/bot engine, a single-player hanchan client, presentation frames, advisor/tutorial/preferences, procedural audio, vector tile faces, a one-click launcher and a first Three.js/WebGL table pass.

The shared engine remains the authoritative source of truth and is green in CI: 54 test files / 319 tests, shared typecheck, client typecheck, launcher syntax check and production build all pass on current `master`.

Plan 15 introduced the first 3D renderer. It renders a WebGL table, remaining wall, public rivers, opponent concealed racks, melds and an active-turn marker. The human hand is still DOM-based. Three.js is progressive enhancement with a 2D fallback.

### Problems confirmed after visual QA

1. **Table flicker on every action.**
   - `main.ts` replaces all of `#app` with `innerHTML` on every render.
   - The current 3D canvas is mounted *inside* `.mahjong-table`.
   - Every game frame therefore disconnects the table node, disposes the WebGL runtime, creates a new renderer/canvas/scene, then rebuilds all tiles.
   - Even when the table node survives, `rebuildDynamicScene()` currently clears `tileRoot` and `fxRoot` and recreates every dynamic object.

2. **Tiles are visually arranged rather than behaving like persistent physical objects.**
   - River, rack, meld and wall tiles are recreated by index.
   - A tile has no persistent actor keyed by `tile.id` across hand → discard → meld transitions.
   - The wall is distributed by a simple modulo pattern and does not read as a coherent Mahjong wall.

3. **Human hand is still a DOM overlay.**
   - It visually disconnects from the 3D scene.
   - It prevents authentic draw/discard movement and physical hover/select interaction.

4. **Seat/player cards dominate the table.**
   - Opponent cards are full-size translucent DOM panels over the WebGL scene.

5. **Geometry is too perfect.**
   - Rivers/racks/melds settle on mathematically exact grids.
   - There is no stable per-tile humanized yaw/offset, impact settle or small variation.

## Goal

Turn the first 3D pass into a stable, persistent Mahjong table where tiles are long-lived scene actors. The game engine remains unchanged. The DOM becomes the authoritative presentation/state bridge and accessibility fallback, while Three.js owns all table tiles including the human hand.

## Non-goals

- No rules/scoring/yaku/bot changes.
- No unconstrained rigid-body simulation of all 136 tiles.
- No network/multiplayer work in this plan.
- No removal of the 2D fallback.
- No requirement for external 3D model assets.

## Architecture

### 1. Persistent 3D stage outside volatile `#app`

Add a stable `#table-3d-stage` sibling of `#app` in `client/index.html`.

The stage:
- survives every `app.innerHTML` render,
- owns one WebGL renderer/canvas for the lifetime of 3D mode,
- is positioned over the current `.mahjong-table` using its bounding rectangle,
- updates on window resize / layout changes,
- is hidden outside active gameplay and in 2D mode.

This removes renderer re-creation flicker without requiring a risky rewrite of the existing DOM application renderer.

### 2. Persistent `TileActor` registry

Create a registry keyed primarily by real engine tile ID:

- `tile:<id>` for visible known tiles,
- `concealed:<player>:<slot>` for anonymous opponent backs,
- `wall:<slot>:<layer>` for wall geometry.

Each actor keeps:
- Three.js group/mesh,
- current semantic zone,
- target position/quaternion/scale,
- start transform for animation,
- movement timing and arc height,
- stable humanization offsets,
- selectable/hovered/advised state.

Reconciliation updates targets instead of clearing the scene.

### 3. Transform-driven motion

Every semantic layout returns a transform instead of directly moving meshes.

When a tile changes zone:
- hand → river: animate an arced discard,
- river → meld: lift, translate and settle,
- hand → meld: slide/lift into meld,
- new human draw: spawn from the wall draw origin and move into the rack,
- newly visible bot discard: spawn from the relevant seat rack and move into the river.

Motion uses deterministic interpolation with a small overshoot/settle. Full rigid-body physics is intentionally avoided so the board remains legible and deterministic.

### 4. Controlled physical imperfection

Use a deterministic hash of actor key to generate stable offsets:
- river yaw roughly ±2°,
- position jitter a few millimetres in scene scale,
- meld yaw roughly ±1°,
- hand yaw much smaller (roughly ±0.4°),
- optional tiny pitch/roll at rest.

Humanization is stable across re-renders; a tile does not jitter randomly each frame.

### 5. Full human hand in Three.js

The DOM `.human-hand` remains present as an authoritative/accessibility source but is visually hidden in 3D mode.

The renderer creates selectable 3D actors from `[data-tile-id]` nodes and uses `THREE.Raycaster`:
- pointer hover raises the tile and adds subtle tilt,
- pointer down selects / depresses it,
- click triggers the corresponding hidden DOM tile `.click()`, reusing existing tested action logic,
- non-legal tiles are not selectable,
- advisor-recommended tiles receive a restrained indicator.

Keyboard and 2D interaction remain available through the DOM fallback.

### 6. More authentic table layout

- Rebuild rivers as seat-relative six-column grids.
- Build coherent wall runs instead of modulo-scattered stacks.
- Keep opponent concealed racks aligned to their seat edge.
- Put meld groups close to each player edge with seat-relative orientation.
- Keep the drawn human tile slightly separated from the main rack.
- Reduce visual overlap with the center HUD.

### 7. Compact seat markers

In 3D mode, player status becomes a small seat marker:
- wind,
- name,
- points,
- dealer/riichi state,
- active-turn emphasis.

Large `.opponent-card` / `.human-card` surfaces are removed visually in 3D mode while their text remains in the DOM for accessibility/state extraction.

## Implementation sequence

### Commit A — stable renderer host
- add persistent stage to `index.html`,
- stop mounting WebGL inside `.mahjong-table`,
- align stage to the table,
- keep one renderer alive across `main.ts` renders,
- eliminate action flicker.

### Commit B — persistent tile actors
- introduce actor registry,
- reconcile by key instead of `clear()` + recreate,
- update target transforms only,
- dispose removed actors safely.

### Commit C — authentic layouts + humanization
- correct rivers/wall/racks/melds,
- deterministic small yaw/position variation,
- settle motion.

### Commit D — full 3D human hand + raycasting
- render all human tiles in Three.js,
- hide DOM rack visually in 3D,
- hover/picking/click bridge,
- drawn-tile spacing and advisor/legal states.

### Commit E — state transition animations
- draw from wall to hand,
- discard from hand to river,
- river/hand to Chi/Pon/Kan,
- spawn bot discard from seat rack,
- preserve reduced-motion behavior.

### Commit F — seat marker/UI polish
- compact player markers,
- remove large translucent bot panels,
- tune camera/material/shadows and center overlap.

## Acceptance criteria

Plan 16 is done when:

1. No visible table/canvas flash occurs between normal presentation frames or player actions.
2. The same known tile ID keeps the same 3D actor when moving between hand, river and meld.
3. The human hand is rendered entirely in Three.js in 3D mode.
4. Every legal human discard can be selected by pointer raycasting and invokes the existing authoritative action path.
5. Draw and discard visibly travel between wall/hand/river instead of teleporting.
6. Chi/Pon/Kan tiles visibly transition into meld position when source identity is available.
7. Rivers are seat-relative and readable, with six tiles per row.
8. Resting tiles have subtle stable imperfection rather than perfect CAD alignment.
9. Player markers no longer obscure large areas of the table.
10. 2D fallback remains fully playable.
11. `prefers-reduced-motion` disables non-essential travel/settle animation.
12. Shared engine tests, shared/client typechecks, launcher check and production client build remain green.

## Validation plan

Automated:
- existing 54 shared test files / 319 engine tests,
- shared TypeScript check,
- client TypeScript check,
- launcher syntax check,
- production build.

Manual/visual:
- resume saved hand and play multiple complete hands in 3D,
- verify no canvas remount/flicker during presentation timeline,
- exercise discard, riichi discard, Chi, Pon, Kan, Ron/Tsumo where available,
- switch 3D ↔ 2D repeatedly,
- verify desktop, tablet-like and phone-sized layouts,
- verify reduced-motion behavior.

## Engine boundary

Plan 16 must not change authoritative Mahjong rules. Any visual animation is derived from state transitions and existing DOM/presentation data. If additional presentation metadata becomes useful, it should be exposed separately rather than changing rule outcomes.