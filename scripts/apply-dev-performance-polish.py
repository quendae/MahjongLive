from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def rep(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'missing target: {label}')
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f'missing start: {label}')
    b = text.find(end, a)
    if b < 0:
        raise RuntimeError(f'missing end: {label}')
    return text[:a] + replacement + text[b:]

# --- client/src/main.ts ------------------------------------------------------
p = 'client/src/main.ts'
t = read(p)
action_bar = '''function actionBar(): string {
  if (!current) return '';
  // Presentation captions used to announce every bot draw/discard in a large dock below the
  // table. The 3D movement already communicates this and the extra text leaked information while
  // consuming valuable vertical space, so automated presentation frames stay visually silent.
  if (presentationLocked) return '';

  const prompt = current.prompt;
  if (prompt.kind === 'round-ended' || prompt.kind === 'match-ended') return '';

  const buttons: string[] = [];
  if (prompt.kind === 'turn') {
    if (legalAction(prompt, 'tsumo')) buttons.push(actionButton('Tsumo', 'tsumo', 'action-win'));
    if (legalAction(prompt, 'riichi-discard')) {
      buttons.push(actionButton(riichiMode ? 'Cancel Riichi' : 'Riichi', 'riichi', riichiMode ? 'action-active' : ''));
    }
    if (legalAction(prompt, 'ankan')) buttons.push(actionButton('Closed Kan', 'ankan'));
    if (legalAction(prompt, 'shouminkan')) buttons.push(actionButton('Added Kan', 'shouminkan'));
  } else {
    if (legalAction(prompt, 'ron')) buttons.push(actionButton('Ron', 'ron', 'action-win'));
    if (legalAction(prompt, 'pon')) buttons.push(actionButton('Pon', 'pon'));
    if (legalAction(prompt, 'chi')) buttons.push(actionButton('Chi', 'chi'));
    if (legalAction(prompt, 'daiminkan')) buttons.push(actionButton('Kan', 'daiminkan'));
    buttons.push(actionButton('Pass', 'pass', 'action-pass'));
  }

  const advisor = advisorStrip();
  if (buttons.length === 0 && !advisor) return '';
  return `
    <div class="action-dock action-dock-compact">
      ${advisor}
      <div class="action-buttons">${buttons.join('')}</div>
    </div>
  `;
}

'''
t = replace_between(t, 'function actionBar(): string {', 'function eventText(', action_bar, 'action bar')
write(p, t)

# --- client/src/style.css ---------------------------------------------------
p = 'client/src/style.css'
t = read(p)
t = rep(t, 'height: clamp(620px, calc(100vh - 170px), 850px);', 'height: clamp(620px, calc(100vh - 108px), 940px);', 'table height')
t = rep(t, 'height: clamp(620px, calc(100vh - 170px), 850px);', 'height: clamp(620px, calc(100vh - 108px), 940px);', 'log height')
t += '''

/* The normal discard hint/presentation ticker was removed: only actual decision buttons reserve
   space below the table now. */
.action-dock-compact {
  min-height: 54px;
  margin-top: 8px;
  justify-content: flex-end;
  padding: 7px 10px;
}
.action-dock-compact .advisor-strip { margin-right: auto; }
'''
write(p, t)

# --- client/src/dev-tuning.ts -----------------------------------------------
p = 'client/src/dev-tuning.ts'
t = read(p)
t = rep(t, '    calledTileRotation: number;\n', '    calledTileRotation: number;\n    calledTileGap: number;\n', 'dev called gap type')
t = rep(t, '  tableColor: string;\n', '  graphics: { pixelRatio: number; shadowQuality: number; anisotropy: number };\n  tableColor: string;\n', 'dev graphics type')
t = rep(t, '    calledTileRotation: 90,\n', '    calledTileRotation: 90,\n    calledTileGap: .10,\n', 'dev called gap default')
t = rep(t, "  tableColor: '#370f53',\n", "  graphics: { pixelRatio: 1.35, shadowQuality: 1, anisotropy: 4 },\n  tableColor: '#370f53',\n", 'dev graphics defaults')
t = rep(t, '      calledTileRotation: finite(raw.tiles?.calledTileRotation, DEFAULTS.tiles.calledTileRotation),\n', '      calledTileRotation: finite(raw.tiles?.calledTileRotation, DEFAULTS.tiles.calledTileRotation),\n      calledTileGap: finite(raw.tiles?.calledTileGap, DEFAULTS.tiles.calledTileGap),\n', 'dev called gap load')
t = rep(t, '    tableColor: typeof raw.tableColor === \'string\' ? raw.tableColor : DEFAULTS.tableColor,\n', "    graphics: {\n      pixelRatio: finite(raw.graphics?.pixelRatio, DEFAULTS.graphics.pixelRatio),\n      shadowQuality: finite(raw.graphics?.shadowQuality, DEFAULTS.graphics.shadowQuality),\n      anisotropy: finite(raw.graphics?.anisotropy, DEFAULTS.graphics.anisotropy),\n    },\n    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULTS.tableColor,\n", 'dev graphics load')
t = rep(t, '  applyDomPreview();\n  window.dispatchEvent', '  applyDomPreview();\n  updateBackPreview();\n  window.dispatchEvent', 'back preview broadcast')

