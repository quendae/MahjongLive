import './dev-tuning.css';

const STORAGE_KEY = 'mahjong-live:dev-tuning:v1';
const EVENT_NAME = 'mahjong-live:dev-tuning';

type Rotation = { x: number; y: number; z: number };
type CameraSettings = { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number; fov: number };
type DevTuning = {
  camera: CameraSettings;
  left: Rotation;
  right: Rotation;
  top: Rotation;
  bottom: Rotation;
  tiles: {
    faceOffset: number;
    faceRotateX: number;
    faceScale: number;
    faceTextureRotation: number;
    bodyColor: string;
    bodyRoughness: number;
    faceTint: string;
    ownScale: number;
    opponentScale: number;
    riverScale: number;
    meldScale: number;
    riverDepth: number;
    riverRowGap: number;
    riverColumnGap: number;
    riverJitter: number;
    riverYawJitter: number;
    riverTiltJitter: number;
    meldGap: number;
    meldRowGap: number;
    calledTileRotation: number;
    calledTileGap: number;
  };
  tableGeometry: {
    frameTopY: number;
    feltTopY: number;
    frameWidth: number;
    frameThickness: number;
    feltThickness: number;
  };
  ui: {
    playerCardScale: number;
    playerInsetTB: number;
    playerInsetSides: number;
    doraScale: number;
    doraX: number;
    doraY: number;
    centerScale: number;
    centerOffsetX: number;
    centerOffsetY: number;
    centerWidth: number;
    centerHeight: number;
    reactionScale: number;
    gameLogWidth: number;
    tileLabelScale: number;
    tileLabelX: number;
    tileLabelY: number;
    doraLabelScale: number;
    doraLabelX: number;
    doraLabelY: number;
    centerScoreScale: number;
  };
  graphics: { pixelRatio: number; shadowQuality: number; anisotropy: number };
  tableColor: string;
  tableImage: string | null;
  woodColor: string;
  backColor: string;
  backPattern: string;
  backPatternStrength: number;
  backImage: string | null;
  sceneColor: string;
};

const DEFAULTS: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: -.65, targetZ: .15, fov: 27 },
  left: { x: -90, y: 180, z: -90 },
  right: { x: -90, y: 180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 90, y: 0, z: 0 },
  tiles: {
    faceOffset: .128,
    faceRotateX: -90,
    faceScale: .87,
    faceTextureRotation: 0,
    bodyColor: '#fbfbfb',
    bodyRoughness: .46,
    faceTint: '#fbfbfb',
    ownScale: 1,
    opponentScale: 1,
    riverScale: 1,
    meldScale: 1,
    riverDepth: 2.14,
    riverRowGap: .60,
    riverColumnGap: .45,
    riverJitter: .028,
    riverYawJitter: 3.2,
    riverTiltJitter: .7,
    meldGap: .36,
    meldRowGap: .48,
    calledTileRotation: 90,
    calledTileGap: .10,
  },
  tableGeometry: { frameTopY: .25, feltTopY: .11, frameWidth: .22, frameThickness: .45, feltThickness: .10 },
  ui: {
    playerCardScale: 1.5,
    playerInsetTB: 10,
    playerInsetSides: 57,
    doraScale: 1.29,
    doraX: 24,
    doraY: 24,
    centerScale: .92,
    centerOffsetX: 0,
    centerOffsetY: -10,
    centerWidth: 309,
    centerHeight: 265,
    reactionScale: 1,
    gameLogWidth: 290,
    tileLabelScale: 1,
    tileLabelX: 0,
    tileLabelY: 0,
    doraLabelScale: .72,
    doraLabelX: 0,
    doraLabelY: 0,
    centerScoreScale: 1.25,
  },
  graphics: { pixelRatio: 1.0, shadowQuality: 1, anisotropy: 4 },
  tableColor: '#370f53',
  tableImage: null,
  woodColor: '#3a2b20',
  backColor: '#315c49',
  backPattern: 'ribbed',
  backPatternStrength: .48,
  backImage: null,
  sceneColor: '#071b13',
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function rotation(value: any, fallback: Rotation): Rotation {
  return {
    x: finite(value?.x, fallback.x),
    y: finite(value?.y, fallback.y),
    z: finite(value?.z, fallback.z),
  };
}

