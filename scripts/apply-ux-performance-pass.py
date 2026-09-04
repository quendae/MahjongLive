from pathlib import Path
import re

def patch(path, fn):
    p = Path(path)
    s = p.read_text()
    n = fn(s)
    if n == s:
        raise RuntimeError(f'No changes for {path}')
    p.write_text(n)

def replace_once(s, old, new, label):
    if old not in s:
        raise RuntimeError(f'Missing target: {label}')
    return s.replace(old, new, 1)

def patch_faces(s):
    s = replace_once(s, "function assetFileForLabel(label: string | null): string | null {", "export function assetFileForLabel(label: string | null): string | null {", "export asset mapper")
    s = replace_once(s, "  return honors[text] ?? null;\n}\n\nfunction beginnerCue", "  return honors[text] ?? null;\n}\n\nexport function tileAssetUrlForLabel(label: string | null): string | null {\n  const file = assetFileForLabel(label);\n  return file ? `${TILE_ASSET_ROOT}/${file}` : null;\n}\n\nfunction beginnerCue", "asset url helper")
    s = replace_once(s, "  image.src = `${TILE_ASSET_ROOT}/${file}`;", "  image.src = tileAssetUrlForLabel(label) ?? `${TILE_ASSET_ROOT}/${file}`;", "use asset url helper")
    return s
patch('client/src/table-3d-faces.ts', patch_faces)

def patch_main(s):
    s = replace_once(s, "import { presentationCaption } from './presentation';", "import { presentationCaption } from './presentation';\nimport { tileAssetUrlForLabel } from './table-3d-faces';", "main asset import")
    old = re.search(r"function tileFace\(tile: Tile\): string \{.*?\n\}", s, re.S)
    if not old:
        raise RuntimeError('tileFace function missing')
    new = '''function tileFace(tile: Tile): string {
  const label = tileLabel(tile);
  const src = tileAssetUrlForLabel(label);
  if (src) {
    return `<img class="tile-art" src="${src}" alt="" draggable="false" aria-hidden="true">`;
  }
  if (tile.kind === 'honor') {
    if (tile.honorType === 'wind') return windGlyph[tile.value as Wind];
    if (tile.value === 'white') return '<span class="white-dragon">□</span>';
    if (tile.value === 'green') return '<span class="green-glyph">發</span>';
    return '<span class="red-glyph">中</span>';
  }
  const suffix = tile.suit === 'man' ? '萬' : tile.suit === 'pin' ? '筒' : '索';
  return `<span class="tile-rank">${tile.rank}</span><span class="tile-suit">${suffix}</span>`;
}'''
    s = s[:old.start()] + new + s[old.end():]
    s = replace_once(s, "      buttons.push(actionButton(riichiMode ? 'Cancel Riichi' : 'Riichi', 'riichi', riichiMode ? 'action-active' : ''));", "      buttons.push(actionButton(riichiMode ? 'Cancel Riichi' : 'Riichi', 'riichi', riichiMode ? 'action-active action-riichi' : 'action-riichi'));", "riichi emphasis")
    s = replace_once(s, "function eventText(event: RoundEvent): string {", '''function presentationCallBubble(): string {
  if (!presentationLocked || !current) return '';
  const event = current.events.find((candidate) => candidate.type === 'CallMade');
  if (!event || event.type !== 'CallMade') return '';
  const side = seatPosition(event.player, current.state.humanSeat);
  const label = event.kind === 'chi' ? 'CHI' : event.kind === 'pon' ? 'PON' : 'KAN';
  return `
    <div class="call-bubble call-bubble-${side}" role="status" aria-live="polite">
      <strong>${label}</strong>
      <span>${playerName(event.player)}</span>
    </div>
  `;
}

function eventText(event: RoundEvent): string {''', "call bubble helper")
    s = replace_once(s, "            ${centerInfo()}\n            ${humanZone()}", "            ${centerInfo()}\n            ${presentationCallBubble()}\n            ${humanZone()}", "render call bubble")
    s = replace_once(s, "    index += 1;\n    window.setTimeout(step, presentationDelayMs(preferences.presentationSpeed));", "    index += 1;\n    const callFrame = frame.events.some((event) => event.type === 'CallMade');\n    const baseDelay = presentationDelayMs(preferences.presentationSpeed);\n    const callHold = callFrame ? Math.max(520, Math.min(1250, baseDelay * 1.35)) : 0;\n    window.setTimeout(step, baseDelay + callHold);", "call pause")
    return s
patch('client/src/main.ts', patch_main)