# Custom in-app picker replaces the platform/Windows input[type=color].
start = 'function colorControl(\n'
end = 'async function optimizedBackImage'
custom_picker = r'''function rgbToHsv(rgb: [number, number, number]): [number, number, number] {
  const [r0, g0, b0] = rgb.map((value) => value / 255) as [number, number, number];
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r0) h = 60 * (((g0 - b0) / delta) % 6);
    else if (max === g0) h = 60 * ((b0 - r0) / delta + 2);
    else h = 60 * ((r0 - g0) / delta + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : delta / max;
  return [h, s, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgb.map((value) => Math.round((value + m) * 255)) as [number, number, number];
}

function updateBackPreview(): void {
  const preview = panel?.querySelector<HTMLElement>('.dev-back-preview');
  if (!preview) return;
  preview.style.backgroundColor = settings.backColor;
  preview.style.backgroundPosition = 'center';
  preview.style.backgroundRepeat = 'repeat';
  const strength = Math.max(0, Math.min(1, settings.backPatternStrength));
  const dark = (alpha: number) => `rgba(4,12,8,${(alpha * strength).toFixed(3)})`;
  const light = (alpha: number) => `rgba(255,255,255,${(alpha * strength).toFixed(3)})`;
  if (settings.backPattern === 'custom' && settings.backImage) {
    preview.style.backgroundImage = `url("${settings.backImage}")`;
    preview.style.backgroundSize = 'cover';
  } else if (settings.backPattern === 'ribbed') {
    preview.style.backgroundImage = `repeating-linear-gradient(90deg, ${dark(.34)} 0 3px, ${light(.22)} 3px 4px, transparent 4px 11px)`;
    preview.style.backgroundSize = 'auto';
  } else if (settings.backPattern === 'woven') {
    preview.style.backgroundImage = `repeating-linear-gradient(45deg, ${dark(.24)} 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, ${light(.18)} 0 2px, transparent 2px 12px)`;
    preview.style.backgroundSize = 'auto';
  } else if (settings.backPattern === 'diamond' || settings.backPattern === 'classic') {
    preview.style.backgroundImage = `linear-gradient(45deg, transparent 44%, ${dark(.26)} 45% 55%, transparent 56%), linear-gradient(-45deg, transparent 44%, ${light(.18)} 45% 55%, transparent 56%)`;
    preview.style.backgroundSize = settings.backPattern === 'classic' ? '26px 26px' : '20px 20px';
  } else if (settings.backPattern === 'waves') {
    preview.style.backgroundImage = `repeating-radial-gradient(ellipse at 0 50%, transparent 0 9px, ${dark(.25)} 10px 12px, transparent 13px 22px)`;
    preview.style.backgroundSize = '42px 24px';
  } else {
    preview.style.backgroundImage = 'none';
    preview.style.backgroundSize = 'auto';
  }
}

function colorControl(
  parent: HTMLElement,
  label: string,
  get: () => string,
  set: (value: string) => void,
  defaultValue: string,
): void {
  const row = document.createElement('div');
  row.className = 'dev-tuning-color dev-color-control';
  const name = document.createElement('label');
  name.textContent = label;

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'dev-color-swatch';
  swatch.title = `Open ${label} color picker`;

  const nums = [0, 1, 2].map(() => {
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.max = '255'; input.step = '1';
    return input;
  });
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'dev-tuning-reset'; reset.textContent = '↺'; reset.title = `Reset ${label}`;

  const popover = document.createElement('div');
  popover.className = 'dev-color-popover';
  popover.hidden = true;
  const sv = document.createElement('div');
  sv.className = 'dev-color-sv';
  const marker = document.createElement('i');
  sv.append(marker);
  const hue = document.createElement('input');
  hue.type = 'range'; hue.min = '0'; hue.max = '359'; hue.step = '1'; hue.className = 'dev-color-hue';
  const hex = document.createElement('input');
  hex.className = 'dev-color-hex'; hex.maxLength = 7; hex.spellcheck = false;
  popover.append(sv, hue, hex);
  row.append(name, swatch, ...nums, reset, popover);
  parent.append(row);

  let [h, s, v] = rgbToHsv(hexToRgb(get()));
  const paint = (value: string, updateHsv = true) => {
    if (updateHsv) [h, s, v] = rgbToHsv(hexToRgb(value));
    swatch.style.background = value;
    const rgb = hexToRgb(value);
    nums.forEach((input, index) => { input.value = String(rgb[index]); });
    hex.value = value.toUpperCase();
    hue.value = String(Math.round(h));
    sv.style.setProperty('--picker-hue', String(h));
    marker.style.left = `${s * 100}%`;
    marker.style.top = `${(1 - v) * 100}%`;
  };
  const commit = (value: string, updateHsv = true) => {
    const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : get();
    set(normalized);
    paint(normalized, updateHsv);
    saveAndBroadcast();
  };
  paint(get());

  const setSvFromPointer = (event: PointerEvent) => {
    const rect = sv.getBoundingClientRect();
    s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const rgb = hsvToRgb(h, s, v);
    commit(rgbToHex(...rgb), false);
  };
  sv.addEventListener('pointerdown', (event) => {
    sv.setPointerCapture(event.pointerId);
    setSvFromPointer(event);
  });
  sv.addEventListener('pointermove', (event) => {
    if (sv.hasPointerCapture(event.pointerId)) setSvFromPointer(event);
  });
  hue.addEventListener('input', () => {
    h = Number(hue.value);
    const rgb = hsvToRgb(h, s, v);
    commit(rgbToHex(...rgb), false);
  });
  nums.forEach((input) => input.addEventListener('change', () => commit(rgbToHex(Number(nums[0].value), Number(nums[1].value), Number(nums[2].value)))));
  hex.addEventListener('change', () => {
    let value = hex.value.trim();
    if (!value.startsWith('#')) value = `#${value}`;
    if (/^#[0-9a-f]{6}$/i.test(value)) commit(value);
    else paint(get());
  });
  reset.addEventListener('click', () => commit(defaultValue));
  swatch.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll<HTMLElement>('.dev-color-popover').forEach((other) => { if (other !== popover) other.hidden = true; });
    popover.hidden = !popover.hidden;
  });
  popover.addEventListener('pointerdown', (event) => event.stopPropagation());
  document.addEventListener('pointerdown', (event) => {
    if (!row.contains(event.target as Node)) popover.hidden = true;
  });
}

'''
t = replace_between(t, start, end, custom_picker, 'custom color picker')

