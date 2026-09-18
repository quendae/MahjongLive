import './ui-scale.css';

const UI_SCALE_KEY = 'mahjong-live:ui-scale:v1';

type UiScale = 'compact' | 'normal' | 'large' | 'extra-large';

type UiScalePreset = {
  label: string;
  copy: string;
  percent: number;
};

const PRESETS: Record<UiScale, UiScalePreset> = {
  compact: { label: 'Compact', copy: 'Fits more controls on screen.', percent: 90 },
  normal: { label: 'Normal', copy: 'Default interface size.', percent: 100 },
  large: { label: 'Large', copy: 'Larger text and controls.', percent: 115 },
  'extra-large': { label: 'Extra large', copy: 'Maximum UI readability.', percent: 130 },
};

const ORDER: readonly UiScale[] = ['compact', 'normal', 'large', 'extra-large'];

function isUiScale(value: unknown): value is UiScale {
  return typeof value === 'string' && ORDER.includes(value as UiScale);
}

function loadScale(): UiScale {
  try {
    const stored = localStorage.getItem(UI_SCALE_KEY);
    return isUiScale(stored) ? stored : 'normal';
  } catch {
    return 'normal';
  }
}

let currentScale = loadScale();

function applyScale(): void {
  document.documentElement.dataset.uiScale = currentScale;
}

function updateButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-ui-scale]').forEach((button) => {
    const active = button.dataset.uiScale === currentScale;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-selected', active);
  });
}

function setScale(scale: UiScale): void {
  currentScale = scale;
  try { localStorage.setItem(UI_SCALE_KEY, scale); } catch {}
  applyScale();
  updateButtons();
  const status = document.querySelector<HTMLElement>('.appearance-status');
  if (status) status.textContent = `Interface scale: ${PRESETS[scale].label} (${PRESETS[scale].percent}%).`;
}

function buildCard(): HTMLElement {
  const card = document.createElement('section');
  card.className = 'appearance-card ui-scale-options-card';
  card.innerHTML = `
    <div class="appearance-card-head"><span>Interface scale</span><small>UI only · table and tiles stay unchanged</small></div>
    <div class="ui-scale-presets" role="group" aria-label="Interface scale">
      ${ORDER.map((id) => {
        const preset = PRESETS[id];
        return `
          <button type="button" class="ui-scale-preset" data-ui-scale="${id}" aria-pressed="false">
            <strong>${preset.label}</strong>
            <span>${preset.percent}%</span>
            <small>${preset.copy}</small>
          </button>
        `;
      }).join('')}
    </div>
  `;
  card.querySelectorAll<HTMLButtonElement>('[data-ui-scale]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.uiScale;
      if (isUiScale(value)) setScale(value);
    });
  });
  return card;
}

function ensureCard(): void {
  const grid = document.querySelector<HTMLElement>('.appearance-grid');
  if (!grid) return;
  let card = grid.querySelector<HTMLElement>('.ui-scale-options-card');
  if (!card) {
    card = buildCard();
    grid.prepend(card);
  }
  updateButtons();
}

applyScale();
const observer = new MutationObserver(() => requestAnimationFrame(ensureCard));
observer.observe(document.body, { childList: true, subtree: true });
requestAnimationFrame(ensureCard);