function loadSettings(): DevTuning {
  let raw: any = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { raw = {}; }
  return {
    camera: {
      x: finite(raw.camera?.x, DEFAULTS.camera.x),
      y: finite(raw.camera?.y, DEFAULTS.camera.y),
      z: finite(raw.camera?.z, DEFAULTS.camera.z),
      targetX: finite(raw.camera?.targetX, DEFAULTS.camera.targetX),
      targetY: finite(raw.camera?.targetY, DEFAULTS.camera.targetY),
      targetZ: finite(raw.camera?.targetZ, DEFAULTS.camera.targetZ),
      fov: finite(raw.camera?.fov, DEFAULTS.camera.fov),
    },
    left: rotation(raw.left, DEFAULTS.left),
    right: rotation(raw.right, DEFAULTS.right),
    top: rotation(raw.top, DEFAULTS.top),
    bottom: rotation(raw.bottom, DEFAULTS.bottom),
    tiles: {
      faceOffset: finite(raw.tiles?.faceOffset, DEFAULTS.tiles.faceOffset),
      faceRotateX: finite(raw.tiles?.faceRotateX, DEFAULTS.tiles.faceRotateX),
      faceScale: finite(raw.tiles?.faceScale, DEFAULTS.tiles.faceScale),
      faceTextureRotation: finite(raw.tiles?.faceTextureRotation, DEFAULTS.tiles.faceTextureRotation),
      bodyColor: typeof raw.tiles?.bodyColor === 'string' ? raw.tiles.bodyColor : DEFAULTS.tiles.bodyColor,
      bodyRoughness: finite(raw.tiles?.bodyRoughness, DEFAULTS.tiles.bodyRoughness),
      faceTint: typeof raw.tiles?.faceTint === 'string' ? raw.tiles.faceTint : DEFAULTS.tiles.faceTint,
      ownScale: finite(raw.tiles?.ownScale, DEFAULTS.tiles.ownScale),
      opponentScale: finite(raw.tiles?.opponentScale, DEFAULTS.tiles.opponentScale),
      riverScale: finite(raw.tiles?.riverScale, DEFAULTS.tiles.riverScale),
      meldScale: finite(raw.tiles?.meldScale, DEFAULTS.tiles.meldScale),
      riverDepth: finite(raw.tiles?.riverDepth, DEFAULTS.tiles.riverDepth),
      riverRowGap: finite(raw.tiles?.riverRowGap, DEFAULTS.tiles.riverRowGap),
      riverColumnGap: finite(raw.tiles?.riverColumnGap, DEFAULTS.tiles.riverColumnGap),
      riverJitter: finite(raw.tiles?.riverJitter, DEFAULTS.tiles.riverJitter),
      riverYawJitter: finite(raw.tiles?.riverYawJitter, DEFAULTS.tiles.riverYawJitter),
      riverTiltJitter: finite(raw.tiles?.riverTiltJitter, DEFAULTS.tiles.riverTiltJitter),
      meldGap: finite(raw.tiles?.meldGap, DEFAULTS.tiles.meldGap),
      meldRowGap: finite(raw.tiles?.meldRowGap, DEFAULTS.tiles.meldRowGap),
      calledTileRotation: finite(raw.tiles?.calledTileRotation, DEFAULTS.tiles.calledTileRotation),
      calledTileGap: finite(raw.tiles?.calledTileGap, DEFAULTS.tiles.calledTileGap),
    },
    tableGeometry: {
      frameTopY: finite(raw.tableGeometry?.frameTopY, DEFAULTS.tableGeometry.frameTopY),
      feltTopY: finite(raw.tableGeometry?.feltTopY, DEFAULTS.tableGeometry.feltTopY),
      frameWidth: finite(raw.tableGeometry?.frameWidth, DEFAULTS.tableGeometry.frameWidth),
      frameThickness: finite(raw.tableGeometry?.frameThickness, DEFAULTS.tableGeometry.frameThickness),
      feltThickness: finite(raw.tableGeometry?.feltThickness, DEFAULTS.tableGeometry.feltThickness),
    },
    ui: {
      playerCardScale: finite(raw.ui?.playerCardScale, DEFAULTS.ui.playerCardScale),
      playerInsetTB: finite(raw.ui?.playerInsetTB, finite(raw.ui?.playerInset, DEFAULTS.ui.playerInsetTB)),
      playerInsetSides: finite(raw.ui?.playerInsetSides, finite(raw.ui?.playerInset, DEFAULTS.ui.playerInsetSides)),
      doraScale: finite(raw.ui?.doraScale, DEFAULTS.ui.doraScale),
      doraX: finite(raw.ui?.doraX, DEFAULTS.ui.doraX),
      doraY: finite(raw.ui?.doraY, DEFAULTS.ui.doraY),
      centerScale: finite(raw.ui?.centerScale, DEFAULTS.ui.centerScale),
      centerOffsetX: finite(raw.ui?.centerOffsetX, DEFAULTS.ui.centerOffsetX),
      centerOffsetY: finite(raw.ui?.centerOffsetY, DEFAULTS.ui.centerOffsetY),
      centerWidth: finite(raw.ui?.centerWidth, DEFAULTS.ui.centerWidth),
      centerHeight: finite(raw.ui?.centerHeight, DEFAULTS.ui.centerHeight),
      reactionScale: finite(raw.ui?.reactionScale, DEFAULTS.ui.reactionScale),
      gameLogWidth: finite(raw.ui?.gameLogWidth, DEFAULTS.ui.gameLogWidth),
      tileLabelScale: finite(raw.ui?.tileLabelScale, DEFAULTS.ui.tileLabelScale),
      tileLabelX: finite(raw.ui?.tileLabelX, DEFAULTS.ui.tileLabelX),
      tileLabelY: finite(raw.ui?.tileLabelY, DEFAULTS.ui.tileLabelY),
      doraLabelScale: finite(raw.ui?.doraLabelScale, DEFAULTS.ui.doraLabelScale),
      doraLabelX: finite(raw.ui?.doraLabelX, DEFAULTS.ui.doraLabelX),
      doraLabelY: finite(raw.ui?.doraLabelY, DEFAULTS.ui.doraLabelY),
      centerScoreScale: finite(raw.ui?.centerScoreScale, DEFAULTS.ui.centerScoreScale),
    },
    graphics: {
      pixelRatio: finite(raw.graphics?.pixelRatio, DEFAULTS.graphics.pixelRatio),
      shadowQuality: finite(raw.graphics?.shadowQuality, DEFAULTS.graphics.shadowQuality),
      anisotropy: finite(raw.graphics?.anisotropy, DEFAULTS.graphics.anisotropy),
    },
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULTS.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
    woodColor: typeof raw.woodColor === 'string' ? raw.woodColor : DEFAULTS.woodColor,
    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,
    backPattern: typeof raw.backPattern === 'string' ? raw.backPattern : DEFAULTS.backPattern,
    backPatternStrength: finite(raw.backPatternStrength, DEFAULTS.backPatternStrength),
    backImage: typeof raw.backImage === 'string' ? raw.backImage : null,
    sceneColor: typeof raw.sceneColor === 'string' ? raw.sceneColor : DEFAULTS.sceneColor,
  };
}

let settings = loadSettings();
if (Math.abs(settings.tiles.riverRowGap - .55) < .0001) settings.tiles.riverRowGap = .60;
if (settings.left.x === -90 && settings.left.z === -90 && settings.left.y === 0) settings.left.y = 180;
if (settings.right.x === -90 && settings.right.z === 90 && settings.right.y === 0) settings.right.y = 180;
// Migrate the previous exact visual defaults so existing localStorage picks up the SVG-tuned baseline.
if (Math.abs(settings.tiles.faceScale - 1.1) < .0001) settings.tiles.faceScale = .87;
if (settings.tiles.bodyColor.toLowerCase() === '#ffffff') settings.tiles.bodyColor = '#fbfbfb';
if (settings.tiles.faceTint.toLowerCase() === '#ffffff') settings.tiles.faceTint = '#fbfbfb';
if (Math.abs(settings.graphics.pixelRatio - 1.35) < .0001) settings.graphics.pixelRatio = 1.0;
let panel: HTMLElement | null = null;

