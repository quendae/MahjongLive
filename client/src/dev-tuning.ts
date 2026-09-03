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
  tableColor: string;
  tableImage: string | null;
  backColor: string;
};

const DEFAULTS: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },
  tableColor: '#174a36',
  tableImage: null,
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
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULTS.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
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

  const surfaces = document.createElement('section');
  surfaces.className = 'dev-tuning-section';
  surfaces.innerHTML = '<h3>Table & tile backs</h3>';
  colorControl(surfaces, 'Table RGB', () => settings.tableColor, (v) => { settings.tableColor = v; }, DEFAULTS.tableColor);

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
