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
  };
  tableColor: string;
  tableImage: string | null;
  woodColor: string;
  backColor: string;
};

const DEFAULTS: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },
  tiles: {
    faceOffset: .128,
    faceRotateX: -90,
    faceScale: 1,
    faceTextureRotation: 0,
    bodyColor: '#fffdf5',
    bodyRoughness: .46,
    faceTint: '#ffffff',
    ownScale: 1,
    opponentScale: 1,
    riverScale: 1,
    meldScale: 1,
    riverDepth: 2.05,
    riverRowGap: .55,
    riverColumnGap: .48,
  },
  tableGeometry: { frameTopY: .25, feltTopY: .11, frameWidth: .39, frameThickness: .34, feltThickness: .10 },
  ui: {
    playerCardScale: 1,
    playerInsetTB: 10,
    playerInsetSides: 10,
    doraScale: 1,
    doraX: 24,
    doraY: 24,
    centerScale: 1,
    centerOffsetX: 0,
    centerOffsetY: 0,
    centerWidth: 242,
    centerHeight: 242,
    reactionScale: 1,
    gameLogWidth: 290,
  },
  tableColor: '#174a36',
  tableImage: null,
  woodColor: '#3a2b20',
  backColor: '#315c49',
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
    },
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULTS.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
    woodColor: typeof raw.woodColor === 'string' ? raw.woodColor : DEFAULTS.woodColor,
    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,
  };
}

let settings = loadSettings();
let panel: HTMLElement | null = null;

function saveAndBroadcast(message = ''): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    setStatus('Could not persist settings — the uploaded image may be too large.');
  }
  applyDomPreview();
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: settings }));
  if (message) setStatus(message);
}

function setStatus(text: string): void {
  const status = panel?.querySelector<HTMLElement>('.dev-tuning-status');
  if (status) status.textContent = text;
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

function colorControl(
  parent: HTMLElement,
  label: string,
  get: () => string,
  set: (value: string) => void,
  defaultValue: string,
): void {
  const row = document.createElement('div');
  row.className = 'dev-tuning-color';
  const name = document.createElement('label');
  name.textContent = label;
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = get();
  const nums = [0, 1, 2].map(() => {
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.max = '255'; input.step = '1';
    return input;
  });
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'dev-tuning-reset';
  reset.textContent = '↺';
  reset.title = `Reset ${label}`;
  const syncNums = () => {
    const rgb = hexToRgb(picker.value);
    nums.forEach((input, index) => { input.value = String(rgb[index]); });
  };
  const commit = (value: string) => {
    picker.value = value;
    set(value);
    syncNums();
    saveAndBroadcast();
  };
  syncNums();
  picker.addEventListener('input', () => commit(picker.value));
  nums.forEach((input) => input.addEventListener('change', () => {
    commit(rgbToHex(Number(nums[0].value), Number(nums[1].value), Number(nums[2].value)));
  }));
  reset.addEventListener('click', () => commit(defaultValue));
  row.append(name, picker, ...nums, reset);
  parent.append(row);
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
  tileSection.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Front UVs are normalized in code; these controls now tune material/plane appearance rather than compensating for broken UV mapping.</p>');
  root.append(tileSection);

  const river = document.createElement('section');
  river.className = 'dev-tuning-section';
  river.innerHTML = '<h3>Discard layout</h3>';
  numberSlider(river, 'Center distance', 1.20, 3.50, .01, () => settings.tiles.riverDepth, (v) => { settings.tiles.riverDepth = v; }, '', DEFAULTS.tiles.riverDepth);
  numberSlider(river, 'Row gap', .20, 1.00, .01, () => settings.tiles.riverRowGap, (v) => { settings.tiles.riverRowGap = v; }, '', DEFAULTS.tiles.riverRowGap);
  numberSlider(river, 'Column gap', .25, .80, .01, () => settings.tiles.riverColumnGap, (v) => { settings.tiles.riverColumnGap = v; }, '', DEFAULTS.tiles.riverColumnGap);
  river.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Discards are laid out around world-space center (0,0); the DOM center counter is projected onto that same point.</p>');
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
  numberSlider(ui, 'Game log width', 180, 600, 1, () => settings.ui.gameLogWidth, (v) => { settings.ui.gameLogWidth = v; }, 'px', DEFAULTS.ui.gameLogWidth);
  ui.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Center X/Y are offsets from the projected 3D world center, not from the browser viewport center.</p>');
  root.append(ui);

  const surfaces = document.createElement('section');
  surfaces.className = 'dev-tuning-section';
  surfaces.innerHTML = '<h3>Felt & tile backs</h3>';
  colorControl(surfaces, 'Felt RGB', () => settings.tableColor, (v) => { settings.tableColor = v; }, DEFAULTS.tableColor);

  const fileRow = document.createElement('div');
  fileRow.className = 'dev-tuning-file';
  const fileLabel = document.createElement('label');
  fileLabel.textContent = 'Table image';
  const file = document.createElement('input');
  file.type = 'file'; file.accept = 'image/*';
  const clear = document.createElement('button');
  clear.type = 'button'; clear.className = 'dev-tuning-action'; clear.textContent = 'Clear';
  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > 3_000_000) {
      setStatus('Image is over 3 MB. Use a smaller texture for localStorage.');
      file.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      settings.tableImage = typeof reader.result === 'string' ? reader.result : null;
      saveAndBroadcast(`Loaded ${selected.name}`);
    };
    reader.readAsDataURL(selected);
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
    root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false;
  });
  presetRow.append(presetLabel, preset);
  surfaces.append(presetRow);
  colorControl(surfaces, 'Back RGB', () => settings.backColor, (v) => { settings.backColor = v; preset.value = ''; }, DEFAULTS.backColor);
  surfaces.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">The colored back is a physical cap around the rear face; the pattern itself stays slightly inset.</p>');
  root.append(surfaces);

  const actions = document.createElement('div');
  actions.className = 'dev-tuning-actions';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'dev-tuning-action'; reset.textContent = 'Reset defaults';
  reset.addEventListener('click', () => {
    settings = structuredClone(DEFAULTS);
    localStorage.removeItem(STORAGE_KEY);
    saveAndBroadcast('Defaults restored.');
    root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false;
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
  root.querySelector<HTMLButtonElement>('.dev-tuning-close')?.addEventListener('click', () => { root.hidden = true; });
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
    button.addEventListener('click', () => { if (panel) panel.hidden = !panel.hidden; });
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
  if (panel) panel.hidden = !panel.hidden;
});
ensureUi();
saveAndBroadcast();