type PerformanceDetail = {
  fps?: number;
  loopHz?: number;
  rafHz?: number;
  frameMs?: number;
  rafFrameMs?: number;
  renderMs?: number;
  gpuMs?: number | null;
  gpuTimerSupported?: boolean;
  calls?: number;
  triangles?: number;
  actors?: number;
  moving?: number;
  instancedRivers?: number;
  batchedFaces?: number;
  faceBatches?: number;
  pixelRatio?: number;
  visibility?: string;
};

type PerformanceCapture = {
  startedAt: number;
  startedIso: string;
  lines: string[];
  samples: number;
};

let performanceCapture: PerformanceCapture | null = null;
let lastPerformanceDetail: PerformanceDetail | null = null;
let stressDiscardsActive = false;

function syncDevOpenClass(): void {
  document.body.classList.toggle('dev-tuning-open', Boolean(panel && !panel.hidden));
}

function saveAndBroadcast(message = ''): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    setStatus('Could not persist settings — the uploaded image may be too large.');
  }
  applyDomPreview();
  updateBackPreview();
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: settings }));
  if (message) setStatus(message);
}

function setStatus(text: string): void {
  const status = panel?.querySelector<HTMLElement>('.dev-tuning-status');
  if (status) status.textContent = text;
}

function performanceNumber(value: number | null | undefined, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '';
}

function updatePerformanceCaptureUi(): void {
  const start = panel?.querySelector<HTMLButtonElement>('.perf-log-start');
  const stop = panel?.querySelector<HTMLButtonElement>('.perf-log-stop');
  const state = panel?.querySelector<HTMLElement>('.perf-log-state');
  if (start) start.disabled = Boolean(performanceCapture);
  if (stop) stop.disabled = !performanceCapture;
  if (state) {
    state.textContent = performanceCapture
      ? `Recording · ${performanceCapture.samples} samples`
      : 'Not recording';
    state.classList.toggle('is-recording', Boolean(performanceCapture));
  }
}

function appendPerformanceSample(detail: PerformanceDetail): void {
  const capture = performanceCapture;
  if (!capture) return;
  const now = new Date();
  const elapsed = (performance.now() - capture.startedAt) / 1000;
  capture.lines.push([
    elapsed.toFixed(3),
    now.toISOString(),
    detail.visibility ?? document.visibilityState,
    performanceNumber(detail.loopHz ?? detail.fps),
    performanceNumber(detail.rafHz),
    performanceNumber(detail.frameMs, 3),
    performanceNumber(detail.rafFrameMs, 3),
    performanceNumber(detail.renderMs, 3),
    performanceNumber(detail.gpuMs, 3),
    String(detail.gpuTimerSupported ?? false),
    String(detail.calls ?? ''),
    String(detail.triangles ?? ''),
    String(detail.actors ?? ''),
    String(detail.moving ?? ''),
    String(detail.instancedRivers ?? ''),
    String(detail.batchedFaces ?? ''),
    String(detail.faceBatches ?? ''),
    performanceNumber(detail.pixelRatio),
  ].join('\t'));
  capture.samples += 1;
  updatePerformanceCaptureUi();
}

function startPerformanceCapture(): void {
  if (performanceCapture) return;
  const started = new Date();
  performanceCapture = {
    startedAt: performance.now(),
    startedIso: started.toISOString(),
    samples: 0,
    lines: [
      'MahjongLive performance session',
      `START\t${started.toISOString()}`,
      `userAgent\t${navigator.userAgent}`,
      `platform\t${navigator.platform}`,
      `screen\t${screen.width}x${screen.height}\tavail=${screen.availWidth}x${screen.availHeight}\tcolorDepth=${screen.colorDepth}`,
      `devicePixelRatio\t${devicePixelRatio}`,
      `hardwareConcurrency\t${navigator.hardwareConcurrency ?? ''}`,
      `visibilityAtStart\t${document.visibilityState}`,
      `graphicsSettings\tpixelRatio=${settings.graphics.pixelRatio}\tshadowQuality=${settings.graphics.shadowQuality}\tanisotropy=${settings.graphics.anisotropy}`,
      '',
      'elapsed_s\tiso_time\tvisibility\tthree_loop_hz\tbrowser_raf_hz\tthree_frame_ms\traf_frame_ms\tcpu_submit_ms\tgpu_ms\tgpu_timer_supported\tdraw_calls\ttriangles\ttiles\tmoving_tiles\tbatched_static_tiles\tbatched_face_tiles\tface_batches\tpixel_ratio',
    ],
  };
  document.body.classList.add('perf-capture-active');
  updatePerformanceCaptureUi();
  setStatus('Performance capture started. You can close Dev; logging continues.');
}