def patch_style(s):
    return s + '''

/* FluffyStuff Regular SVG artwork is also used by DOM-only previews/popups/Dora. */
.tile-art {
  display: block;
  width: 92%;
  height: 94%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.tile-compact .tile-art { width: 96%; height: 96%; }
.action-riichi {
  color: #241c0e;
  background: linear-gradient(180deg, #eed580, #d5b45e);
  border-color: rgba(255,231,159,.72);
  font-weight: 850;
  box-shadow: 0 4px 14px rgba(213,181,107,.18);
}
.action-riichi:hover { background: linear-gradient(180deg, #f3dd91, #ddbd68); }
'''
patch('client/src/style.css', patch_style)

def patch_ux(s):
    return s + '''

/* Brief call announcement: pauses automated presentation without leaking hidden information. */
.call-bubble {
  position: absolute;
  z-index: 24;
  min-width: 112px;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 10px 16px 9px;
  border: 1px solid rgba(239,211,137,.48);
  border-radius: 16px;
  color: #f5ebcf;
  background: linear-gradient(145deg, rgba(15,35,25,.97), rgba(5,16,11,.99));
  box-shadow: 0 14px 38px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.035);
  pointer-events: none;
  animation: call-bubble-in .18s ease-out both;
}
.call-bubble strong { color: #f2d274; font-size: 23px; line-height: 1; letter-spacing: .08em; }
.call-bubble span { color: #b9c9c0; font-size: 10px; font-weight: 750; }
.call-bubble-bottom { left: 50%; bottom: 17%; transform: translateX(-50%); }
.call-bubble-top { left: 50%; top: 15%; transform: translateX(-50%); }
.call-bubble-left { left: 13%; top: 50%; transform: translateY(-50%); }
.call-bubble-right { right: 13%; top: 50%; transform: translateY(-50%); }
@keyframes call-bubble-in {
  from { opacity: 0; scale: .88; filter: blur(3px); }
  to { opacity: 1; scale: 1; filter: blur(0); }
}
@media (prefers-reduced-motion: reduce) { .call-bubble { animation: none; } }
'''
patch('client/src/ux.css', patch_ux)