# Dev panel header + graphics controls.
t = rep(t, '      <strong>3D Dev Tuning</strong>\n      <span>F2</span>', '      <strong>3D Dev Tuning</strong>\n      <span class="dev-fps-value">FPS --</span>\n      <span>F2</span>', 'fps header')
t = rep(t, '  root.append(camera);\n\n  rotationSection', '''  root.append(camera);

  const graphics = document.createElement('section');
  graphics.className = 'dev-tuning-section';
  graphics.innerHTML = '<h3>Performance & graphics</h3>';
  numberSlider(graphics, 'Pixel ratio', .75, 2.00, .05, () => settings.graphics.pixelRatio, (v) => { settings.graphics.pixelRatio = v; }, '×', DEFAULTS.graphics.pixelRatio);
  numberSlider(graphics, 'Shadow quality', 0, 3, 1, () => settings.graphics.shadowQuality, (v) => { settings.graphics.shadowQuality = v; }, '', DEFAULTS.graphics.shadowQuality);
  numberSlider(graphics, 'Texture filtering', 1, 8, 1, () => settings.graphics.anisotropy, (v) => { settings.graphics.anisotropy = v; }, '×', DEFAULTS.graphics.anisotropy);
  graphics.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Pixel ratio has the biggest FPS impact. Shadow quality: 0=off, 1=512, 2=1024, 3=2048. Raise filtering for sharper angled tile/table textures.</p>');
  root.append(graphics);

  rotationSection''', 'graphics section')
