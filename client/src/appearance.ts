import './appearance.css';
import './table-2d.css';

const DEV_TUNING_KEY = 'mahjong-live:dev-tuning:v1';
const DEV_TUNING_EVENT = 'mahjong-live:dev-tuning';
const APPEARANCE_KEY = 'mahjong-live:appearance:v1';

type BackPattern = 'ribbed' | 'woven' | 'diamond' | 'waves' | 'classic' | 'solid' | 'custom';

type AppearanceSettings = {
  sceneColor: string;
  tableColor: string;
  woodColor: string;
  tileColor: string;
  backColor: string;
  backPattern: BackPattern;
  backPatternStrength: number;
  tableImage: string | null;
  backImage: string | null;
};

type ColorKey = 'sceneColor' | 'tableColor' | 'woodColor' | 'tileColor' | 'backColor';

type AppearancePreset = {
  label: string;
  copy: string;
  values: Pick<AppearanceSettings, 'sceneColor' | 'tableColor' | 'woodColor' | 'tileColor' | 'backColor' | 'backPattern' | 'backPatternStrength'>;
};

const DEFAULTS: AppearanceSettings = {
  sceneColor: '#071b13',
  tableColor: '#370f53',
  woodColor: '#3a2b20',
  tileColor: '#fbfbfb',
  backColor: '#315c49',
  backPattern: 'ribbed',
  backPatternStrength: .48,
  tableImage: null,
  backImage: null,
};

const PRESETS: Record<string, AppearancePreset> = {
  purple: {
    label: 'Royal purple',
    copy: 'The current Mahjong Live look.',
    values: {
      sceneColor: '#071b13', tableColor: '#370f53', woodColor: '#3a2b20', tileColor: '#fbfbfb',
      backColor: '#315c49', backPattern: 'ribbed', backPatternStrength: .48,
    },
  },
  green: {
    label: 'Riichi green',
    copy: 'Traditional dark felt with warm wood.',
    values: {
      sceneColor: '#06110c', tableColor: '#194b37', woodColor: '#493321', tileColor: '#fbf8ef',
      backColor: '#315c49', backPattern: 'woven', backPatternStrength: .38,
    },
  },
  burgundy: {
    label: 'Burgundy',
    copy: 'Warm club-table tones.',
    values: {
      sceneColor: '#150b0d', tableColor: '#5a2032', woodColor: '#4a3022', tileColor: '#fffaf0',
      backColor: '#6b3444', backPattern: 'classic', backPatternStrength: .44,
    },
  },
  midnight: {
    label: 'Midnight',
    copy: 'Cool, low-distraction blue slate.',
    values: {
      sceneColor: '#080d14', tableColor: '#182d43', woodColor: '#302b29', tileColor: '#f7f8f5',
      backColor: '#315f91', backPattern: 'diamond', backPatternStrength: .34,
    },
  },
};

const PATTERNS: readonly BackPattern[] = ['ribbed', 'woven', 'diamond', 'waves', 'classic', 'solid', 'custom'];
const PATTERN_LABELS: Record<BackPattern, string> = {
  ribbed: 'Fine ribs',
  woven: 'Woven',
  diamond: 'Diamonds',
  waves: 'Soft waves',
  classic: 'Classic lattice',
  solid: 'Solid',
  custom: 'Custom image',
};

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asImage(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('data:image/') ? value : null;
}

function asPattern(value: unknown, backImage: string | null): BackPattern {
  if (typeof value === 'string' && PATTERNS.includes(value as BackPattern)) {
    if (value === 'custom' && !backImage) return DEFAULTS.backPattern;
    return value as BackPattern;
  }
  return DEFAULTS.backPattern;
}