function stopPerformanceCapture(): void {
  const capture = performanceCapture;
  if (!capture) return;
  const ended = new Date();
  capture.lines.push('', `END\t${ended.toISOString()}\tduration_s=${((performance.now() - capture.startedAt) / 1000).toFixed(3)}\tsamples=${capture.samples}`);
  const blob = new Blob([`${capture.lines.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = capture.startedIso.replace(/[:.]/g, '-');
  link.href = url;
  link.download = `mahjonglive-performance-${stamp}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  performanceCapture = null;
  document.body.classList.remove('perf-capture-active');
  updatePerformanceCaptureUi();
  setStatus(`Performance log saved (${capture.samples} samples).`);
}

function applyDomPreview(): void {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--dev-player-card-scale', String(settings.ui.playerCardScale));
  rootStyle.setProperty('--dev-player-inset-tb', `${settings.ui.playerInsetTB}px`);
  rootStyle.setProperty('--dev-player-inset-sides', `${settings.ui.playerInsetSides}px`);
  rootStyle.setProperty('--dev-dora-scale', String(settings.ui.doraScale));
  rootStyle.setProperty('--dev-dora-x', `${settings.ui.doraX}px`);
  rootStyle.setProperty('--dev-dora-y', `${settings.ui.doraY}px`);
  rootStyle.setProperty('--dev-center-scale', String(settings.ui.centerScale));
  rootStyle.setProperty('--dev-center-offset-x', `${settings.ui.centerOffsetX}px`);
  rootStyle.setProperty('--dev-center-offset-y', `${settings.ui.centerOffsetY}px`);
  rootStyle.setProperty('--dev-center-width', `${settings.ui.centerWidth}px`);
  rootStyle.setProperty('--dev-center-height', `${settings.ui.centerHeight}px`);
  rootStyle.setProperty('--dev-reaction-scale', String(settings.ui.reactionScale));
  rootStyle.setProperty('--dev-game-log-width', `${settings.ui.gameLogWidth}px`);
  rootStyle.setProperty('--dev-scene-bg', settings.sceneColor);
  rootStyle.setProperty('--dev-tile-label-scale', String(settings.ui.tileLabelScale));
  rootStyle.setProperty('--dev-tile-label-x', `${settings.ui.tileLabelX}px`);
  rootStyle.setProperty('--dev-tile-label-y', `${settings.ui.tileLabelY}px`);
  rootStyle.setProperty('--dev-dora-label-scale', String(settings.ui.doraLabelScale));
  rootStyle.setProperty('--dev-dora-label-x', `${settings.ui.doraLabelX}px`);
  rootStyle.setProperty('--dev-dora-label-y', `${settings.ui.doraLabelY}px`);
  rootStyle.setProperty('--dev-center-score-scale', String(settings.ui.centerScoreScale));

  document.querySelectorAll<HTMLElement>('.mahjong-table').forEach((table) => {
    // In 3D the uploaded image belongs only to the felt mesh. Never paint it onto the whole
    // DOM table container, otherwise it visually spills into the frame/background around the mesh.
    if (table.classList.contains('table-3d-active')) {
      table.style.backgroundImage = 'none';
      table.style.backgroundSize = '';
      table.style.backgroundPosition = '';
      table.style.backgroundColor = '';
      return;
    }
    table.style.backgroundColor = settings.tableColor;
    table.style.backgroundImage = settings.tableImage ? `url("${settings.tableImage}")` : 'none';
    table.style.backgroundSize = settings.tableImage ? 'cover' : '';
    table.style.backgroundPosition = settings.tableImage ? 'center' : '';
  });
  document.querySelectorAll<HTMLElement>('.tile-back').forEach((tile) => {
    tile.style.background = settings.backColor;
  });
}

function numberSlider(
  parent: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  get: () => number,
  set: (value: number) => void,
  suffix = '',
  defaultValue = get(),
): void {
  const row = document.createElement('div');
  row.className = 'dev-tuning-control';
  const name = document.createElement('label');
  name.textContent = label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);

  const numeric = document.createElement('input');
  numeric.type = 'number';
  numeric.min = String(min);
  numeric.max = String(max);
  numeric.step = String(step);
  numeric.className = 'dev-tuning-number';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'dev-tuning-reset';
  reset.textContent = '↺';
  reset.title = `Reset ${label} to ${defaultValue}${suffix}`;

  const format = (value: number) => step < 1 ? value.toFixed(2) : String(Math.round(value));
  const sync = (value: number) => {
    slider.value = String(value);
    numeric.value = format(value);
    numeric.title = suffix ? `${format(value)}${suffix}` : format(value);
  };
  const commit = (value: number) => {
    if (!Number.isFinite(value)) return;
    const bounded = Math.max(min, Math.min(max, value));
    set(bounded);
    sync(bounded);
    saveAndBroadcast();
  };

  sync(get());
  slider.addEventListener('input', () => commit(Number(slider.value)));
  numeric.addEventListener('change', () => commit(Number(numeric.value)));
  numeric.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit(Number(numeric.value));
  });
  reset.addEventListener('click', () => commit(defaultValue));

  row.append(name, slider, numeric, reset);
  parent.append(row);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '').padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) || 0) as [number, number, number];
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function rgbToHsv(rgb: [number, number, number]): [number, number, number] {
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

async function optimizedBackImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 768;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create image canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', .82);
  } finally {
    bitmap.close?.();
  }
}

async function optimizedTableImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create image canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', .78);
  } finally {
    bitmap.close?.();
  }
}

function rotationSection(parent: HTMLElement, title: string, target: Rotation, defaults: Rotation): void {
  const section = document.createElement('section');
  section.className = 'dev-tuning-section';
  section.innerHTML = `<h3>${title}</h3>`;
  numberSlider(section, 'Rotate X', -180, 180, 1, () => target.x, (v) => { target.x = v; }, '°', defaults.x);
  numberSlider(section, 'Rotate Y', -180, 180, 1, () => target.y, (v) => { target.y = v; }, '°', defaults.y);
  numberSlider(section, 'Rotate Z', -180, 180, 1, () => target.z, (v) => { target.z = v; }, '°', defaults.z);
  parent.append(section);
}