t = rep(t, "  numberSlider(tileSection, 'Called tile turn', -180, 180, 1, () => settings.tiles.calledTileRotation, (v) => { settings.tiles.calledTileRotation = v; }, '°', DEFAULTS.tiles.calledTileRotation);\n", "  numberSlider(tileSection, 'Called tile turn', -180, 180, 1, () => settings.tiles.calledTileRotation, (v) => { settings.tiles.calledTileRotation = v; }, '°', DEFAULTS.tiles.calledTileRotation);\n  numberSlider(tileSection, 'Called tile gap', 0, .30, .01, () => settings.tiles.calledTileGap, (v) => { settings.tiles.calledTileGap = v; }, '', DEFAULTS.tiles.calledTileGap);\n", 'called tile gap control')
t = rep(t, "  surfaces.className = 'dev-tuning-section';\n  surfaces.innerHTML = '<h3>Felt & tile backs</h3>';", "  surfaces.className = 'dev-tuning-section dev-back-section';\n  surfaces.innerHTML = '<h3>Felt & tile backs</h3><div class=\"dev-back-preview-card\"><div class=\"dev-back-preview-shell\"><div class=\"dev-back-preview\"></div></div><span>Back preview</span></div>';", 'back preview markup')
t = rep(t, "  root.append(surfaces);\n\n  const actions", "  root.append(surfaces);\n  requestAnimationFrame(updateBackPreview);\n\n  const actions", 'initial back preview')
t = rep(t, 'ensureUi();\nsyncDevOpenClass();\nsaveAndBroadcast();', '''window.addEventListener('mahjong-live:fps', (event) => {
  const detail = (event as CustomEvent<{ fps?: number; calls?: number; triangles?: number; pixelRatio?: number }>).detail;
  const target = panel?.querySelector<HTMLElement>('.dev-fps-value');
  if (!target || !detail) return;
  const fps = Number.isFinite(detail.fps) ? Math.round(detail.fps ?? 0) : 0;
  target.textContent = `${fps} FPS · ${detail.calls ?? 0} calls · ${(detail.pixelRatio ?? 1).toFixed(2)}×`;
  target.classList.toggle('fps-low', fps > 0 && fps < 45);
});
ensureUi();
syncDevOpenClass();
saveAndBroadcast();''', 'fps listener')
write(p, t)

# --- client/src/dev-tuning.css ----------------------------------------------
p = 'client/src/dev-tuning.css'
t = read(p)
t += r'''

/* In-app colour picker: consistent across Windows/macOS/Linux instead of invoking the OS picker. */
.dev-color-control { position: relative; }
.dev-color-swatch {
  width: 42px; height: 30px; padding: 0; border-radius: 7px;
  border: 1px solid rgba(255,255,255,.22); box-shadow: inset 0 0 0 2px rgba(0,0,0,.12);
  cursor: pointer;
}
.dev-color-popover {
  position: absolute; z-index: 120; right: 30px; top: 34px; width: 210px; padding: 10px;
  border: 1px solid rgba(232,201,112,.3); border-radius: 11px;
  background: rgba(5,14,10,.99); box-shadow: 0 18px 45px rgba(0,0,0,.55);
}
.dev-color-popover[hidden] { display: none; }
.dev-color-sv {
  --picker-hue: 0;
  position: relative; height: 128px; border-radius: 8px; overflow: hidden; cursor: crosshair;
  background:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, hsl(var(--picker-hue) 100% 50%));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.14);
  touch-action: none;
}
.dev-color-sv i {
  position: absolute; width: 12px; height: 12px; border: 2px solid #fff; border-radius: 50%;
  transform: translate(-50%, -50%); box-shadow: 0 0 0 1px #000, 0 1px 4px rgba(0,0,0,.7); pointer-events: none;
}
.dev-color-hue { width: 100%; margin: 9px 0 7px; accent-color: transparent; }
.dev-color-hue::-webkit-slider-runnable-track { height: 9px; border-radius: 999px; background: linear-gradient(90deg,#f44,#ff0,#0f0,#0ff,#44f,#f0f,#f44); }
.dev-color-hue::-moz-range-track { height: 9px; border-radius: 999px; background: linear-gradient(90deg,#f44,#ff0,#0f0,#0ff,#44f,#f0f,#f44); }
.dev-color-hex { width: 100%; padding: 7px 8px; border: 1px solid rgba(255,255,255,.13); border-radius: 7px; color: #f0e5c4; background: rgba(255,255,255,.05); font-family: ui-monospace, monospace; text-transform: uppercase; }
.dev-fps-value { color: #8bd7a9 !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dev-fps-value.fps-low { color: #f0a070 !important; }

.dev-back-section::after { content: ''; display: block; clear: both; }
.dev-back-preview-card { float: right; width: 126px; margin: 0 0 10px 10px; text-align: center; color: #82988c; font-size: 9px; }
.dev-back-preview-shell {
  width: 104px; height: 142px; margin: 0 auto 5px; padding: 5px 5px 5px 11px;
  border-radius: 13px; background: #fbfbf8;
  box-shadow: inset 0 0 0 1px rgba(35,45,39,.2), 0 9px 20px rgba(0,0,0,.35);
}
.dev-back-preview {
  width: 100%; height: 100%; border-radius: 9px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.24), inset 2px 2px 5px rgba(255,255,255,.25);
}
'''
write(p, t)

