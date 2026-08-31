# Plan 15 — One-click launch and 3D table

## Goals

1. Make a fresh checkout playable without remembering pnpm/Vite commands.
2. Give Windows users a double-click launcher.
3. Move table presentation to a real WebGL 3D scene without coupling game rules to rendering.
4. Preserve the existing 2D client as a reliable fallback.

## Launch path

- `START_GAME.bat` is the primary Windows entrypoint.
- `scripts/start.mjs` validates Node, selects pnpm/corepack/npx, performs the first dependency install if required and starts Vite.
- `start-game.sh` provides the equivalent Unix entrypoint.
- Vite opens the local browser automatically for the normal start path.
- `pnpm check` provides one command for engine tests, typechecks and production build.

## 3D architecture

The authoritative state remains in `shared/` and `main.ts`. The 3D renderer is presentation-only.

`table-3d.ts` observes the DOM produced from authoritative state and mirrors public table objects into a Three.js scene:

- physical felt/wood table;
- tile cuboids with generated face textures;
- discard rivers in seat-relative orientation;
- concealed opponent racks;
- open melds;
- remaining wall visualization;
- active-seat marker;
- fresh-discard drop animation;
- lighting, shadows, perspective and fog.

The human rack stays as the proven DOM interaction layer in this pass. This avoids regressions in keyboard/touch selection while allowing the rest of the table to become genuine 3D immediately.

## Dependency strategy

The renderer loads pinned Three.js `0.185.1` from jsDelivr at runtime. No workspace lockfile change is required in this pass. The 3D scene is progressive enhancement: loading/WebGL failure falls back to the existing 2D table and never blocks gameplay.

A later packaging pass can vendor Three.js or move it into a dedicated client package if fully offline 3D becomes a release requirement.

## Acceptance

- fresh Windows checkout: double-click launcher reaches the game;
- first run installs dependencies automatically;
- subsequent starts skip installation;
- 3D mode is default and can be toggled to 2D;
- no rules-engine files are changed;
- 2D remains playable if 3D cannot initialize;
- shared tests, client typecheck and production client build remain green.