def patch_dev(s):
    s = replace_once(s, "    gameLogWidth: number;\n  };", "    gameLogWidth: number;\n    tileLabelScale: number;\n    tileLabelX: number;\n    tileLabelY: number;\n    doraLabelScale: number;\n    doraLabelX: number;\n    doraLabelY: number;\n    centerScoreScale: number;\n  };", "dev ui type")
    s = replace_once(s, "    gameLogWidth: 290,\n  },\n  graphics: { pixelRatio: 1.35, shadowQuality: 1, anisotropy: 4 },", "    gameLogWidth: 290,\n    tileLabelScale: 1,\n    tileLabelX: 0,\n    tileLabelY: 0,\n    doraLabelScale: .72,\n    doraLabelX: 0,\n    doraLabelY: 0,\n    centerScoreScale: 1.25,\n  },\n  graphics: { pixelRatio: 1.0, shadowQuality: 1, anisotropy: 4 },", "dev defaults")
    s = replace_once(s, "      gameLogWidth: finite(raw.ui?.gameLogWidth, DEFAULTS.ui.gameLogWidth),\n    },", "      gameLogWidth: finite(raw.ui?.gameLogWidth, DEFAULTS.ui.gameLogWidth),\n      tileLabelScale: finite(raw.ui?.tileLabelScale, DEFAULTS.ui.tileLabelScale),\n      tileLabelX: finite(raw.ui?.tileLabelX, DEFAULTS.ui.tileLabelX),\n      tileLabelY: finite(raw.ui?.tileLabelY, DEFAULTS.ui.tileLabelY),\n      doraLabelScale: finite(raw.ui?.doraLabelScale, DEFAULTS.ui.doraLabelScale),\n      doraLabelX: finite(raw.ui?.doraLabelX, DEFAULTS.ui.doraLabelX),\n      doraLabelY: finite(raw.ui?.doraLabelY, DEFAULTS.ui.doraLabelY),\n      centerScoreScale: finite(raw.ui?.centerScoreScale, DEFAULTS.ui.centerScoreScale),\n    },", "dev load ui fields")
    s = replace_once(s, "if (settings.tiles.faceTint.toLowerCase() === '#ffffff') settings.tiles.faceTint = '#fbfbfb';", "if (settings.tiles.faceTint.toLowerCase() === '#ffffff') settings.tiles.faceTint = '#fbfbfb';\nif (Math.abs(settings.graphics.pixelRatio - 1.35) < .0001) settings.graphics.pixelRatio = 1.0;", "pixel ratio migration")
    s = replace_once(s, "let lastPerformanceDetail: PerformanceDetail | null = null;", "let lastPerformanceDetail: PerformanceDetail | null = null;\nlet stressDiscardsActive = false;", "stress state")
    s = replace_once(s, "  rootStyle.setProperty('--dev-scene-bg', settings.sceneColor);", "  rootStyle.setProperty('--dev-scene-bg', settings.sceneColor);\n  rootStyle.setProperty('--dev-tile-label-scale', String(settings.ui.tileLabelScale));\n  rootStyle.setProperty('--dev-tile-label-x', `${settings.ui.tileLabelX}px`);\n  rootStyle.setProperty('--dev-tile-label-y', `${settings.ui.tileLabelY}px`);\n  rootStyle.setProperty('--dev-dora-label-scale', String(settings.ui.doraLabelScale));\n  rootStyle.setProperty('--dev-dora-label-x', `${settings.ui.doraLabelX}px`);\n  rootStyle.setProperty('--dev-dora-label-y', `${settings.ui.doraLabelY}px`);\n  rootStyle.setProperty('--dev-center-score-scale', String(settings.ui.centerScoreScale));", "label css vars")
    old = "  numberSlider(graphics, 'Texture filtering', 1, 8, 1, () => settings.graphics.anisotropy, (v) => { settings.graphics.anisotropy = v; }, '×', DEFAULTS.graphics.anisotropy);"
    new = old + "\n  const stressActions = document.createElement('div');\n  stressActions.className = 'dev-tuning-actions dev-stress-actions';\n  const stressButton = document.createElement('button');\n  stressButton.type = 'button';\n  stressButton.className = 'dev-tuning-action perf-stress-fill';\n  stressButton.textContent = stressDiscardsActive ? 'Clear simulated discards' : 'Fill table with discards';\n  stressButton.addEventListener('click', () => {\n    stressDiscardsActive = !stressDiscardsActive;\n    stressButton.textContent = stressDiscardsActive ? 'Clear simulated discards' : 'Fill table with discards';\n    window.dispatchEvent(new CustomEvent('mahjong-live:dev-stress-discards', { detail: { enabled: stressDiscardsActive } }));\n    setStatus(stressDiscardsActive ? 'Filled every river to 24 tiles for a visual performance stress test.' : 'Simulated discards cleared.');\n  });\n  stressActions.append(stressButton);\n  graphics.append(stressActions);"
    s = replace_once(s, old, new, "stress button")
    s = s.replace("Pixel ratio has the biggest GPU cost. Shadow quality: 0=off, 1=512, 2=1024, 3=2048.", "Pixel ratio now supersamples independently of Windows DPR, so values above 1.0 really increase GPU work. Shadow quality: 0=off, 1=512, 2=1024, 3=2048.")
    old = "  numberSlider(ui, 'Game log width', 180, 600, 1, () => settings.ui.gameLogWidth, (v) => { settings.ui.gameLogWidth = v; }, 'px', DEFAULTS.ui.gameLogWidth);"
    new = "  numberSlider(ui, 'Tile label size', .40, 1.60, .01, () => settings.ui.tileLabelScale, (v) => { settings.ui.tileLabelScale = v; }, '×', DEFAULTS.ui.tileLabelScale);\n  numberSlider(ui, 'Tile label X', -24, 24, 1, () => settings.ui.tileLabelX, (v) => { settings.ui.tileLabelX = v; }, 'px', DEFAULTS.ui.tileLabelX);\n  numberSlider(ui, 'Tile label Y', -24, 24, 1, () => settings.ui.tileLabelY, (v) => { settings.ui.tileLabelY = v; }, 'px', DEFAULTS.ui.tileLabelY);\n  numberSlider(ui, 'Dora label size', .35, 1.40, .01, () => settings.ui.doraLabelScale, (v) => { settings.ui.doraLabelScale = v; }, '×', DEFAULTS.ui.doraLabelScale);\n  numberSlider(ui, 'Dora label X', -24, 24, 1, () => settings.ui.doraLabelX, (v) => { settings.ui.doraLabelX = v; }, 'px', DEFAULTS.ui.doraLabelX);\n  numberSlider(ui, 'Dora label Y', -24, 24, 1, () => settings.ui.doraLabelY, (v) => { settings.ui.doraLabelY = v; }, 'px', DEFAULTS.ui.doraLabelY);\n  numberSlider(ui, 'Center score plaques', .60, 2.00, .01, () => settings.ui.centerScoreScale, (v) => { settings.ui.centerScoreScale = v; }, '×', DEFAULTS.ui.centerScoreScale);\n  numberSlider(ui, 'Game log width', 180, 600, 1, () => settings.ui.gameLogWidth, (v) => { settings.ui.gameLogWidth = v; }, 'px', DEFAULTS.ui.gameLogWidth);"
    s = replace_once(s, old, new, "ui tuning sliders")
    return s
