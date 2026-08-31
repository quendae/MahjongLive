# Plan 17 — Beginner clarity and table layout pass

Date: 2026-08-31

## Current status

Plan 16 established a persistent Three.js scene and moved the local hand into WebGL. The rules/scoring/bot engine remains authoritative and deterministic. The current 3D table is stable enough for visual QA, but the first full-table screenshot exposes readability and spatial issues that should be solved before adding more visual effects.

Observed issues:

1. Classic tile faces are attractive but hard for a beginner to read quickly.
2. Tile bodies are still too box-like.
3. The visible live wall is visually confusing, especially the row behind/below the local hand. It consumes table space without adding decision value.
4. The latest discard and its owner are not prominent enough when a reaction is available.
5. Chi/Pon/Kan/Ron decisions live in the lower action dock, too far from the event that caused them.
6. Dora is mixed into the central information card rather than occupying a stable public-table location.
7. The center reads as a UI modal, not as a Mahjong table counter/score display.
8. River spacing plus humanization can cause overlaps after several rows of discards.
9. Local melds need a stable edge-aligned location, with the lower-right corner reserved for the local open hand.

## Product goals

- Make a new player able to identify every tile without knowing Japanese glyph conventions.
- Make reactions impossible to miss.
- Make the last discard visually obvious and attributable to a player.
- Make the 3D table read as a Mahjong table rather than a collection of UI cards.
- Preserve the controlled, slightly imperfect physical placement introduced by Plan 16 without allowing tile overlap.
- Keep the rules engine unchanged.

## Scope

### 1. Classic / Beginner tile face mode

Add a persisted `tileFaceMode` preference with two values:

- `classic` — existing faces.
- `beginner` — existing graphical face plus a compact learning label.

Beginner overlays:

- suited tiles: Arabic rank plus suit abbreviation (`M`, `P`, `S`), while preserving the traditional face.
- winds: `E`, `S`, `W`, `N` plus the traditional glyph.
- dragons: `WHITE`, `GREEN`, `RED` (compact labels) plus the traditional symbol.

The setting is available in the header and applies to both DOM fallback tiles and Three.js CanvasTextures.

### 2. Rounded physical tile body

Replace the plain Three.js `BoxGeometry` body with a lightweight rounded/bevelled extruded geometry generated locally from `THREE.Shape` + `ExtrudeGeometry`.

Requirements:

- rounded corners visible in silhouette;
- subtle edge bevel;
- no new runtime physics/render dependency;
- face plane remains separate for crisp CanvasTexture rendering.

### 3. Hide the live wall in normal play

The full live wall should not be rendered as public table furniture. Keep remaining draw count as information and retain a synthetic hidden draw origin for animations.

Dora remains visible in a dedicated public tray.

### 4. Dora tray

Move Dora out of the central counter into a stable tray near the upper edge of the table, below the top seat marker.

The tray includes:

- `DORA` label;
- active indicator tiles;
- space for additional indicators after Kans.

### 5. Central table counter

Replace the modal-looking center card with a compact table-counter presentation:

- round wind + hand in the center;
- honba, riichi sticks and remaining draws;
- four player scores around the center, oriented by seat;
- current-turn status as a compact footer/status line.

This remains DOM overlay content so it is crisp and accessible.

### 6. Latest discard identity

During the reaction phase use the authoritative round phase:

- `phase.discarder`
- `phase.discardIndex`

Mark exactly that river tile with `tile-latest-discard` and expose its physical tile ID in the DOM.

The Three.js actor receives the same semantic state and should:

- lift slightly above the river;
- move a small distance toward table center;
- receive a brighter ring/halo;
- remain readable without causing overlap.

Add a compact label showing who discarded it.

### 7. Reaction popup

When `HumanPrompt.kind === 'reaction'`, render a centered call popup over the table rather than relying on the lower action dock.

Popup content:

- `Bot N discarded <tile>` / player name;
- visual tile preview;
- Ron / Pon / Chi / Kan buttons when legal;
- Pass always available;
- call-combination choice continues to use the existing choice state when more than one combination is legal.

No new rule logic is introduced. Existing `handleUiAction()` / `openOptions()` are reused.

### 8. Meld placement

Three.js meld zones become edge-aligned:

- local: lower-right edge;
- top: upper-left/right edge according to table orientation;
- left/right: corresponding player edge.

Local melds must never collide with the local hand or river.

### 9. Larger playing field and safer river spacing

Increase usable table footprint and tune camera framing.

River rules:

- preserve six tiles per row;
- increase spacing;
- reduce final resting random positional variance;
- keep modest yaw variation;
- reserve enough depth for at least four rows without touching hand/meld zones.

Humanization should be stronger during motion than in the final resting transform.

## Architecture boundary

Plan 17 is presentation/client-only.

Do not change:

- rules legality;
- yaku/scoring;
- wall contents/order;
- bot decisions;
- deterministic match state;
- save-state engine structure.

The UI may add persistent client preferences, but `SingleGameState` remains unchanged.

## Implementation order

1. Preference model + beginner DOM/Canvas faces.
2. Rounded Three.js tile body.
3. Remove visible wall + synthetic draw origin.
4. Dora tray + center table counter.
5. Latest discard metadata + 3D emphasis.
6. Reaction popup using existing actions.
7. Meld layout and river spacing/camera/table-size polish.
8. Typecheck, shared tests and production build.

## Acceptance criteria

- Switching Classic/Beginner immediately updates the visible local hand and public tiles.
- Beginner winds/dragons are understandable without knowing Japanese characters.
- Three.js tiles have visibly rounded/bevelled edges.
- No live-wall row appears behind the human hand or around the table.
- Dora indicators remain visible at all times in their own tray.
- During a Chi/Pon/Kan/Ron opportunity the causal discard is unmistakably highlighted and names the discarder.
- Reaction actions appear centered over the table and are keyboard/click accessible.
- Local melds collect along the lower-right table edge.
- Four rows of six discards do not overlap one another or the hand/counter/meld zone.
- Controlled random tile angles remain subtle and stable.
- 2D fallback remains playable.
- All existing shared tests and TypeScript/build checks remain green.