# --- client/src/table-3d.ts -------------------------------------------------
p = 'client/src/table-3d.ts'
t = read(p)
t = rep(t, 'const TILE_BACK_OFFSET = .124;', 'const TILE_BACK_OFFSET = .142;', 'back face offset')
t = rep(t, '    calledTileRotation: number;\n', '    calledTileRotation: number;\n    calledTileGap: number;\n', '3d called gap type')
t = rep(t, '  tableColor: string;\n', '  graphics: { pixelRatio: number; shadowQuality: number; anisotropy: number };\n  tableColor: string;\n', '3d graphics type')
t = rep(t, '    calledTileRotation: 90,\n', '    calledTileRotation: 90,\n    calledTileGap: .10,\n', '3d called gap default')
t = rep(t, "  tableColor: '#370f53',\n", "  graphics: { pixelRatio: 1.35, shadowQuality: 1, anisotropy: 4 },\n  tableColor: '#370f53',\n", '3d graphics default')
t = rep(t, '  backShellMaterial: any;\n', '  backShellMaterial: any;\n  keyLight: any;\n', 'runtime key light')
t = rep(t, '  faceMode: TileFaceMode;\n};', '  faceMode: TileFaceMode;\n  fpsFrames: number;\n  fpsSampleStart: number;\n};', 'runtime fps fields')
t = rep(t, '      calledTileRotation: finiteNumber(raw.tiles?.calledTileRotation, DEFAULT_DEV_TUNING.tiles.calledTileRotation),\n', '      calledTileRotation: finiteNumber(raw.tiles?.calledTileRotation, DEFAULT_DEV_TUNING.tiles.calledTileRotation),\n      calledTileGap: finiteNumber(raw.tiles?.calledTileGap, DEFAULT_DEV_TUNING.tiles.calledTileGap),\n', '3d called gap load')
t = rep(t, '    tableColor: typeof raw.tableColor === \'string\' ? raw.tableColor : DEFAULT_DEV_TUNING.tableColor,\n', "    graphics: {\n      pixelRatio: finiteNumber(raw.graphics?.pixelRatio, DEFAULT_DEV_TUNING.graphics.pixelRatio),\n      shadowQuality: finiteNumber(raw.graphics?.shadowQuality, DEFAULT_DEV_TUNING.graphics.shadowQuality),\n      anisotropy: finiteNumber(raw.graphics?.anisotropy, DEFAULT_DEV_TUNING.graphics.anisotropy),\n    },\n    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULT_DEV_TUNING.tableColor,\n", '3d graphics load')
# Opposite player's discards should face that player: flip top river faces 180 degrees.
t = rep(t, '      // Discards are oriented toward the player who threw them, not toward table centre.\n      transform.yaw = 0;', '      // The opposite player sees the tile upright from their seat, so their river is 180° from ours.\n      transform.yaw = Math.PI;', 'top river rotation')
# Called tile spacing in addition to its sideways turn.
t = rep(t, '''    if (spec.called) {
      transform.yaw += radians(tuning.tiles.calledTileRotation);
      transform.y += .012;
    }''', '''    if (spec.called) {
      transform.yaw += radians(tuning.tiles.calledTileRotation);
      const extra = tuning.tiles.calledTileGap;
      if (spec.side === 'bottom') transform.x += extra;
      else if (spec.side === 'top') transform.x -= extra;
      else if (spec.side === 'left') transform.z += extra;
      else transform.z -= extra;
      transform.y += .012;
    }''', 'called tile spacing')