patch('client/src/dev-tuning.ts', patch_dev)

def patch_clarity_css(s):
    s = replace_once(s, "  letter-spacing: .015em;\n}", "  letter-spacing: .015em;\n  transform: translate(var(--dev-tile-label-x, 0px), var(--dev-tile-label-y, 0px)) scale(var(--dev-tile-label-scale, 1));\n  transform-origin: top right;\n}", "base learning label transform")
    return s + "\n\n.table-dora-tray .tile-learning-label {\n  transform: translate(var(--dev-dora-label-x, 0px), var(--dev-dora-label-y, 0px)) scale(var(--dev-dora-label-scale, .72));\n  transform-origin: top right;\n}\n"
patch('client/src/clarity.css', patch_clarity_css)

def patch_table_css(s):
    s = replace_once(s, ".table-3d-active .counter-score {\n  min-width: 88px;", ".table-3d-active .counter-score {\n  scale: var(--dev-center-score-scale, 1.25);\n  transform-origin: center;\n  min-width: 88px;", "center score scale")
    return s
patch('client/src/table-3d.css', patch_table_css)

def patch_table(s):
    s = replace_once(s, "    gameLogWidth: number;\n  };", "    gameLogWidth: number;\n    tileLabelScale: number;\n    tileLabelX: number;\n    tileLabelY: number;\n    doraLabelScale: number;\n    doraLabelX: number;\n    doraLabelY: number;\n    centerScoreScale: number;\n  };", "3d ui type")
    s = replace_once(s, "    gameLogWidth: 290,\n  },\n  graphics: { pixelRatio: 1.35, shadowQuality: 1, anisotropy: 4 },", "    gameLogWidth: 290,\n    tileLabelScale: 1,\n    tileLabelX: 0,\n    tileLabelY: 0,\n    doraLabelScale: .72,\n    doraLabelX: 0,\n    doraLabelY: 0,\n    centerScoreScale: 1.25,\n  },\n  graphics: { pixelRatio: 1.0, shadowQuality: 1, anisotropy: 4 },", "3d defaults")
    s = replace_once(s, "      gameLogWidth: finiteNumber(raw.ui?.gameLogWidth, DEFAULT_DEV_TUNING.ui.gameLogWidth),\n    },", "      gameLogWidth: finiteNumber(raw.ui?.gameLogWidth, DEFAULT_DEV_TUNING.ui.gameLogWidth),\n      tileLabelScale: finiteNumber(raw.ui?.tileLabelScale, DEFAULT_DEV_TUNING.ui.tileLabelScale),\n      tileLabelX: finiteNumber(raw.ui?.tileLabelX, DEFAULT_DEV_TUNING.ui.tileLabelX),\n      tileLabelY: finiteNumber(raw.ui?.tileLabelY, DEFAULT_DEV_TUNING.ui.tileLabelY),\n      doraLabelScale: finiteNumber(raw.ui?.doraLabelScale, DEFAULT_DEV_TUNING.ui.doraLabelScale),\n      doraLabelX: finiteNumber(raw.ui?.doraLabelX, DEFAULT_DEV_TUNING.ui.doraLabelX),\n      doraLabelY: finiteNumber(raw.ui?.doraLabelY, DEFAULT_DEV_TUNING.ui.doraLabelY),\n      centerScoreScale: finiteNumber(raw.ui?.centerScoreScale, DEFAULT_DEV_TUNING.ui.centerScoreScale),\n    },", "3d read ui")
    s = replace_once(s, "  if (Math.abs(parsed.tiles.riverRowGap - .55) < .0001) parsed.tiles.riverRowGap = .60;", "  if (Math.abs(parsed.tiles.riverRowGap - .55) < .0001) parsed.tiles.riverRowGap = .60;\n  if (Math.abs(parsed.graphics.pixelRatio - 1.35) < .0001) parsed.graphics.pixelRatio = 1.0;", "3d pixel migration")
    s = replace_once(s, "  pickMeshes: any[];\n};", "  pickMeshes: any[];\n  stressActors: TileActor[];\n};", "stress actors type")
    s = s.replace("renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tuning.graphics.pixelRatio));", "renderer.setPixelRatio(Math.max(.5, Math.min(2, tuning.graphics.pixelRatio)));")
    s = s.replace("rt.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tuning.graphics.pixelRatio));", "rt.renderer.setPixelRatio(Math.max(.5, Math.min(2, tuning.graphics.pixelRatio)));")
    s = replace_once(s, "  const staticRiverCapacity = 96;", "  const staticRiverCapacity = 192;", "river capacity")
    s = replace_once(s, "    pickMeshes: [],\n  };", "    pickMeshes: [],\n    stressActors: [],\n  };", "stress init")
    s = replace_once(s, "  for (const actor of rt.actors.values()) {\n    actor.face.material = materialForFace(rt, actor.spec.label, actor.spec.back);\n  }", "  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n    actor.face.material = materialForFace(rt, actor.spec.label, actor.spec.back);\n  }", "face mode stress")
    s = replace_once(s, "  for (const actor of rt.actors.values()) {\n    const canBatch = actor.spec.zone === 'river' && !actor.motion && count < rt.staticRiverCapacity;", "  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n    const canBatch = actor.spec.zone === 'river' && !actor.motion && count < rt.staticRiverCapacity;", "batch stress actors")
    s = replace_once(s, "  for (const actor of rt.actors.values()) {\n    actor.face.position.y = tuning.tiles.faceOffset;\n    actor.face.rotation.x = radians(tuning.tiles.faceRotateX);\n    actor.face.scale.setScalar(tuning.tiles.faceScale);\n  }", "  for (const actor of [...rt.actors.values(), ...rt.stressActors]) {\n    actor.face.position.y = tuning.tiles.faceOffset;\n    actor.face.rotation.x = radians(tuning.tiles.faceRotateX);\n    actor.face.scale.setScalar(tuning.tiles.faceScale);\n  }", "apply tuning stress")
    s = replace_once(s, "        actors: rt.actors.size,", "        actors: rt.actors.size + rt.stressActors.length,", "diagnostic total actors")
    s = replace_once(s, "function removeActor(rt: TableRuntime, actor: TileActor): void {", '''const STRESS_TILE_LABELS = [
  '1m','2m','3m','4m','5m','6m','7m','8m','9m',
  '1p','2p','3p','4p','5p','6p','7p','8p','9p',
  '1s','2s','3s','4s','5s','6s','7s','8s','9s',
  'east','south','west','north','white dragon','green dragon','red dragon',
] as const;

function clearStressDiscards(rt: TableRuntime): void {
  for (const actor of rt.stressActors) actor.group.removeFromParent();
  rt.stressActors = [];
  rt.staticRiverDirty = true;
  syncStaticRiverInstances(rt);
}

function fillStressDiscards(rt: TableRuntime): void {
  clearStressDiscards(rt);
  const sides: Side[] = ['bottom', 'right', 'top', 'left'];
  for (const side of sides) {
    const existing = [...rt.actors.values()].filter((actor) => actor.spec.zone === 'river' && actor.spec.side === side).length;
    for (let index = existing; index < 24; index += 1) {
      const label = STRESS_TILE_LABELS[(index + sides.indexOf(side) * 7) % STRESS_TILE_LABELS.length];
      const spec: TileSpec = {
        key: `stress:${side}:${index}`,
        zone: 'river',
        side,
        player: `stress-${side}`,
        index,
        total: 24,
        label,
        back: false,
        selectable: false,
        advised: false,
        drawn: false,
        latest: false,
        tileId: null,
        element: null,
      };
      const target = humanizeTransform(spec, baseTransform(spec));
      const actor = createActor(rt, spec, target);
      actor.motion = null;
      rt.stressActors.push(actor);
    }
  }
  rt.staticRiverDirty = true;
  syncStaticRiverInstances(rt);
}

function removeActor(rt: TableRuntime, actor: TileActor): void {''', "stress functions")
    s = replace_once(s, "window.addEventListener('storage', (event) => {", "window.addEventListener('mahjong-live:dev-stress-discards', (event) => {\n  if (!runtime) return;\n  const enabled = Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled);\n  if (enabled) fillStressDiscards(runtime);\n  else clearStressDiscards(runtime);\n});\n\nwindow.addEventListener('storage', (event) => {", "stress event listener")
    return s
patch('client/src/table-3d.ts', patch_table)
