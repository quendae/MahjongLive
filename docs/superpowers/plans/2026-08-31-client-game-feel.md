# Plan 14 — Client game feel and tile presentation

## Goal

Improve Mahjong Live's tactile clarity without changing authoritative game rules or save-state semantics.

## Scope

1. Replace placeholder suited-tile typography with original scalable Riichi-style vector faces.
2. Add procedural table audio with a persisted mute preference and no external licensed assets.
3. Reuse the existing single-player presentation timeline for draw/discard/call/Riichi/Dora/win feedback.
4. Make the active turn, drawn tile and newest discard easier to read at a glance.
5. Improve felt, wood, tile depth, hover/press feedback and scrollbars across desktop and mobile.
6. Respect `prefers-reduced-motion` and keep all interactions keyboard-accessible through the existing controls.

## Non-goals

- No rules-engine changes.
- No hidden-information access for presentation effects.
- No network-loaded art, fonts or audio.
- No change to deterministic seeds, autosave, bot policy or scoring.

## Implementation shape

Keep the existing `main.ts` game controller authoritative. Load an enhancement module alongside it that decorates rendered tiles and subscribes to presentation DOM changes. This keeps the UX pass isolated while the client architecture is still evolving, and makes it straightforward to fold the enhancement hooks directly into the renderer later.

## Validation

- shared engine typecheck/tests stay green;
- client typecheck and Vite build stay green;
- manual follow-up should cover desktop, phone portrait and phone landscape, with sound on/off and reduced motion.
