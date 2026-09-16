# Mahjong Live Roadmap

Updated: 2026-09-16

The repository contains detailed historical implementation plans under `docs/superpowers/plans/`.
Most of those plans describe work that has already landed. This file is the current product backlog
and should be updated as the game grows.

## Current focus — table correctness, UX and performance

- [x] Local FluffyStuff/riichi-mahjong-tiles SVG set for all normal tile faces.
- [x] One face atlas plus merged static face draw path.
- [x] WebGPU-first renderer on Chromium/Edge; WebGL2 fallback and Firefox path.
- [x] Built-in FPS/RAF/render telemetry, TXT capture and stress-table benchmark.
- [x] Add bottleneck diagnostics to performance capture: Loop/RAF ratio, scheduler gap, CPU/GPU frame-budget ratios, `syncActors`, reconcile/static-batch cost and shadow-refresh serial.
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
- [x] Add automated Chromium responsive-layout QA with screenshots for 2D and 3D across seven desktop/tablet/phone viewports.
- [x] Canonicalize 2D river clearance around the center counter, human meld placement at the bottom-right and one source-aware discard animation without the second landing bounce.
- [ ] Continue responsive table/camera QA on real browsers/devices, especially touch behavior and Firefox/WebKit-specific differences.
  - 2026-09-05: fixed late dev-tuning CSS overriding the single-column tablet/mobile layout and removed the 610px 3D minimum-height trap on short landscape viewports.
  - 2026-09-05: restored live camera sliders, added live 2D layout tuning, enlarged/moved Dora to the upper-left table area and expanded both desktop modes to use substantially more of the viewport.
  - 2026-09-05: Playwright matrix passed 14/14 combinations: 2560×1440, 1920×1080, 1366×768, 1024×768, 820×1180, 390×844 and 844×390, each in both 2D and 3D.
  - 2026-09-16: focused 2D regression + responsive QA passed 29/29, including saved legacy meld-offset migration, center clearance and the single discard-flight path.
  - 2026-09-16: call/meld/Dora/result-transition coverage expanded the browser matrix to 35/35. Real-device/touch QA remains open.

## Active implementation sequence

1. [x] Finish CHI/PON/KAN/RON presentation and called-from meld orientation while preserving the exact physical called tile.
2. [x] Audit 3D discard source, hover/lift/settle and seat orientations.
3. [ ] Re-run 120 Hz / RAF performance work on Firefox and Edge/ANGLE with long discard rivers.
   - 2026-09-16: automated 24-discards-per-seat / 96-tile stress telemetry now verifies static batching and records independent Three-loop Hz versus browser RAF Hz.
   - 2026-09-16: Dev/TXT capture now classifies likely animation-loop gap, browser RAF limit, GPU-bound, CPU-submit-bound or available headroom while retaining all raw timings.
   - 2026-09-16: the 3D animation audit found motion driven by elapsed wall-clock time: discard flights use duration/progress, hover/settle uses exponential damping from frame delta, and halo pulse uses absolute time. No frame-count-dependent interaction animation remains in the renderer loop.
   - Final Windows Firefox and Edge/ANGLE captures at 120 Hz are still required before changing renderer scheduling; Linux/headless CI cannot reproduce the user's D3D11/ANGLE path or monitor refresh behavior.
4. [x] Improve Riichi-stick and table-state presentation without covering the play field.
5. [ ] Continue bot-strength tuning and replay/history work after the completed scoring-explanation and calibration-harness sprints.
   - 2026-09-16: winning-hand results now expose expandable Yaku/Han, Dora, Fu, limit and payment explanations.
   - 2026-09-16: deterministic bot calibration now rotates Casual / Standard / Expert / Expert across seats and records placement, points, wins, deal-ins, Riichi, calls and match-length statistics.

## Rules and scoring

The existing engine already has dedicated modules/tests for round flow, waits/Furiten, Riichi,
Chi/Pon/Kan, Chankan, Rinshan, Nagashi, scoring, common/rare yaku and Yakuman.

Current product rule decision:

- **Kan-Dora is revealed immediately when a Kan completes**, including Daiminkan and Shouminkan.
  This intentionally supersedes the older historical Plan 8 Tenhou-style delayed-Dora ruling.

Next rule work:

- [ ] Continue edge-case audit using deterministic full-match simulation and regression seeds.
- [x] Expand result explanations so Fu/Yaku/Dora/payment calculation is easy to inspect.
- [ ] Add rule-profile plumbing before introducing optional table/rules variants.
- [ ] Keep save-state compatibility tests whenever engine state changes.

## Single-player

- [x] Casual / Standard / Expert bot profiles.
- [x] Public-information discard advisor.
- [x] Autosave/resume and seeded deterministic games.
- [x] Add deterministic bot calibration statistics with seat rotations and a reproducible `pnpm bot:benchmark` report.
- [ ] Better contextual teaching for waits, Furiten, Riichi, calls, Kan and scoring.
- [ ] Use calibration statistics to tune bot strength and defense/offense behavior.
- [ ] Match history and replay viewer/export from deterministic action history.
- [ ] More accessibility/touch/keyboard QA and UI scaling presets.

## Presentation and game feel

- [x] Stage A polish for the fast 2D table: richer felt/frame treatment, lighter player cards, stronger center counter, structured discard rivers and a more prominent human hand.
- [x] Move background/table/tile appearance out of Dev into user-facing Options shared by 2D and 3D, including presets, colors, felt texture and tile-back texture/pattern controls.
- [x] Make user appearance Options update the 2D table live instead of being masked by the old Dev inline-preview styles.
- [x] Give 2D seat-oriented concealed racks, rivers around the center, source-aware tsumogiri/tedashi discard motion, clearer player badges and seat-oriented meld groups.
- [x] Refresh cached 3D shadows during hover-lift/settle instead of leaving the contact shadow at the tile's resting position.
- [x] Finalize call/Ron presentation, Dora reveal timing/animation and result transitions.
- [x] Add clearer Riichi-stick/table-state presentation without covering the play field.
- [x] Improve meld orientation based on called-from seat while keeping exact physical called tile.
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
