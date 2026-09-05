# Mahjong Live Roadmap

Updated: 2026-09-05

The repository contains detailed historical implementation plans under `docs/superpowers/plans/`.
Most of those plans describe work that has already landed. This file is the current product backlog
and should be updated as the game grows.

## Current focus — table correctness, UX and performance

- [x] Local FluffyStuff/riichi-mahjong-tiles SVG set for all normal tile faces.
- [x] One face atlas plus merged static face draw path.
- [x] WebGPU-first renderer on Chromium/Edge; WebGL2 fallback and Firefox path.
- [x] Built-in FPS/RAF/render telemetry, TXT capture and stress-table benchmark.
- [x] Adjustable tile-corner geometry quality.
- [x] Keep renderer/device alive when changing graphics tuning; geometry swaps are in-place.
- [x] Finish WebGL fallback performance work, especially Edge/ANGLE.
- [x] Keep every DOM tile preview (Dora, reactions, choices) on the same FluffyStuff artwork source.
- [x] Strong, readable CHI/PON/KAN/RON table announcements with appropriate presentation pauses.
- [x] Human Tenpai/Furiten status with visible wait tiles, without exposing opponent concealed info.
- [x] Group-aware meld placement for all four legal meld groups without wrapping/collisions.
- [x] Restore live 3D Dev camera tuning after the renderer identity-cache optimization without reverting the performance fast-path.
- [x] Add a separate live 2D Dev layout section for table width/height reserve, player panels, center, Dora, hand and river scaling/positioning.
- [x] Reclaim desktop play space by keeping the move log DOM-only instead of reserving a permanent column and by removing the old 940/980px desktop table height caps.
- [ ] Continue responsive table/camera QA on desktop, tablet and phone landscape.
  - 2026-09-05: fixed late dev-tuning CSS overriding the single-column tablet/mobile layout and removed the 610px 3D minimum-height trap on short landscape viewports.
  - 2026-09-05: restored live camera sliders, added live 2D layout tuning, enlarged/moved Dora to the upper-left table area and expanded both desktop modes to use substantially more of the viewport. Full visual/camera QA remains open.

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

- [x] Stage A polish for the fast 2D table: richer felt/frame treatment, lighter player cards, stronger center counter, structured discard rivers and a more prominent human hand.
- [x] Move background/table/tile appearance out of Dev into user-facing Options shared by 2D and 3D, including presets, colors, felt texture and tile-back texture/pattern controls.
- [x] Make user appearance Options update the 2D table live instead of being masked by the old Dev inline-preview styles.
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