# Runtime filtering follows Dev quality setting.
t = rep(t, 'texture.anisotropy = Math.min(8, rt.renderer.capabilities.getMaxAnisotropy());', 'texture.anisotropy = Math.min(readDevTuning().graphics.anisotropy, rt.renderer.capabilities.getMaxAnisotropy());', 'face anisotropy')
t = rep(t, '    texture.anisotropy = Math.min(2, rt.renderer.capabilities.getMaxAnisotropy());', '    texture.anisotropy = Math.min(readDevTuning().graphics.anisotropy, rt.renderer.capabilities.getMaxAnisotropy());', 'table anisotropy')
t = rep(t, '  texture.anisotropy = Math.min(8, rt.renderer.capabilities.getMaxAnisotropy());', '  texture.anisotropy = Math.min(readDevTuning().graphics.anisotropy, rt.renderer.capabilities.getMaxAnisotropy());', 'back anisotropy')

# Add shadow quality mapper before runtime creation.
t = rep(t, 'function createRuntime(THREE: any): TableRuntime {\n  const renderer', '''function shadowMapSize(level: number): number {
  if (level <= 0) return 0;
  if (level <= 1) return 512;
  if (level <= 2) return 1024;
  return 2048;
}

function createRuntime(THREE: any): TableRuntime {
  const tuning = readDevTuning();
  const renderer''', 'graphics runtime helper')
t = rep(t, '  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));', '  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tuning.graphics.pixelRatio));', 'pixel ratio runtime')
t = rep(t, '  renderer.shadowMap.enabled = true;', '  renderer.shadowMap.enabled = tuning.graphics.shadowQuality > 0;', 'shadow runtime enabled')
t = rep(t, '\n  const tuning = readDevTuning();\n  const scene = new THREE.Scene();', '\n  const scene = new THREE.Scene();', 'remove duplicate tuning')
t = rep(t, '''  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-4.8, 11, 7.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);''', '''  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(-4.8, 11, 7.2);
  const initialShadowSize = shadowMapSize(tuning.graphics.shadowQuality);
  key.castShadow = initialShadowSize > 0;
  if (initialShadowSize > 0) key.shadow.mapSize.set(initialShadowSize, initialShadowSize);''', 'shadow light setup')
t = rep(t, '    backShellMaterial,\n    tableTexture:', '    backShellMaterial,\n    keyLight: key,\n    tableTexture:', 'runtime key assignment')
t = rep(t, '    faceMode: readFaceMode(),\n  };', '    faceMode: readFaceMode(),\n    fpsFrames: 0,\n    fpsSampleStart: performance.now(),\n  };', 'runtime fps init')

# Live graphics settings.
t = rep(t, '  rt.camera.updateProjectionMatrix();\n  rt.scene.background', '''  rt.camera.updateProjectionMatrix();
  rt.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tuning.graphics.pixelRatio));
  const shadowSize = shadowMapSize(tuning.graphics.shadowQuality);
  rt.renderer.shadowMap.enabled = shadowSize > 0;
  rt.keyLight.castShadow = shadowSize > 0;
  if (shadowSize > 0 && rt.keyLight.shadow.mapSize.width !== shadowSize) {
    rt.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    rt.keyLight.shadow.map?.dispose?.();
    rt.keyLight.shadow.map = null;
  }
  const maxAnisotropy = rt.renderer.capabilities.getMaxAnisotropy();
  if (rt.tableTexture) rt.tableTexture.anisotropy = Math.min(tuning.graphics.anisotropy, maxAnisotropy);
  if (rt.backTexture) rt.backTexture.anisotropy = Math.min(tuning.graphics.anisotropy, maxAnisotropy);
  for (const material of rt.faceMaterials.values()) {
    if (material.map) material.map.anisotropy = Math.min(tuning.graphics.anisotropy, maxAnisotropy);
  }
  rt.scene.background''', 'apply live graphics')
# FPS telemetry after rendering.
t = rep(t, '  rt.renderer.render(rt.scene, rt.camera);\n}', '''  rt.renderer.render(rt.scene, rt.camera);
  rt.fpsFrames += 1;
  const sampleMs = time - rt.fpsSampleStart;
  if (sampleMs >= 600) {
    if (document.body.classList.contains('dev-tuning-open')) {
      window.dispatchEvent(new CustomEvent('mahjong-live:fps', { detail: {
        fps: rt.fpsFrames * 1000 / sampleMs,
        calls: rt.renderer.info.render.calls,
        triangles: rt.renderer.info.render.triangles,
        pixelRatio: rt.renderer.getPixelRatio(),
      } }));
    }
    rt.fpsFrames = 0;
    rt.fpsSampleStart = time;
  }
}''', 'fps telemetry')
write(p, t)