function buildPanel(): HTMLElement {
  const root = document.createElement('aside');
  root.className = 'dev-tuning-panel';
  root.hidden = true;
  root.innerHTML = `
    <div class="dev-tuning-head">
      <strong>3D Dev Tuning</strong>
      <span class="dev-fps-value">FPS --</span>
      <span>F2</span>
      <button type="button" class="dev-tuning-close">×</button>
    </div>
  `;

  const camera = document.createElement('section');
  camera.className = 'dev-tuning-section';
  camera.innerHTML = '<h3>Camera</h3>';
  numberSlider(camera, 'Position X', -20, 20, .05, () => settings.camera.x, (v) => { settings.camera.x = v; }, '', DEFAULTS.camera.x);
  numberSlider(camera, 'Position Y', .5, 20, .05, () => settings.camera.y, (v) => { settings.camera.y = v; }, '', DEFAULTS.camera.y);
  numberSlider(camera, 'Position Z', -20, 25, .05, () => settings.camera.z, (v) => { settings.camera.z = v; }, '', DEFAULTS.camera.z);
  numberSlider(camera, 'Target X', -6, 6, .05, () => settings.camera.targetX, (v) => { settings.camera.targetX = v; }, '', DEFAULTS.camera.targetX);
  numberSlider(camera, 'Target Y', -2, 5, .05, () => settings.camera.targetY, (v) => { settings.camera.targetY = v; }, '', DEFAULTS.camera.targetY);
  numberSlider(camera, 'Target Z', -6, 6, .05, () => settings.camera.targetZ, (v) => { settings.camera.targetZ = v; }, '', DEFAULTS.camera.targetZ);
  numberSlider(camera, 'FOV', 20, 70, 1, () => settings.camera.fov, (v) => { settings.camera.fov = v; }, '°', DEFAULTS.camera.fov);
  root.append(camera);

  const graphics = document.createElement('section');
  graphics.className = 'dev-tuning-section';
  graphics.innerHTML = '<h3>Performance & graphics</h3>';
  numberSlider(graphics, 'Pixel ratio', .75, 2.00, .05, () => settings.graphics.pixelRatio, (v) => { settings.graphics.pixelRatio = v; }, '×', DEFAULTS.graphics.pixelRatio);
  numberSlider(graphics, 'Shadow quality', 0, 3, 1, () => settings.graphics.shadowQuality, (v) => { settings.graphics.shadowQuality = v; }, '', DEFAULTS.graphics.shadowQuality);
  numberSlider(graphics, 'Texture filtering', 1, 8, 1, () => settings.graphics.anisotropy, (v) => { settings.graphics.anisotropy = v; }, '×', DEFAULTS.graphics.anisotropy);
  const stressActions = document.createElement('div');
  stressActions.className = 'dev-tuning-actions dev-stress-actions';
  const stressButton = document.createElement('button');
  stressButton.type = 'button';
  stressButton.className = 'dev-tuning-action perf-stress-fill';
  stressButton.textContent = stressDiscardsActive ? 'Clear simulated discards' : 'Fill table with discards';
  stressButton.addEventListener('click', () => {
    stressDiscardsActive = !stressDiscardsActive;
    stressButton.textContent = stressDiscardsActive ? 'Clear simulated discards' : 'Fill table with discards';
    window.dispatchEvent(new CustomEvent('mahjong-live:dev-stress-discards', { detail: { enabled: stressDiscardsActive } }));
    setStatus(stressDiscardsActive ? 'Filled every river to 24 tiles for a visual performance stress test.' : 'Simulated discards cleared.');
  });
  stressActions.append(stressButton);
  graphics.append(stressActions);
  const perfLog = document.createElement('div');
  perfLog.className = 'perf-log-controls';
  const perfStart = document.createElement('button');
  perfStart.type = 'button'; perfStart.className = 'dev-tuning-action perf-log-start'; perfStart.textContent = 'Start performance log';
  const perfStop = document.createElement('button');
  perfStop.type = 'button'; perfStop.className = 'dev-tuning-action perf-log-stop'; perfStop.textContent = 'Stop & save .txt';
  const perfState = document.createElement('span');
  perfState.className = 'perf-log-state';
  perfStart.addEventListener('click', startPerformanceCapture);
  perfStop.addEventListener('click', stopPerformanceCapture);
  perfLog.append(perfStart, perfStop, perfState);
  graphics.append(perfLog);
  graphics.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Diagnostics now compare the Three.js loop with an independent browser RAF probe and, when EXT_disjoint_timer_query_webgl2 is available, real GPU execution time. Settled non-selectable bodies/shells/backs are instanced, printed fronts are additionally instanced by tile design, and shadow maps are cached between movements. The stress test should now expose whether remaining cost is geometry/driver rather than per-tile draw calls. Start performance log records one tab-separated sample per diagnostic interval until Stop & save .txt; logging continues even if the Dev panel is closed.</p>');
  root.append(graphics);
  requestAnimationFrame(updatePerformanceCaptureUi);

  rotationSection(root, 'Left opponent tiles', settings.left, DEFAULTS.left);
  rotationSection(root, 'Right opponent tiles', settings.right, DEFAULTS.right);
  rotationSection(root, 'Top opponent tiles', settings.top, DEFAULTS.top);
  rotationSection(root, 'Your tiles', settings.bottom, DEFAULTS.bottom);

  const tileSection = document.createElement('section');
  tileSection.className = 'dev-tuning-section';
  tileSection.innerHTML = '<h3>Tiles & front material</h3>';
  colorControl(tileSection, 'Body RGB', () => settings.tiles.bodyColor, (v) => { settings.tiles.bodyColor = v; }, DEFAULTS.tiles.bodyColor);
  colorControl(tileSection, 'Front tint', () => settings.tiles.faceTint, (v) => { settings.tiles.faceTint = v; }, DEFAULTS.tiles.faceTint);
  numberSlider(tileSection, 'Body roughness', .10, 1.00, .01, () => settings.tiles.bodyRoughness, (v) => { settings.tiles.bodyRoughness = v; }, '', DEFAULTS.tiles.bodyRoughness);
  numberSlider(tileSection, 'Front offset', -.30, .30, .002, () => settings.tiles.faceOffset, (v) => { settings.tiles.faceOffset = v; }, '', DEFAULTS.tiles.faceOffset);
  numberSlider(tileSection, 'Front rotate X', -180, 180, 1, () => settings.tiles.faceRotateX, (v) => { settings.tiles.faceRotateX = v; }, '°', DEFAULTS.tiles.faceRotateX);
  numberSlider(tileSection, 'Texture rotate', -180, 180, 1, () => settings.tiles.faceTextureRotation, (v) => { settings.tiles.faceTextureRotation = v; }, '°', DEFAULTS.tiles.faceTextureRotation);
  numberSlider(tileSection, 'Front scale', .50, 1.50, .01, () => settings.tiles.faceScale, (v) => { settings.tiles.faceScale = v; }, '×', DEFAULTS.tiles.faceScale);
  numberSlider(tileSection, 'Your tile size', .60, 1.50, .01, () => settings.tiles.ownScale, (v) => { settings.tiles.ownScale = v; }, '×', DEFAULTS.tiles.ownScale);
  numberSlider(tileSection, 'Opponent size', .60, 1.50, .01, () => settings.tiles.opponentScale, (v) => { settings.tiles.opponentScale = v; }, '×', DEFAULTS.tiles.opponentScale);
  numberSlider(tileSection, 'Discard size', .50, 1.40, .01, () => settings.tiles.riverScale, (v) => { settings.tiles.riverScale = v; }, '×', DEFAULTS.tiles.riverScale);
  numberSlider(tileSection, 'Meld size', .50, 1.40, .01, () => settings.tiles.meldScale, (v) => { settings.tiles.meldScale = v; }, '×', DEFAULTS.tiles.meldScale);
  numberSlider(tileSection, 'Meld gap', .30, .55, .01, () => settings.tiles.meldGap, (v) => { settings.tiles.meldGap = v; }, '', DEFAULTS.tiles.meldGap);
  numberSlider(tileSection, 'Meld row gap', .38, .70, .01, () => settings.tiles.meldRowGap, (v) => { settings.tiles.meldRowGap = v; }, '', DEFAULTS.tiles.meldRowGap);
  numberSlider(tileSection, 'Called tile turn', -180, 180, 1, () => settings.tiles.calledTileRotation, (v) => { settings.tiles.calledTileRotation = v; }, '°', DEFAULTS.tiles.calledTileRotation);
  numberSlider(tileSection, 'Called tile gap', -.30, .30, .01, () => settings.tiles.calledTileGap, (v) => { settings.tiles.calledTileGap = v; }, '', DEFAULTS.tiles.calledTileGap);
  tileSection.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Front UVs are normalized in code; these controls now tune material/plane appearance rather than compensating for broken UV mapping.</p>');
  root.append(tileSection);

  const river = document.createElement('section');
  river.className = 'dev-tuning-section';
  river.innerHTML = '<h3>Discard layout</h3>';
  numberSlider(river, 'Center distance', 1.20, 3.50, .01, () => settings.tiles.riverDepth, (v) => { settings.tiles.riverDepth = v; }, '', DEFAULTS.tiles.riverDepth);
  numberSlider(river, 'Row gap', .20, 1.00, .01, () => settings.tiles.riverRowGap, (v) => { settings.tiles.riverRowGap = v; }, '', DEFAULTS.tiles.riverRowGap);
  numberSlider(river, 'Column gap', .25, .80, .01, () => settings.tiles.riverColumnGap, (v) => { settings.tiles.riverColumnGap = v; }, '', DEFAULTS.tiles.riverColumnGap);
  numberSlider(river, 'Position variation', 0, .10, .002, () => settings.tiles.riverJitter, (v) => { settings.tiles.riverJitter = v; }, '', DEFAULTS.tiles.riverJitter);
  numberSlider(river, 'Yaw variation', 0, 10, .1, () => settings.tiles.riverYawJitter, (v) => { settings.tiles.riverYawJitter = v; }, '°', DEFAULTS.tiles.riverYawJitter);
  numberSlider(river, 'Tilt variation', 0, 4, .1, () => settings.tiles.riverTiltJitter, (v) => { settings.tiles.riverTiltJitter = v; }, '°', DEFAULTS.tiles.riverTiltJitter);
  river.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Rows stay rigid enough to read, while deterministic position/angle variation keeps discards from looking computer-perfect.</p>');
  root.append(river);

  const geometry = document.createElement('section');
  geometry.className = 'dev-tuning-section';
  geometry.innerHTML = '<h3>Table geometry</h3>';
  colorControl(geometry, 'Wood RGB', () => settings.woodColor, (v) => { settings.woodColor = v; }, DEFAULTS.woodColor);
  numberSlider(geometry, 'Frame top Y', -.10, .50, .005, () => settings.tableGeometry.frameTopY, (v) => { settings.tableGeometry.frameTopY = v; }, '', DEFAULTS.tableGeometry.frameTopY);
  numberSlider(geometry, 'Felt top Y', -.10, .40, .005, () => settings.tableGeometry.feltTopY, (v) => { settings.tableGeometry.feltTopY = v; }, '', DEFAULTS.tableGeometry.feltTopY);
  numberSlider(geometry, 'Frame width', .15, .85, .01, () => settings.tableGeometry.frameWidth, (v) => { settings.tableGeometry.frameWidth = v; }, '', DEFAULTS.tableGeometry.frameWidth);
  numberSlider(geometry, 'Frame thickness', .10, .70, .01, () => settings.tableGeometry.frameThickness, (v) => { settings.tableGeometry.frameThickness = v; }, '', DEFAULTS.tableGeometry.frameThickness);
  numberSlider(geometry, 'Felt thickness', .03, .30, .01, () => settings.tableGeometry.feltThickness, (v) => { settings.tableGeometry.feltThickness = v; }, '', DEFAULTS.tableGeometry.feltThickness);
  geometry.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Wood is now four physical rails plus a lower underlay; felt is a separate inset slab, so changing height cannot make one full box swallow the other.</p>');
  root.append(geometry);

  const ui = document.createElement('section');
  ui.className = 'dev-tuning-section';
  ui.innerHTML = '<h3>UI overlays</h3>';
  numberSlider(ui, 'Player badges', .50, 2.00, .01, () => settings.ui.playerCardScale, (v) => { settings.ui.playerCardScale = v; }, '×', DEFAULTS.ui.playerCardScale);
  numberSlider(ui, 'Top/bottom inset', 0, 100, 1, () => settings.ui.playerInsetTB, (v) => { settings.ui.playerInsetTB = v; }, 'px', DEFAULTS.ui.playerInsetTB);
  numberSlider(ui, 'Side inset', 0, 100, 1, () => settings.ui.playerInsetSides, (v) => { settings.ui.playerInsetSides = v; }, 'px', DEFAULTS.ui.playerInsetSides);
  numberSlider(ui, 'Dora window', .50, 2.50, .01, () => settings.ui.doraScale, (v) => { settings.ui.doraScale = v; }, '×', DEFAULTS.ui.doraScale);
  numberSlider(ui, 'Dora X', 0, 300, 1, () => settings.ui.doraX, (v) => { settings.ui.doraX = v; }, 'px', DEFAULTS.ui.doraX);
  numberSlider(ui, 'Dora Y', 0, 250, 1, () => settings.ui.doraY, (v) => { settings.ui.doraY = v; }, 'px', DEFAULTS.ui.doraY);
  numberSlider(ui, 'Center scale', .50, 2.00, .01, () => settings.ui.centerScale, (v) => { settings.ui.centerScale = v; }, '×', DEFAULTS.ui.centerScale);
  numberSlider(ui, 'Center X offset', -300, 300, 1, () => settings.ui.centerOffsetX, (v) => { settings.ui.centerOffsetX = v; }, 'px', DEFAULTS.ui.centerOffsetX);
  numberSlider(ui, 'Center Y offset', -250, 250, 1, () => settings.ui.centerOffsetY, (v) => { settings.ui.centerOffsetY = v; }, 'px', DEFAULTS.ui.centerOffsetY);
  numberSlider(ui, 'Center width', 150, 420, 1, () => settings.ui.centerWidth, (v) => { settings.ui.centerWidth = v; }, 'px', DEFAULTS.ui.centerWidth);
  numberSlider(ui, 'Center height', 150, 420, 1, () => settings.ui.centerHeight, (v) => { settings.ui.centerHeight = v; }, 'px', DEFAULTS.ui.centerHeight);
  numberSlider(ui, 'Reaction popup', .50, 2.00, .01, () => settings.ui.reactionScale, (v) => { settings.ui.reactionScale = v; }, '×', DEFAULTS.ui.reactionScale);
  numberSlider(ui, 'Tile label size', .40, 1.60, .01, () => settings.ui.tileLabelScale, (v) => { settings.ui.tileLabelScale = v; }, '×', DEFAULTS.ui.tileLabelScale);
  numberSlider(ui, 'Tile label X', -24, 24, 1, () => settings.ui.tileLabelX, (v) => { settings.ui.tileLabelX = v; }, 'px', DEFAULTS.ui.tileLabelX);
  numberSlider(ui, 'Tile label Y', -24, 24, 1, () => settings.ui.tileLabelY, (v) => { settings.ui.tileLabelY = v; }, 'px', DEFAULTS.ui.tileLabelY);
  numberSlider(ui, 'Dora label size', .35, 1.40, .01, () => settings.ui.doraLabelScale, (v) => { settings.ui.doraLabelScale = v; }, '×', DEFAULTS.ui.doraLabelScale);
  numberSlider(ui, 'Dora label X', -24, 24, 1, () => settings.ui.doraLabelX, (v) => { settings.ui.doraLabelX = v; }, 'px', DEFAULTS.ui.doraLabelX);
  numberSlider(ui, 'Dora label Y', -24, 24, 1, () => settings.ui.doraLabelY, (v) => { settings.ui.doraLabelY = v; }, 'px', DEFAULTS.ui.doraLabelY);
  numberSlider(ui, 'Center score plaques', .60, 2.00, .01, () => settings.ui.centerScoreScale, (v) => { settings.ui.centerScoreScale = v; }, '×', DEFAULTS.ui.centerScoreScale);
  numberSlider(ui, 'Game log width', 180, 600, 1, () => settings.ui.gameLogWidth, (v) => { settings.ui.gameLogWidth = v; }, 'px', DEFAULTS.ui.gameLogWidth);
  ui.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Center X/Y are offsets from the projected 3D world center, not from the browser viewport center.</p>');
  root.append(ui);

  const sceneSection = document.createElement('section');
  sceneSection.className = 'dev-tuning-section';
  sceneSection.innerHTML = '<h3>Scene background</h3>';
  const scenePresetRow = document.createElement('div');
  scenePresetRow.className = 'dev-tuning-presets';
  const scenePresetLabel = document.createElement('label'); scenePresetLabel.textContent = 'Background';
  const scenePreset = document.createElement('select');
  const scenePresets: [string, string][] = [
    ['Deep green', '#071b13'], ['Charcoal', '#111513'], ['Midnight', '#101825'],
    ['Burgundy', '#251317'], ['Warm dark', '#211a14'], ['Custom RGB', ''],
  ];
  scenePresets.forEach(([name, value]) => {
    const option = document.createElement('option'); option.textContent = name; option.value = value; scenePreset.append(option);
  });
  scenePreset.value = scenePresets.find(([, value]) => value === settings.sceneColor)?.[1] ?? '';
  scenePreset.addEventListener('change', () => {
    if (!scenePreset.value) return;
    settings.sceneColor = scenePreset.value;
    saveAndBroadcast('Scene background: ' + (scenePreset.selectedOptions[0]?.textContent ?? ''));
  });
  scenePresetRow.append(scenePresetLabel, scenePreset);
  sceneSection.append(scenePresetRow);
  colorControl(sceneSection, 'Background RGB', () => settings.sceneColor, (v) => { settings.sceneColor = v; scenePreset.value = ''; }, DEFAULTS.sceneColor);
  root.append(sceneSection);

  const surfaces = document.createElement('section');
  surfaces.className = 'dev-tuning-section dev-back-section';
  surfaces.innerHTML = '<h3>Felt & tile backs</h3><div class="dev-back-preview-card"><div class="dev-back-preview-shell"><div class="dev-back-preview"></div></div><span>Back preview</span></div>';
  colorControl(surfaces, 'Felt RGB', () => settings.tableColor, (v) => { settings.tableColor = v; }, DEFAULTS.tableColor);

  const fileRow = document.createElement('div');
  fileRow.className = 'dev-tuning-file';
  const fileLabel = document.createElement('label');
  fileLabel.textContent = 'Table image';
  const file = document.createElement('input');
  file.type = 'file'; file.accept = 'image/*';
  const clear = document.createElement('button');
  clear.type = 'button'; clear.className = 'dev-tuning-action'; clear.textContent = 'Clear';
  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > 12_000_000) {
      setStatus('Image is over 12 MB. Choose a smaller source image.');
      file.value = '';
      return;
    }
    setStatus(`Optimizing ${selected.name} for the 3D felt…`);
    try {
      settings.tableImage = await optimizedTableImage(selected);
      saveAndBroadcast(`Loaded optimized texture: ${selected.name}`);
    } catch {
      setStatus('Could not decode/optimize that image.');
      file.value = '';
    }
  });
  clear.addEventListener('click', () => {
    settings.tableImage = null;
    file.value = '';
    saveAndBroadcast('Table image cleared.');
  });
  fileRow.append(fileLabel, file, clear);
  surfaces.append(fileRow);

  const presetRow = document.createElement('div');
  presetRow.className = 'dev-tuning-presets';
  const presetLabel = document.createElement('label'); presetLabel.textContent = 'Back preset';
  const preset = document.createElement('select');
  const presets: [string, string][] = [
    ['Custom RGB', ''], ['Jade', '#315c49'], ['Mint', '#31b77b'], ['Teal', '#246f74'],
    ['Blue', '#315f91'], ['Burgundy', '#7d3445'], ['Black', '#252a27'], ['Ivory', '#d8cfb6'],
  ];
  presets.forEach(([name, value]) => {
    const option = document.createElement('option'); option.textContent = name; option.value = value; preset.append(option);
  });
  preset.addEventListener('change', () => {
    if (!preset.value) return;
    settings.backColor = preset.value;
    saveAndBroadcast(`Back preset: ${preset.selectedOptions[0]?.textContent ?? ''}`);
    root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false; syncDevOpenClass();
  });
  presetRow.append(presetLabel, preset);
  surfaces.append(presetRow);
  colorControl(surfaces, 'Back RGB', () => settings.backColor, (v) => { settings.backColor = v; preset.value = ''; }, DEFAULTS.backColor);

  const patternRow = document.createElement('div');
  patternRow.className = 'dev-tuning-presets';
  const patternLabel = document.createElement('label'); patternLabel.textContent = 'Back texture';
  const pattern = document.createElement('select');
  const patterns: [string, string][] = [
    ['Fine ribs', 'ribbed'], ['Woven', 'woven'], ['Diamonds', 'diamond'],
    ['Soft waves', 'waves'], ['Classic lattice', 'classic'], ['Solid', 'solid'], ['Custom image', 'custom'],
  ];
  patterns.forEach(([name, value]) => {
    const option = document.createElement('option'); option.textContent = name; option.value = value; pattern.append(option);
  });
  pattern.value = patterns.some(([, value]) => value === settings.backPattern) ? settings.backPattern : 'ribbed';
  pattern.addEventListener('change', () => {
    settings.backPattern = pattern.value;
    saveAndBroadcast(`Back texture: ${pattern.selectedOptions[0]?.textContent ?? ''}`);
  });
  patternRow.append(patternLabel, pattern);
  surfaces.append(patternRow);
  numberSlider(surfaces, 'Pattern strength', 0, 1, .01, () => settings.backPatternStrength, (v) => { settings.backPatternStrength = v; }, '', DEFAULTS.backPatternStrength);

  const backFileRow = document.createElement('div');
  backFileRow.className = 'dev-tuning-file';
  const backFileLabel = document.createElement('label'); backFileLabel.textContent = 'Back image';
  const backFile = document.createElement('input'); backFile.type = 'file'; backFile.accept = 'image/*';
  const backClear = document.createElement('button'); backClear.type = 'button'; backClear.className = 'dev-tuning-action'; backClear.textContent = 'Clear';
  backFile.addEventListener('change', async () => {
    const selected = backFile.files?.[0];
    if (!selected) return;
    if (selected.size > 8_000_000) { setStatus('Back image is over 8 MB.'); backFile.value = ''; return; }
    setStatus(`Optimizing ${selected.name} for tile backs…`);
    try {
      settings.backImage = await optimizedBackImage(selected);
      settings.backPattern = 'custom';
      saveAndBroadcast(`Loaded back texture: ${selected.name}`);
      root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false; syncDevOpenClass();
    } catch {
      setStatus('Could not decode/optimize that back image.');
      backFile.value = '';
    }
  });
  backClear.addEventListener('click', () => {
    settings.backImage = null;
    if (settings.backPattern === 'custom') settings.backPattern = DEFAULTS.backPattern;
    backFile.value = '';
    saveAndBroadcast('Custom back image cleared.');
    root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false; syncDevOpenClass();
  });
  backFileRow.append(backFileLabel, backFile, backClear);
  surfaces.append(backFileRow);
  surfaces.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Patterns are generated at runtime and tinted by Back RGB. Custom images are optimized before being stored.</p>');
  root.append(surfaces);
  requestAnimationFrame(updateBackPreview);

  const actions = document.createElement('div');
  actions.className = 'dev-tuning-actions';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'dev-tuning-action'; reset.textContent = 'Reset defaults';
  reset.addEventListener('click', () => {
    settings = structuredClone(DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
    saveAndBroadcast('Defaults restored.');
    root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false; syncDevOpenClass();
  });
  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'dev-tuning-action'; copy.textContent = 'Copy JSON';
  copy.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(JSON.stringify(settings, null, 2));
    setStatus('Settings JSON copied.');
  });
  actions.append(reset, copy);
  root.append(actions);
  const status = document.createElement('div'); status.className = 'dev-tuning-status'; root.append(status);
  root.querySelector<HTMLButtonElement>('.dev-tuning-close')?.addEventListener('click', () => { root.hidden = true; document.body.classList.remove('dev-tuning-open'); });
  return root;
}

