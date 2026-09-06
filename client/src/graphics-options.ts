import './graphics-options.css';

const DEV_TUNING_KEY = 'mahjong-live:dev-tuning:v1';
const DEV_TUNING_EVENT = 'mahjong-live:dev-tuning';
const PROFILE_KEY = 'mahjong-live:graphics-profile:v1';

type GraphicsSettings = {
  pixelRatio: number;
  shadowQuality: number;
  anisotropy: number;
  geometryQuality: number;
};

type ProfileId = 'max' | 'high' | 'balanced' | 'low';
type GraphicsProfile = {
  label: string;
  copy: string;
  values: GraphicsSettings;
};

const PROFILES: Record<ProfileId, GraphicsProfile> = {
  max: {
    label: 'Maximum',
    copy: 'Default. Full-resolution rendering, 2048 px soft shadows, maximum geometry and anisotropic filtering.',
    values: { pixelRatio: 2, shadowQuality: 3, anisotropy: 16, geometryQuality: 3 },
  },
  high: {
    label: 'High',
    copy: 'Small visual reduction for integrated GPUs and older gaming laptops.',
    values: { pixelRatio: 1.5, shadowQuality: 2, anisotropy: 8, geometryQuality: 2 },
  },
  balanced: {
    label: 'Balanced',
    copy: 'The previous Mahjong Live baseline. Good fallback when high-DPI rendering is expensive.',
    values: { pixelRatio: 1, shadowQuality: 1, anisotropy: 4, geometryQuality: 1 },
  },
  low: {
    label: 'Low',
    copy: 'For weak or battery-limited devices: lower resolution, no real-time shadows and simple geometry.',
    values: { pixelRatio: .75, shadowQuality: 0, anisotropy: 1, geometryQuality: 0 },
  },
};

function readDev(): any {
  try { return JSON.parse(localStorage.getItem(DEV_TUNING_KEY) ?? '{}'); } catch { return {}; }
}

function sameGraphics(a: any, b: GraphicsSettings): boolean {
  return Number(a?.pixelRatio) === b.pixelRatio
    && Number(a?.shadowQuality) === b.shadowQuality
    && Number(a?.anisotropy) === b.anisotropy
    && Number(a?.geometryQuality) === b.geometryQuality;
}

function detectedProfile(): ProfileId | 'custom' {
  const graphics = readDev()?.graphics;
  for (const id of Object.keys(PROFILES) as ProfileId[]) {
    if (sameGraphics(graphics, PROFILES[id].values)) return id;
  }
  return 'custom';
}

function writeGraphics(profileId: ProfileId, announce = true): void {
  const dev = readDev();
  dev.graphics = { ...PROFILES[profileId].values };
  try {
    localStorage.setItem(DEV_TUNING_KEY, JSON.stringify(dev));
    localStorage.setItem(PROFILE_KEY, profileId);
  } catch {}
  window.dispatchEvent(new CustomEvent(DEV_TUNING_EVENT, { detail: dev }));
  updateCards();
  if (announce) {
    const status = document.querySelector<HTMLElement>('.appearance-status');
    if (status) status.textContent = `3D graphics: ${PROFILES[profileId].label}. Applied live.`;
  }
}

function ensureMaximumDefault(): void {
  const stored = localStorage.getItem(PROFILE_KEY);
  if (stored && stored in PROFILES) return;
  // Existing installs did not have a user-facing graphics profile. Migrate them once to the new
  // product default: maximum rendering quality. Subsequent user choices are never overwritten.
  writeGraphics('max', false);
}

function metrics(profile: GraphicsProfile): string {
  const values = profile.values;
  const shadow = values.shadowQuality === 0 ? 'Off' : values.shadowQuality === 1 ? '512' : values.shadowQuality === 2 ? '1024' : '2048';
  return `
    <div class="graphics-profile-metrics">
      <span><small>Pixel ratio</small><strong>${values.pixelRatio.toFixed(values.pixelRatio % 1 ? 1 : 0)}×</strong></span>
      <span><small>Shadows</small><strong>${shadow}${shadow === 'Off' ? '' : ' px'}</strong></span>
      <span><small>Anisotropy</small><strong>${values.anisotropy}×</strong></span>
      <span><small>Geometry</small><strong>${values.geometryQuality === 3 ? 'Max' : values.geometryQuality === 2 ? 'High' : values.geometryQuality === 1 ? 'Normal' : 'Low'}</strong></span>
    </div>
  `;
}

function buildCard(): HTMLElement {
  const card = document.createElement('section');
  card.className = 'appearance-card graphics-options-card';
  card.innerHTML = `
    <div class="appearance-card-head"><span>3D rendering</span><small>Maximum quality is the default</small></div>
    <label class="appearance-select-row">
      <span><strong>Graphics quality</strong><small>Use a lower profile only when a device struggles with 3D</small></span>
      <select data-graphics-profile aria-label="3D graphics quality">
        <option value="max">Maximum</option>
        <option value="high">High</option>
        <option value="balanced">Balanced</option>
        <option value="low">Low</option>
        <option value="custom" disabled>Custom (Dev)</option>
      </select>
    </label>
    <p class="graphics-profile-copy"></p>
    <div data-graphics-metrics></div>
  `;
  const select = card.querySelector<HTMLSelectElement>('[data-graphics-profile]');
  select?.addEventListener('change', () => {
    const value = select.value as ProfileId;
    if (value in PROFILES) writeGraphics(value);
  });
  return card;
}

function updateCard(card: HTMLElement): void {
  const detected = detectedProfile();
  const select = card.querySelector<HTMLSelectElement>('[data-graphics-profile]');
  if (select) select.value = detected;
  const profile = detected === 'custom'
    ? { label: 'Custom', copy: 'Custom graphics values are currently active from Dev.', values: readDev()?.graphics as GraphicsSettings }
    : PROFILES[detected];
  const copy = card.querySelector<HTMLElement>('.graphics-profile-copy');
  if (copy) copy.textContent = profile.copy;
  const target = card.querySelector<HTMLElement>('[data-graphics-metrics]');
  if (target) {
    const values = profile.values;
    target.innerHTML = values && Number.isFinite(values.pixelRatio)
      ? metrics({ label: profile.label, copy: profile.copy, values })
      : '';
  }
}

function updateCards(): void {
  document.querySelectorAll<HTMLElement>('.graphics-options-card').forEach(updateCard);
}

function ensureCard(): void {
  const grid = document.querySelector<HTMLElement>('.appearance-grid');
  if (!grid) return;
  let card = grid.querySelector<HTMLElement>('.graphics-options-card');
  if (!card) {
    card = buildCard();
    grid.appendChild(card);
  }
  updateCard(card);
}

ensureMaximumDefault();
const observer = new MutationObserver(() => requestAnimationFrame(ensureCard));
observer.observe(document.body, { childList: true, subtree: true });
requestAnimationFrame(ensureCard);
