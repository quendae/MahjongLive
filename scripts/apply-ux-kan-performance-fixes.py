from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]

def read(rel: str) -> str:
    return (root / rel).read_text(encoding='utf-8')

def write(rel: str, text: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')

# -----------------------------------------------------------------------------
# client/src/enhance.ts — stop overwriting FluffyStuff DOM SVGs with old art.
# -----------------------------------------------------------------------------
enhance_path = 'client/src/enhance.ts'
enhance = read(enhance_path)
enhance = enhance.replace("import type { Dragon, Suit, SuitRank, Tile, Wind } from '@mahjong-live/shared/tile-types';\n", '')
enhance = enhance.replace("import { renderTileFace } from './tile-face';\n", '')
enhance = re.sub(
    r"\nfunction tileFromLabel\(label: string\): Tile \| null \{.*?\n\}\n\nfunction enhanceTileFaces\(\): void \{.*?\n\}\n",
    "\n",
    enhance,
    flags=re.S,
    count=1,
)
enhance = enhance.replace("  enhanceTileFaces();\n", '')
write(enhance_path, enhance)

# -----------------------------------------------------------------------------
# client/src/main.ts — group-aware meld metadata, Tenpai/Furiten waits, calls.
# -----------------------------------------------------------------------------
main_path = 'client/src/main.ts'
main = read(main_path)
main = main.replace(
    "import { seatWindFor } from '@mahjong-live/shared/rules';",
    "import { isRonFuriten, seatWindFor, winningTileTypeKeys } from '@mahjong-live/shared/rules';",
    1,
)
if "from '@mahjong-live/shared/tiles';" not in main:
    main = main.replace(
        "import type { Tile, Wind } from '@mahjong-live/shared/tile-types';\n",
        "import type { Tile, Wind } from '@mahjong-live/shared/tile-types';\nimport { allTileTypes, tileTypeKey } from '@mahjong-live/shared/tiles';\n",
        1,
    )

meld_replacement = r'''function meldMarkup(meld: PlayerMeld, meldIndex: number): string {
  const hiddenOuter = meld.type === 'quad' && meld.isOpen !== true;
  return `<div class="meld meld-${meld.type}" data-meld-index="${meldIndex}">${meld.tiles
    .map((tile, index) => {
      if (hiddenOuter && (index === 0 || index === meld.tiles.length - 1)) {
        return tileBackMarkup(true, { engineTileId: tile.id });
      }
      const meldCalled = meld.calledTileId !== undefined && tile.id === meld.calledTileId;
      return tileMarkup(tile, {
        compact: true,
        meldCalled,
        calledFrom: meldCalled ? meld.calledFrom : undefined,
      });
    })
    .join('')}</div>`;
}
'''
main, n = re.subn(
    r"function meldMarkup\(meld: PlayerMeld\): string \{.*?\n\}\n(?=\nfunction seatPosition)",
    meld_replacement,
    main,
    flags=re.S,
    count=1,
)
if n != 1:
    raise SystemExit('meldMarkup replacement failed')
main = main.replace("state.melds.map(meldMarkup).join('')", "state.melds.map((meld, index) => meldMarkup(meld, index)).join('')")

status_replacement = r'''function waitMiniTile(tile: Tile): string {
  const label = tileLabel(tile);
  const src = tileAssetUrlForLabel(label);
  return `<span class="wait-tile" title="${label}" aria-label="${label}">${src ? `<img src="${src}" alt="" draggable="false" aria-hidden="true">` : label}</span>`;
}

function humanWaitMarkup(player: PlayerIndex, state: RoundPlayerState): string {
  if (!current || player !== current.state.humanSeat) return '';
  // A 13-tile-equivalent concealed state is the actual waiting state. While the player is holding
  // a fresh 14th tile, waits depend on the discard choice and are shown by the advisor instead.
  if (state.concealed.length % 3 !== 1) return '';
  const waits = winningTileTypeKeys(state.concealed, state.melds);
  if (waits.size === 0) return '';
  const waitingTiles = allTileTypes().filter((tile) => waits.has(tileTypeKey(tile)));
  const furiten = isRonFuriten(state);
  const names = waitingTiles.map(tileLabel).join(', ');
  return `
    <span class="status-tag ${furiten ? 'furiten-tag' : 'tenpai-tag'}" title="${furiten ? 'Furiten' : 'Tenpai'} — waiting on ${names}">${furiten ? 'Furiten' : 'Tenpai'}</span>
    <span class="wait-hint" title="Waiting on ${names}"><span class="wait-hint-label">Wait</span>${waitingTiles.map(waitMiniTile).join('')}</span>
  `;
}

function playerStatusMarkup(player: PlayerIndex, state: RoundPlayerState): string {
  if (!current) return '';
  const round = current.state.match.round;
  const seatWind = seatWindFor(player, round.dealer);
  const tags: string[] = [];
  if (player === round.dealer) tags.push('<span class="status-tag dealer-tag">Dealer</span>');
  if (state.riichi !== 'none') tags.push(`<span class="status-tag riichi-tag">${state.riichi === 'double-riichi' ? 'Double Riichi' : 'Riichi'}</span>`);
  const waits = humanWaitMarkup(player, state);
  if (waits) tags.push(waits);
  return `
    <div class="player-heading">
      <span class="seat-wind">${windGlyph[seatWind]}</span>
      <span class="player-name">${playerName(player)}</span>
      <span class="player-points">${formatPoints(state.points)}</span>
    </div>
    <div class="player-tags">${tags.join('')}</div>
  `;
}
'''
main, n = re.subn(
    r"function playerStatusMarkup\(player: PlayerIndex, state: RoundPlayerState\): string \{.*?\n\}\n(?=\nfunction opponentPanel)",
    status_replacement,
    main,
    flags=re.S,
    count=1,
)
if n != 1:
    raise SystemExit('playerStatusMarkup replacement failed')

bubble_replacement = r'''function presentationReactionBubble(): string {
  if (!presentationLocked || !current) return '';
  const event = current.events.find((candidate) =>
    candidate.type === 'RonClaimed' || candidate.type === 'CallMade' || candidate.type === 'KanDeclared'
  );
  if (!event) return '';

  let label: 'CHI' | 'PON' | 'KAN' | 'RON';
  if (event.type === 'RonClaimed') label = 'RON';
  else if (event.type === 'KanDeclared') label = 'KAN';
  else label = event.kind === 'chi' ? 'CHI' : event.kind === 'pon' ? 'PON' : 'KAN';

  const side = seatPosition(event.player, current.state.humanSeat);
  return `
    <div class="call-bubble call-bubble-${side} call-bubble-${label.toLowerCase()}" role="status" aria-live="assertive">
      <strong>${label}</strong>
      <span>${playerName(event.player)}</span>
    </div>
  `;
}
'''
main, n = re.subn(
    r"function presentationCallBubble\(\): string \{.*?\n\}\n(?=\nfunction eventText)",
    bubble_replacement,
    main,
    flags=re.S,
    count=1,
)
if n != 1:
    raise SystemExit('presentationCallBubble replacement failed')
main = main.replace('${presentationCallBubble()}', '${presentationReactionBubble()}')

old_delay = """    const callFrame = frame.events.some((event) => event.type === 'CallMade');
    const baseDelay = presentationDelayMs(preferences.presentationSpeed);
    const callHold = callFrame ? Math.max(520, Math.min(1250, baseDelay * 1.35)) : 0;
    window.setTimeout(step, baseDelay + callHold);
"""
new_delay = """    const reactionFrame = frame.events.some((event) =>
      event.type === 'CallMade' || event.type === 'RonClaimed' || event.type === 'KanDeclared' || event.type === 'HandWon'
    );
    const baseDelay = presentationDelayMs(preferences.presentationSpeed);
    // A spoken call is a table event, not background animation. Give it enough time to register
    // even at Fast presentation speed and over remote/streamed displays.
    const reactionHold = reactionFrame ? Math.max(1500, Math.min(2800, baseDelay * 2.2)) : 0;
    window.setTimeout(step, baseDelay + reactionHold);
"""
if old_delay not in main:
    raise SystemExit('presentation delay block not found')
main = main.replace(old_delay, new_delay, 1)
main = main.replace(
    '<div class="tutorial-step"><b>2 · Calls</b><span>When Chi, Pon, Kan or Ron is legal, action buttons appear below the table. Pass is always available during reactions.</span></div>',
    '<div class="tutorial-step"><b>2 · Calls</b><span>When Chi, Pon, Kan or Ron is legal, a reaction popup appears over the table. Pass is always available during reactions.</span></div>',
    1,
)
write(main_path, main)

# -----------------------------------------------------------------------------
# client/src/table-3d.ts — geometry quality rebuild in-place + meld groups.
# -----------------------------------------------------------------------------
table_path = 'client/src/table-3d.ts'
table = read(table_path)
table = table.replace(
    "  calledFrom?: number | null;\n  element: HTMLElement | null;",
    "  calledFrom?: number | null;\n  meldIndex?: number;\n  meldTileIndex?: number;\n  meldSize?: number;\n  element: HTMLElement | null;",
    1,
)

old_meld_layout = '''  } else {
    const row = Math.floor(spec.index / 8);
    const col = spec.index % 8;
    const gap = tuning.tiles.meldGap;
    const rowGap = tuning.tiles.meldRowGap;
    transform.scale = .80 * tuning.tiles.meldScale;
    // Open sets hug the player's lower-right rail. Tiles within a meld are nearly touching.
    if (spec.side === 'bottom') {
      transform.x = 5.67 - col * gap;
      transform.z = 4.48 - row * rowGap;
    } else if (spec.side === 'top') {
      transform.x = -5.67 + col * gap;
      transform.z = -4.48 + row * rowGap;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -5.67 + row * rowGap;
      transform.z = 4.48 - col * gap;
      transform.yaw = Math.PI / 2;
    } else {
      transform.x = 5.67 - row * rowGap;
      transform.z = -4.48 + col * gap;
      transform.yaw = -Math.PI / 2;
    }
    if (spec.called) {
'''
new_meld_layout = '''  } else {
    const gap = tuning.tiles.meldGap;
    const meldIndex = Math.max(0, spec.meldIndex ?? 0);
    const tileIndex = Math.max(0, spec.meldTileIndex ?? spec.index);
    // Keep each legal 3/4-tile meld as one group. The previous flat 8-column stream wrapped the
    // ninth tile onto a second row, which could throw a perfectly legal third meld into the table.
    const groupStride = Math.max(1.18, gap * 4 + .14);
    const linear = meldIndex * groupStride + tileIndex * gap;
    transform.scale = .80 * tuning.tiles.meldScale;
    if (spec.side === 'bottom') {
      transform.x = 5.67 - linear;
      transform.z = 4.48;
    } else if (spec.side === 'top') {
      transform.x = -5.67 + linear;
      transform.z = -4.48;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -5.67;
      transform.z = 4.48 - linear;
      transform.yaw = Math.PI / 2;
    } else {
      transform.x = 5.67;
      transform.z = -4.48 + linear;
      transform.yaw = -Math.PI / 2;
    }
    if (spec.called) {
'''
if old_meld_layout not in table:
    raise SystemExit('old meld layout not found')
table = table.replace(old_meld_layout, new_meld_layout, 1)

old_gather = '''    const meld = [...zone.querySelectorAll<HTMLElement>('.meld-row .tile')];
    meld.forEach((element, index) => {
      const tileId = elementTileId(element);
      const label = element.getAttribute('aria-label');
      specs.push({
        key: tileId === null ? `meld:${player}:${index}:${label ?? 'back'}` : `tile:${tileId}`,
        zone: 'meld',
        side,
        player,
        index,
        total: meld.length,
        label,
        back: element.classList.contains('tile-back'),
        selectable: false,
        advised: false,
        drawn: false,
        latest: false,
        tileId,
        called: element.classList.contains('tile-meld-called'),
        calledFrom: element.dataset.calledFrom === undefined ? null : Number(element.dataset.calledFrom),
        element,
      });
    });
'''
new_gather = '''    const meld = [...zone.querySelectorAll<HTMLElement>('.meld-row .tile')];
    meld.forEach((element, index) => {
      const tileId = elementTileId(element);
      const label = element.getAttribute('aria-label');
      const meldElement = element.closest<HTMLElement>('.meld');
      const meldIndexRaw = Number(meldElement?.dataset.meldIndex ?? 0);
      const meldIndex = Number.isFinite(meldIndexRaw) ? meldIndexRaw : 0;
      const meldTiles = meldElement ? [...meldElement.querySelectorAll<HTMLElement>(':scope > .tile')] : [];
      const meldTileIndex = Math.max(0, meldTiles.indexOf(element));
      specs.push({
        key: tileId === null ? `meld:${player}:${meldIndex}:${meldTileIndex}:${label ?? 'back'}` : `tile:${tileId}`,
        zone: 'meld',
        side,
        player,
        index,
        total: meld.length,
        label,
        back: element.classList.contains('tile-back'),
        selectable: false,
        advised: false,
        drawn: false,
        latest: false,
        tileId,
        called: element.classList.contains('tile-meld-called'),
        calledFrom: element.dataset.calledFrom === undefined ? null : Number(element.dataset.calledFrom),
        meldIndex,
        meldTileIndex,
        meldSize: Math.max(1, meldTiles.length),
        element,
      });
    });
'''
if old_gather not in table:
    raise SystemExit('meld gather block not found')
table = table.replace(old_gather, new_gather, 1)

# In-place geometry rebuild avoids repeatedly destroying WebGPU device/context when moving slider.
insert_anchor = "function disposeFaceGeometries(rt: TableRuntime): void {"
if insert_anchor not in table:
    raise SystemExit('disposeFaceGeometries anchor missing')
rebuild_fn = r'''function rebuildGeometryQuality(rt: TableRuntime, value: number): void {
  const next = geometryQualityLevel(value);
  if (next === rt.geometryQuality) return;

  // Merged static faces bake the old face geometry transforms; remove them before swapping geometry.
  clearStaticFaceBatches(rt);
  disposeFaceGeometries(rt);

  const oldTile = rt.tileGeometry;
  const oldFace = rt.faceGeometry;
  const oldBack = rt.backGeometry;
  const oldShell = rt.backShellGeometry;

  rt.geometryQuality = next;
  rt.tileGeometry = roundedTileGeometry(rt.THREE, next);
  rt.faceGeometry = roundedFaceGeometry(rt.THREE, .39, .53, .038, next);
  rt.backGeometry = roundedFaceGeometry(rt.THREE, .405, .545, .043, next);
  rt.backShellGeometry = roundedBackShellGeometry(rt.THREE, next);

  rt.staticRiverBodies.geometry = rt.tileGeometry;
  rt.staticRiverShells.geometry = rt.backShellGeometry;
  rt.staticBacks.geometry = rt.backGeometry;

  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {
    actor.body.geometry = rt.tileGeometry;
    actor.rearShell.geometry = rt.backShellGeometry;
    actor.rear.geometry = rt.backGeometry;
    actor.face.geometry = faceGeometryForLabel(rt, actor.spec.label);
  }

  oldTile?.dispose?.();
  oldFace?.dispose?.();
  oldBack?.dispose?.();
  oldShell?.dispose?.();

  rt.staticRiverDirty = true;
  syncStaticRiverInstances(rt);
  if (rt.renderer.shadowMap?.enabled) rt.renderer.shadowMap.needsUpdate = true;
}

'''
table = table.replace(insert_anchor, rebuild_fn + insert_anchor, 1)

old_listener = '''window.addEventListener('mahjong-live:dev-tuning', (event) => {
  const detail = (event as CustomEvent<DevTuning>).detail;
  devTuningCache = detail && typeof detail === 'object' ? detail : null;
  if (runtime && detail?.graphics
    && geometryQualityLevel(detail.graphics.geometryQuality) !== runtime.geometryQuality) {
    disposeRuntime();
    loadError = false;
  }
  scheduleReconcile();
});'''
new_listener = '''window.addEventListener('mahjong-live:dev-tuning', (event) => {
  const detail = (event as CustomEvent<DevTuning>).detail;
  devTuningCache = detail && typeof detail === 'object' ? detail : null;
  if (runtime && detail?.graphics) rebuildGeometryQuality(runtime, detail.graphics.geometryQuality);
  scheduleReconcile();
});'''
if old_listener not in table:
    raise SystemExit('geometry dev listener not found')
table = table.replace(old_listener, new_listener, 1)
write(table_path, table)

# -----------------------------------------------------------------------------
# client/src/ux.css — persistent table-call visibility and wait badges.
# -----------------------------------------------------------------------------
ux_path = 'client/src/ux.css'
ux = read(ux_path)
ux += r'''

/* Human-only structural Tenpai/Furiten status. Never expose opponent waits. */
.tenpai-tag { color: #a8e8c5; background: rgba(70, 181, 123, .16); border: 1px solid rgba(109, 218, 159, .18); }
.furiten-tag { color: #ffb2a7; background: rgba(215, 87, 74, .17); border: 1px solid rgba(235, 117, 101, .2); }
.wait-hint { display: inline-flex; align-items: center; gap: 2px; margin-left: 2px; }
.wait-hint-label { color: #9fb3a7; font-size: 8px; text-transform: uppercase; letter-spacing: .06em; margin-right: 2px; }
.wait-tile {
  width: 16px; height: 22px; display: inline-grid; place-items: center; overflow: hidden;
  border: 1px solid rgba(210,201,182,.9); border-radius: 3px; background: #fbfbfb;
  box-shadow: 0 1px 2px rgba(0,0,0,.25); color: #26372f; font-size: 7px;
}
.wait-tile img { width: 100%; height: 100%; object-fit: contain; display: block; }

/* Calls are intentionally held long enough to be read; Ron gets the strongest table accent. */
.call-bubble { min-width: 132px; padding: 12px 18px 11px; }
.call-bubble strong { font-size: 27px; }
.call-bubble span { font-size: 11px; }
.call-bubble-ron { border-color: rgba(239, 136, 111, .72); box-shadow: 0 16px 42px rgba(0,0,0,.5), 0 0 24px rgba(209,76,62,.15), inset 0 0 0 1px rgba(255,255,255,.035); }
.call-bubble-ron strong { color: #ffad91; }
'''
write(ux_path, ux)

# -----------------------------------------------------------------------------
# shared rules — product decision: reveal Kan-Dora immediately for every completed Kan.
# This intentionally supersedes the older Tenhou-style delayed ruling in the historical plan.
# -----------------------------------------------------------------------------
kan_path = 'shared/src/engine/rules/kan.ts'
kan = read(kan_path)
old = '''  const working: RoundState = {
    ...state,
    players,
    callsMade: state.callsMade + 1,
  };
  const rinshan = rinshanState(working, phase.declarer, true);
  return {
    state: rinshan.state,
    events: [
      { type: 'KanCompleted', player: phase.declarer, kind: 'shouminkan', meld },
      rinshan.event,
    ],
  };
'''
new = '''  let working: RoundState = {
    ...state,
    players,
    callsMade: state.callsMade + 1,
  };
  const wall = revealKanDora(working.wall);
  working = { ...working, wall };
  const rinshan = rinshanState(working, phase.declarer, false);
  return {
    state: rinshan.state,
    events: [
      { type: 'KanCompleted', player: phase.declarer, kind: 'shouminkan', meld },
      { type: 'DoraIndicatorRevealed', count: wall.doraIndicators.length },
      rinshan.event,
    ],
  };
'''
if old not in kan:
    raise SystemExit('shouminkan timing block not found')
kan = kan.replace(old, new, 1)
old = '''  const working: RoundState = {
    ...state,
    players,
    callsMade: state.callsMade + 1,
    currentPlayer: claim.player,
  };
  const rinshan = rinshanState(working, claim.player, true);
  return {
    state: rinshan.state,
    events: [
      { type: 'CallMade', player: claim.player, kind: 'daiminkan', meld },
      { type: 'KanCompleted', player: claim.player, kind: 'daiminkan', meld },
      rinshan.event,
    ],
  };
'''
new = '''  let working: RoundState = {
    ...state,
    players,
    callsMade: state.callsMade + 1,
    currentPlayer: claim.player,
  };
  const wall = revealKanDora(working.wall);
  working = { ...working, wall };
  const rinshan = rinshanState(working, claim.player, false);
  return {
    state: rinshan.state,
    events: [
      { type: 'CallMade', player: claim.player, kind: 'daiminkan', meld },
      { type: 'KanCompleted', player: claim.player, kind: 'daiminkan', meld },
      { type: 'DoraIndicatorRevealed', count: wall.doraIndicators.length },
      rinshan.event,
    ],
  };
'''
if old not in kan:
    raise SystemExit('daiminkan timing block not found')
kan = kan.replace(old, new, 1)
write(kan_path, kan)

# Add an explicit regression test for immediate completed Shouminkan Dora.
test_path = 'shared/src/engine/rules/kanTiming.test.ts'
test = read(test_path)
if "reveals completed Shouminkan Kan-Dora immediately" not in test:
    test = test.replace(
        "import { applyAction, getLegalActions } from './round';\n",
        "import { applyAction, getLegalActions } from './round';\nimport { completeShouminkan } from './kan';\n",
        1,
    )
    marker = "\ndescribe('fourth Kan boundary', () => {"
    addition = r'''

describe('completed Kan-Dora presentation timing', () => {
  it('reveals completed Shouminkan Kan-Dora immediately before the Rinshan draw', () => {
    const ponTiles = [0, 1, 2].map((copy) => physical(suited('man', 5), 5000 + copy));
    const addedTile = physical(suited('man', 5), 5003);
    const round = state(
      player([], { melds: [{ type: 'triplet', tiles: ponTiles, isOpen: true }] }),
      9999,
    );
    round.phase = {
      kind: 'kan-reactions',
      declarer: 0,
      meldIndex: 0,
      addedTile,
      ronClaims: [],
    };

    const result = completeShouminkan(round);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.state.wall.doraIndicators).toHaveLength(2);
    expect(result.state.phase).toMatchObject({ kind: 'awaiting-discard', isRinshan: true, pendingKanDora: false });
    expect(result.events.map((event) => event.type)).toEqual([
      'KanCompleted',
      'DoraIndicatorRevealed',
      'TileDrawn',
    ]);
  });
});
'''
    if marker not in test:
        raise SystemExit('kanTiming insertion marker missing')
    test = test.replace(marker, addition + marker, 1)
write(test_path, test)

# -----------------------------------------------------------------------------
# docs/ROADMAP.md — consolidate fragmented historical plans into a current backlog.
# -----------------------------------------------------------------------------
roadmap = r'''# Mahjong Live Roadmap

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
'''
write('docs/ROADMAP.md', roadmap)

# Refresh stale README renderer description without turning README into another roadmap.
readme_path = 'README.md'
readme = read(readme_path)
readme = readme.replace(
    'Riichi Mahjong in the browser, with an authoritative TypeScript rules engine, single-player bots and a WebGL 3D table.',
    'Riichi Mahjong in the browser, with an authoritative TypeScript rules engine, single-player bots and a WebGPU/WebGL 3D table.',
)
readme = readme.replace(
    'The normal game now starts with the **3D Table** presentation enabled. The WebGL renderer draws the physical table, discard rivers, opponent racks, melds and wall as lit 3D geometry while the existing rules engine remains the single source of truth.',
    'The normal game starts with the **3D Table** presentation enabled. Chromium/Edge prefers WebGPU when available, while Firefox and unsupported devices use the WebGL2 path. The renderer draws the physical table, discard rivers, racks and melds while the existing rules engine remains the single source of truth.',
)
readme = readme.replace(
    'The local player\'s rack intentionally remains an HTML interaction layer in this first 3D pass. That preserves excellent mouse, touch and keyboard behavior while the visual table moves to 3D. A header toggle allows instant switching between **3D Table** and **2D Table**.\n\nThe 3D renderer currently loads a pinned Three.js build from jsDelivr. If it cannot be loaded or WebGL is unavailable, Mahjong Live automatically keeps the fully playable 2D table instead of blocking game startup.',
    'The local player\'s rack is rendered in 3D while the authoritative DOM remains the accessible interaction/state source. A header toggle allows instant switching between **3D Table** and **2D Table**. Tile artwork is stored locally and uses the public-domain FluffyStuff Riichi SVG set.\n\nThe 3D renderer loads a pinned Three.js build from jsDelivr. If the requested GPU backend cannot initialize, Mahjong Live falls back safely instead of blocking game startup.',
)
if 'docs/ROADMAP.md' not in readme:
    readme += '\n## Roadmap\n\nCurrent work and future expansion are tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md). Historical implementation plans remain under `docs/superpowers/plans/`.\n'
write(readme_path, readme)
