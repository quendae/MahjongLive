# Mahjong Live Roadmap

Updated: 2026-09-04

The repository contains detailed historical implementation plans under `docs/superpowers/plans/`.
Most of those plans describe work that has already landed. This file is the current product backlog
and should be updated as the game grows.

## Current focus — table correctness, UX and performance

- [x] Local FluffyStuff/riichi-mahjong-tiles SVG set for all normal tile faces.
- [x] One face atlas plus merged static face draw path.
- [x] WebGPU-first renderer on Chromium/Edge; WebGL2 fallback and Firefox path.
- [x] Built-in FPS/RAF/render telemetry, TXT capture and stress-table benchmark.
- [x] Adjustable tile-corner geometry quality.
- [ ] Keep renderer/device alive when changing graphics tuning; geometry swaps must be in-place.
- [ ] Finish WebGL fallback performance work, especially Edge/ANGLE.
- [ ] Keep every DOM tile preview (Dora, reactions, choices) on the same FluffyStuff artwork source.
- [ ] Strong, readable CHI/PON/KAN/RON table announcements with appropriate presentation pauses.
- [ ] Human Tenpai/Furiten status with visible wait tiles, without exposing opponent concealed info.
- [ ] Group-aware meld placement for all four legal meld groups without wrapping/collisions.
- [ ] Continue responsive table/camera QA on desktop, tablet and phone landscape.

## Rules and scoring

The existing engine already has dedicated modules/tests for round flow, waits/Furiten, Riichi,
Chi/Pon/Kan, Chankan, Rinshan, Nagashi, scoring, common/rare yaku and Yakuman.

Current product rule decision:

- **Kan-Dora is revealed immediately when a Kan completes**, including Daiminkan and Shouminkan.
  This intentionally supersedes the older historical Plan 8 Tenhou-style delayed-Dora ruling.

Next rule work:

- [ ] Continue edge-case audit using deterministic full-match simulation and regression seeds.
- [ ] Expand result explanations so Fu/Yaku/Dora/payment calculation is easy to inspect.
- [ ] Add rule-profile plumbing before introducing optional table/rules variants.
- [ ] Keep save-state compatibility tests whenever engine state changes.

## Single-player

- [x] Casual / Standard / Expert bot profiles.
- [x] Public-information discard advisor.
- [x] Autosave/resume and seeded deterministic games.
- [ ] Better contextual teaching for waits, Furiten, Riichi, calls, Kan and scoring.
- [ ] Improve bot strength calibration and defense/offense tuning with simulation statistics.
- [ ] Match history and replay viewer/export from deterministic action history.
- [ ] More accessibility/touch/keyboard QA and UI scaling presets.

## Presentation and game feel

- [ ] Finalize call/Ron presentation, Dora reveal timing/animation and result transitions.
- [ ] Add clearer Riichi-stick/table-state presentation without covering the play field.
- [ ] Improve meld orientation based on called-from seat while keeping exact physical called tile.
- [ ] Keep optional sound cues synchronized with authoritative presentation frames.
- [ ] Add quality presets (`Performance`, `Balanced`, `High`) on top of Dev-level individual sliders.

## Multiplayer — future expansion

The historical single-player plans explicitly kept multiplayer/server work out of scope. There is no
implemented multiplayer roadmap yet, so this needs a dedicated architecture plan before coding.

Candidate direction:

- [ ] Define authoritative multiplayer state/transport boundary around the existing deterministic engine.
- [ ] Lobby + room codes + reconnect/resume semantics.
- [ ] Hidden-information-safe state projection per player.
- [ ] Server-authoritative action validation or a carefully specified deterministic peer protocol.
- [ ] Spectator/replay protocol based on public action history.
- [ ] Disconnect/time-control/AFK policy.
- [ ] Multiplayer integration tests and browser E2E tests for four clients.

## Historical plans already in the repository

The detailed plan archive currently covers, among other topics:

- rules-engine foundation;
- common, rare and Yakuman yaku;
- Dora, Fu and scoring;
- Riichi, calls and Furiten;
- Kan / Rinshan / Chankan / Nagashi;
- bot ukeire and full single-player bots/match flow;
- browser single-player client and presentation timeline;
- bot difficulty/advisor UX;
- game feel and 3D launch;
- full-3D stabilization;
- beginner clarity, Dora tray, reaction popup, central counter, meld and river layout;
- standing-hand face visibility.

When a new feature changes a deliberate rules ruling, record the new product decision in this roadmap
(or a dedicated rule decision document) instead of silently contradicting an old historical plan.