function readDevSettings(): any {
  try {
    return JSON.parse(localStorage.getItem(DEV_TUNING_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function sanitizeAppearance(raw: any, fallback: AppearanceSettings = DEFAULTS): AppearanceSettings {
  const backImage = asImage(raw?.backImage) ?? fallback.backImage;
  return {
    sceneColor: isHex(raw?.sceneColor) ? raw.sceneColor.toLowerCase() : fallback.sceneColor,
    tableColor: isHex(raw?.tableColor) ? raw.tableColor.toLowerCase() : fallback.tableColor,
    woodColor: isHex(raw?.woodColor) ? raw.woodColor.toLowerCase() : fallback.woodColor,
    tileColor: isHex(raw?.tileColor) ? raw.tileColor.toLowerCase() : fallback.tileColor,
    backColor: isHex(raw?.backColor) ? raw.backColor.toLowerCase() : fallback.backColor,
    backPattern: asPattern(raw?.backPattern, backImage),
    backPatternStrength: typeof raw?.backPatternStrength === 'number' && Number.isFinite(raw.backPatternStrength)
      ? clamp(raw.backPatternStrength, 0, 1)
      : fallback.backPatternStrength,
    tableImage: asImage(raw?.tableImage) ?? fallback.tableImage,
    backImage,
  };
}

function migrateFromDev(): AppearanceSettings {
  const dev = readDevSettings();
  const migrated = {
    sceneColor: dev?.sceneColor,
    tableColor: dev?.tableColor,
    woodColor: dev?.woodColor,
    tileColor: dev?.tiles?.bodyColor,
    backColor: dev?.backColor,
    backPattern: dev?.backPattern,
    backPatternStrength: dev?.backPatternStrength,
    tableImage: dev?.tableImage,
    backImage: dev?.backImage,
  };
  return sanitizeAppearance(migrated);
}

function loadAppearance(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (raw) return sanitizeAppearance(JSON.parse(raw));
  } catch {
    // Fall through to migration/defaults.
  }
  const migrated = migrateFromDev();
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(migrated)); } catch {}
  return migrated;
}

let appearance = loadAppearance();
let panel: HTMLElement | null = null;
let ensureScheduled = false;
let correctiveBroadcastScheduled = false;

function hexRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbHex(r: number, g: number, b: number): string {
  const part = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = hexRgb(hex);
  return rgbHex(r + amount, g + amount, b + amount);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function cssUrl(data: string | null): string {
  return data ? `url("${data}")` : 'none';
}

function backPatternCss(settings: AppearanceSettings): { image: string; size: string } {
  if (settings.backPattern === 'custom' && settings.backImage) {
    return { image: cssUrl(settings.backImage), size: 'cover' };
  }
  const strength = clamp(settings.backPatternStrength, 0, 1);
  const dark = (alpha: number) => `rgba(4, 12, 8, ${(alpha * strength).toFixed(3)})`;
  const light = (alpha: number) => `rgba(255, 255, 255, ${(alpha * strength).toFixed(3)})`;
  if (settings.backPattern === 'ribbed') {
    return {
      image: `repeating-linear-gradient(90deg, ${dark(.34)} 0 3px, ${light(.22)} 3px 4px, transparent 4px 11px)`,
      size: 'auto',
    };
  }
  if (settings.backPattern === 'woven') {
    return {
      image: `repeating-linear-gradient(45deg, ${dark(.24)} 0 2px, transparent 2px 10px), repeating-linear-gradient(-45deg, ${light(.18)} 0 2px, transparent 2px 12px)`,
      size: 'auto',
    };
  }
  if (settings.backPattern === 'diamond' || settings.backPattern === 'classic') {
    return {
      image: `linear-gradient(45deg, transparent 44%, ${dark(.26)} 45% 55%, transparent 56%), linear-gradient(-45deg, transparent 44%, ${light(.18)} 45% 55%, transparent 56%)`,
      size: settings.backPattern === 'classic' ? '26px 26px' : '20px 20px',
    };
  }
  if (settings.backPattern === 'waves') {
    return {
      image: `repeating-radial-gradient(ellipse at 0 50%, transparent 0 9px, ${dark(.25)} 10px 12px, transparent 13px 22px)`,
      size: '42px 24px',
    };
  }
  return { image: 'none', size: 'auto' };
}

function applyAppearanceToDom(): void {
  const root = document.documentElement;
  const pattern = backPatternCss(appearance);
  root.style.setProperty('--user-scene-color', appearance.sceneColor);
  root.style.setProperty('--user-scene-deep', shade(appearance.sceneColor, -34));
  root.style.setProperty('--user-scene-glow', rgba(shade(appearance.sceneColor, 42), .22));
  root.style.setProperty('--user-felt-color', appearance.tableColor);
  root.style.setProperty('--user-felt-deep', shade(appearance.tableColor, -30));
  root.style.setProperty('--user-felt-line', rgba(shade(appearance.tableColor, 74), .14));
  root.style.setProperty('--user-frame-color', appearance.woodColor);
  root.style.setProperty('--user-frame-dark', shade(appearance.woodColor, -28));
  root.style.setProperty('--user-frame-light', shade(appearance.woodColor, 38));
  root.style.setProperty('--user-tile-color', appearance.tileColor);
  root.style.setProperty('--user-tile-light', shade(appearance.tileColor, 8));
  root.style.setProperty('--user-tile-dark', shade(appearance.tileColor, -28));
  root.style.setProperty('--user-back-color', appearance.backColor);
  root.style.setProperty('--user-back-dark', shade(appearance.backColor, -34));
  root.style.setProperty('--user-back-light', shade(appearance.backColor, 46));
  root.style.setProperty('--user-table-image', cssUrl(appearance.tableImage));
  root.style.setProperty('--user-back-pattern-image', pattern.image);
  root.style.setProperty('--user-back-pattern-size', pattern.size);
  root.dataset.userBackPattern = appearance.backPattern;

  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = appearance.sceneColor;
}

function mergeAppearanceIntoDev(devSource: any): any {
  const dev = devSource && typeof devSource === 'object' ? structuredClone(devSource) : {};
  dev.tiles = dev.tiles && typeof dev.tiles === 'object' ? dev.tiles : {};
  dev.sceneColor = appearance.sceneColor;
  dev.tableColor = appearance.tableColor;
  dev.woodColor = appearance.woodColor;
  dev.tiles.bodyColor = appearance.tileColor;
  dev.tiles.faceTint = appearance.tileColor;
  dev.backColor = appearance.backColor;
  dev.backPattern = appearance.backPattern;
  dev.backPatternStrength = appearance.backPatternStrength;
  dev.tableImage = appearance.tableImage;
  dev.backImage = appearance.backImage;
  return dev;
}

function visualFieldsMatch(dev: any): boolean {
  return dev?.sceneColor === appearance.sceneColor
    && dev?.tableColor === appearance.tableColor
    && dev?.woodColor === appearance.woodColor
    && dev?.tiles?.bodyColor === appearance.tileColor
    && dev?.tiles?.faceTint === appearance.tileColor
    && dev?.backColor === appearance.backColor
    && dev?.backPattern === appearance.backPattern
    && Number(dev?.backPatternStrength) === appearance.backPatternStrength
    && (dev?.tableImage ?? null) === appearance.tableImage
    && (dev?.backImage ?? null) === appearance.backImage;
}

function broadcastMergedDevSettings(): void {
  const merged = mergeAppearanceIntoDev(readDevSettings());
  try { localStorage.setItem(DEV_TUNING_KEY, JSON.stringify(merged)); } catch {}
  window.dispatchEvent(new CustomEvent(DEV_TUNING_EVENT, { detail: merged }));
}

function saveAppearance(message = ''): void {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  } catch {
    setPanelStatus('Could not save appearance. A custom image may be too large.');
    return;
  }
  applyAppearanceToDom();
  broadcastMergedDevSettings();
  updatePanelControls();
  if (message) setPanelStatus(message);
}

function setPanelStatus(message: string): void {
  const target = panel?.querySelector<HTMLElement>('.appearance-status');
  if (target) target.textContent = message;
}

function colorRow(label: string, copy: string, key: ColorKey): string {
  return `
    <label class="appearance-color-row">
      <span><strong>${label}</strong><small>${copy}</small></span>
      <span class="appearance-color-input"><input type="color" data-appearance-color="${key}"><output data-appearance-hex="${key}"></output></span>
    </label>
  `;
}

function buildPanel(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'appearance-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="appearance-dialog" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
      <header class="appearance-head">
        <div><span>Options</span><h2 id="appearance-title">Table appearance</h2></div>
        <button type="button" class="appearance-close" aria-label="Close appearance options">×</button>
      </header>
      <p class="appearance-intro">These settings are personal to this browser and apply to both the fast 2D table and the 3D table.</p>

      <div class="appearance-presets" aria-label="Appearance presets">
        ${Object.entries(PRESETS).map(([key, preset]) => `
          <button type="button" class="appearance-preset" data-appearance-preset="${key}">
            <i style="--preset-felt:${preset.values.tableColor};--preset-back:${preset.values.backColor};--preset-frame:${preset.values.woodColor}"></i>
            <span><strong>${preset.label}</strong><small>${preset.copy}</small></span>
          </button>
        `).join('')}
      </div>

      <div class="appearance-grid">
        <section class="appearance-card">
          <div class="appearance-card-head"><span>Room & table</span><small>Shared by 2D and 3D</small></div>
          ${colorRow('Background', 'Area around the table', 'sceneColor')}
          ${colorRow('Felt', 'Main playing surface', 'tableColor')}
          ${colorRow('Frame', 'Wood / table surround', 'woodColor')}
          <div class="appearance-file-row">
            <span><strong>Felt texture</strong><small>Optional custom image, optimized locally</small></span>
            <div>
              <label class="appearance-file-button">Choose image<input type="file" accept="image/*" data-appearance-file="table"></label>
              <button type="button" class="appearance-mini-button" data-appearance-clear="table">Clear</button>
            </div>
            <em data-appearance-file-state="table"></em>
          </div>
        </section>

        <section class="appearance-card">
          <div class="appearance-card-head"><span>Tiles</span><small>Physical tile + back design</small></div>
          ${colorRow('Tile body', 'Ivory / body material', 'tileColor')}
          ${colorRow('Tile back', 'Back colour for concealed tiles', 'backColor')}
          <label class="appearance-select-row">
            <span><strong>Back texture</strong><small>Pattern is also used by 2D backs</small></span>
            <select data-appearance-pattern>
              ${PATTERNS.map((value) => `<option value="${value}">${PATTERN_LABELS[value]}</option>`).join('')}
            </select>
          </label>
          <label class="appearance-range-row">
            <span><strong>Pattern strength</strong><small data-appearance-strength-value></small></span>
            <input type="range" min="0" max="100" step="1" data-appearance-strength>
          </label>
          <div class="appearance-file-row">
            <span><strong>Custom tile back</strong><small>Replaces the generated pattern</small></span>
            <div>
              <label class="appearance-file-button">Choose image<input type="file" accept="image/*" data-appearance-file="back"></label>
              <button type="button" class="appearance-mini-button" data-appearance-clear="back">Clear</button>
            </div>
            <em data-appearance-file-state="back"></em>
          </div>
        </section>
      </div>

      <footer class="appearance-footer">
        <span class="appearance-status" role="status"></span>
        <button type="button" class="appearance-reset">Reset appearance</button>
        <button type="button" class="appearance-done">Done</button>
      </footer>
    </section>
  `;

  overlay.querySelector<HTMLButtonElement>('.appearance-close')?.addEventListener('click', closePanel);
  overlay.querySelector<HTMLButtonElement>('.appearance-done')?.addEventListener('click', closePanel);
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) closePanel();
  });

  overlay.querySelectorAll<HTMLInputElement>('[data-appearance-color]').forEach((input) => {
    input.addEventListener('input', () => {
      const key = input.dataset.appearanceColor as ColorKey;
      if (!key || !isHex(input.value)) return;
      appearance = { ...appearance, [key]: input.value.toLowerCase() };
      saveAppearance();
    });
  });

  overlay.querySelectorAll<HTMLButtonElement>('[data-appearance-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = PRESETS[button.dataset.appearancePreset ?? ''];
      if (!preset) return;
      appearance = {
        ...appearance,
        ...preset.values,
        tableImage: null,
        backImage: null,
      };
      saveAppearance(`${preset.label} applied.`);
    });
  });

  overlay.querySelector<HTMLSelectElement>('[data-appearance-pattern]')?.addEventListener('change', (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value as BackPattern;
    if (!PATTERNS.includes(value)) return;
    if (value === 'custom' && !appearance.backImage) {
      setPanelStatus('Choose a custom tile-back image first.');
      updatePanelControls();
      return;
    }
    appearance = { ...appearance, backPattern: value };
    saveAppearance();
  });

  overlay.querySelector<HTMLInputElement>('[data-appearance-strength]')?.addEventListener('input', (event) => {
    const value = clamp(Number((event.currentTarget as HTMLInputElement).value) / 100, 0, 1);
    appearance = { ...appearance, backPatternStrength: value };
    saveAppearance();
  });

  overlay.querySelectorAll<HTMLInputElement>('[data-appearance-file]').forEach((input) => {
    input.addEventListener('change', () => void handleImageInput(input));
  });

  overlay.querySelectorAll<HTMLButtonElement>('[data-appearance-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.dataset.appearanceClear;
      if (kind === 'table') {
        appearance = { ...appearance, tableImage: null };
        saveAppearance('Custom felt texture cleared.');
      } else if (kind === 'back') {
        appearance = {
          ...appearance,
          backImage: null,
          backPattern: appearance.backPattern === 'custom' ? DEFAULTS.backPattern : appearance.backPattern,
        };
        saveAppearance('Custom tile-back image cleared.');
      }
    });
  });

  overlay.querySelector<HTMLButtonElement>('.appearance-reset')?.addEventListener('click', () => {
    appearance = { ...DEFAULTS };
    saveAppearance('Appearance defaults restored.');
  });

  document.body.append(overlay);
  return overlay;
}

function updatePanelControls(): void {
  if (!panel) return;
  panel.querySelectorAll<HTMLInputElement>('[data-appearance-color]').forEach((input) => {
    const key = input.dataset.appearanceColor as ColorKey;
    if (!key) return;
    input.value = appearance[key];
    const output = panel?.querySelector<HTMLOutputElement>(`[data-appearance-hex="${key}"]`);
    if (output) output.value = appearance[key].toUpperCase();
  });
  const pattern = panel.querySelector<HTMLSelectElement>('[data-appearance-pattern]');
  if (pattern) pattern.value = appearance.backPattern;
  const strength = panel.querySelector<HTMLInputElement>('[data-appearance-strength]');
  if (strength) strength.value = String(Math.round(appearance.backPatternStrength * 100));
  const strengthValue = panel.querySelector<HTMLElement>('[data-appearance-strength-value]');
  if (strengthValue) strengthValue.textContent = `${Math.round(appearance.backPatternStrength * 100)}%`;

  const tableState = panel.querySelector<HTMLElement>('[data-appearance-file-state="table"]');
  if (tableState) tableState.textContent = appearance.tableImage ? 'Custom texture active' : 'Using felt colour';
  const backState = panel.querySelector<HTMLElement>('[data-appearance-file-state="back"]');
  if (backState) backState.textContent = appearance.backImage ? 'Custom back active' : 'Using generated texture';
  const tableClear = panel.querySelector<HTMLButtonElement>('[data-appearance-clear="table"]');
  if (tableClear) tableClear.disabled = !appearance.tableImage;
  const backClear = panel.querySelector<HTMLButtonElement>('[data-appearance-clear="back"]');
  if (backClear) backClear.disabled = !appearance.backImage;
}

function openPanel(): void {
  if (!panel) panel = buildPanel();
  updatePanelControls();
  panel.hidden = false;
  document.body.classList.add('appearance-open');
  panel.querySelector<HTMLElement>('.appearance-close')?.focus();
}

function closePanel(): void {
  if (!panel) return;
  panel.hidden = true;
  document.body.classList.remove('appearance-open');
  document.querySelector<HTMLButtonElement>('.appearance-toggle')?.focus();
}

async function optimizedImage(file: File, maxDimension: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create image canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', quality);
  } finally {
    bitmap.close?.();
  }
}

async function handleImageInput(input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  if (!file) return;
  const kind = input.dataset.appearanceFile;
  const isTable = kind === 'table';
  const maxBytes = isTable ? 12_000_000 : 8_000_000;
  if (file.size > maxBytes) {
    setPanelStatus(`${isTable ? 'Felt' : 'Tile-back'} image is too large. Choose a source under ${isTable ? '12' : '8'} MB.`);
    input.value = '';
    return;
  }
  setPanelStatus(`Optimizing ${file.name}…`);
  try {
    const encoded = await optimizedImage(file, isTable ? 1280 : 768, isTable ? .78 : .82);
    if (isTable) {
      appearance = { ...appearance, tableImage: encoded };
      saveAppearance(`Felt texture loaded: ${file.name}`);
    } else {
      appearance = { ...appearance, backImage: encoded, backPattern: 'custom' };
      saveAppearance(`Tile-back image loaded: ${file.name}`);
    }
  } catch {
    setPanelStatus('Could not decode or optimize that image.');
  } finally {
    input.value = '';
  }
}

function ensureOptionsButton(): void {
  const actions = document.querySelector<HTMLElement>('.header-actions');
  if (!actions || actions.querySelector('.appearance-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-button appearance-toggle';
  button.textContent = 'Options';
  button.title = 'Table colours, textures and tile appearance';
  button.addEventListener('click', openPanel);
  const tutorial = actions.querySelector('[data-ui-action="tutorial"]');
  actions.insertBefore(button, tutorial);
}

function hideMovedDevControl(section: HTMLElement, labels: readonly string[]): void {
  section.querySelectorAll<HTMLElement>('.dev-color-control').forEach((row) => {
    const label = row.querySelector('label')?.textContent?.trim() ?? '';
    if (labels.includes(label)) row.hidden = true;
  });
}

function moveAppearanceOutOfDevPanel(): void {
  const devPanel = document.querySelector<HTMLElement>('.dev-tuning-panel');
  if (!devPanel) return;
  devPanel.querySelectorAll<HTMLElement>('.dev-tuning-section').forEach((section) => {
    const title = section.querySelector('h3')?.textContent?.trim();
    if (title === 'Scene background' || title === 'Felt & tile backs') {
      section.hidden = true;
      section.dataset.appearanceMoved = 'true';
    } else if (title === 'Tiles & front material') {
      hideMovedDevControl(section, ['Body RGB', 'Front tint']);
    } else if (title === 'Table geometry') {
      hideMovedDevControl(section, ['Wood RGB']);
    }
  });
  if (!devPanel.querySelector('.dev-appearance-moved-note')) {
    const note = document.createElement('div');
    note.className = 'dev-appearance-moved-note';
    note.textContent = 'Table, background and tile colours/textures moved to Options. Dev now keeps geometry and diagnostic controls only.';
    const head = devPanel.querySelector('.dev-tuning-head');
    head?.insertAdjacentElement('afterend', note);
  }
}

function ensureUi(): void {
  ensureScheduled = false;
  ensureOptionsButton();
  moveAppearanceOutOfDevPanel();
}

function scheduleEnsureUi(): void {
  if (ensureScheduled) return;
  ensureScheduled = true;
  requestAnimationFrame(ensureUi);
}

window.addEventListener(DEV_TUNING_EVENT, (event) => {
  const detail = (event as CustomEvent<any>).detail;
  if (visualFieldsMatch(detail)) return;
  const merged = mergeAppearanceIntoDev(detail);
  try { localStorage.setItem(DEV_TUNING_KEY, JSON.stringify(merged)); } catch {}
  if (correctiveBroadcastScheduled) return;
  correctiveBroadcastScheduled = true;
  queueMicrotask(() => {
    correctiveBroadcastScheduled = false;
    const latest = mergeAppearanceIntoDev(readDevSettings());
    try { localStorage.setItem(DEV_TUNING_KEY, JSON.stringify(latest)); } catch {}
    window.dispatchEvent(new CustomEvent(DEV_TUNING_EVENT, { detail: latest }));
  });
});

window.addEventListener('storage', (event) => {
  if (event.key === APPEARANCE_KEY) {
    appearance = loadAppearance();
    applyAppearanceToDom();
    broadcastMergedDevSettings();
    updatePanelControls();
  } else if (event.key === DEV_TUNING_KEY) {
    const dev = readDevSettings();
    if (!visualFieldsMatch(dev)) broadcastMergedDevSettings();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panel && !panel.hidden) closePanel();
});

const observer = new MutationObserver(scheduleEnsureUi);
observer.observe(document.body, { childList: true, subtree: true });

applyAppearanceToDom();
broadcastMergedDevSettings();
ensureUi();