function ensureUi(): void {
  const actions = document.querySelector<HTMLElement>('.header-actions');
  if (!actions) return;
  if (!panel) { panel = buildPanel(); document.body.append(panel); }
  if (!actions.querySelector('.dev-tuning-toggle')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'header-button dev-tuning-toggle';
    button.textContent = 'Dev';
    button.title = 'Open 3D camera/tile tuning (F2)';
    button.addEventListener('click', () => { if (panel) { panel.hidden = !panel.hidden; syncDevOpenClass(); } });
    actions.append(button);
  }
  applyDomPreview();
}

const observer = new MutationObserver(ensureUi);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('keydown', (event) => {
  if (event.key !== 'F2') return;
  event.preventDefault();
  ensureUi();
  if (panel) { panel.hidden = !panel.hidden; syncDevOpenClass(); }
});
window.addEventListener('mahjong-live:fps', (event) => {
  const detail = (event as CustomEvent<PerformanceDetail>).detail;
  if (!detail) return;
  lastPerformanceDetail = detail;
  appendPerformanceSample(detail);
  const target = panel?.querySelector<HTMLElement>('.dev-fps-value');
  if (!target) return;
  const loopHz = Number.isFinite(detail.loopHz ?? detail.fps) ? Math.round(detail.loopHz ?? detail.fps ?? 0) : 0;
  const rafHz = Number.isFinite(detail.rafHz) ? Math.round(detail.rafHz ?? 0) : 0;
  const gpuMs = Number.isFinite(detail.gpuMs) ? `${(detail.gpuMs ?? 0).toFixed(2)}ms GPU` : 'GPU n/a';
  target.textContent = `Loop ${loopHz} · RAF ${rafHz} · ${gpuMs} · ${detail.calls ?? 0} calls · ${detail.actors ?? 0} tiles`;
  target.title = `${(detail.frameMs ?? 0).toFixed(2)}ms Three frame · ${(detail.rafFrameMs ?? 0).toFixed(2)}ms RAF frame · ${(detail.renderMs ?? 0).toFixed(2)}ms CPU submit · ${detail.triangles ?? 0} triangles · ${detail.moving ?? 0} moving · ${detail.instancedRivers ?? 0} batched static · ${detail.batchedFaces ?? 0} batched faces in ${detail.faceBatches ?? 0} face draws · ${(detail.pixelRatio ?? 1).toFixed(2)}× pixel ratio · ${detail.visibility ?? document.visibilityState}`;
  target.classList.toggle('fps-low', loopHz > 0 && loopHz < 55);
});
ensureUi();
syncDevOpenClass();
saveAndBroadcast();
