import './table-2d-seating.css';

const STORAGE_KEY = 'mahjong-live:dev-2d-seating:v1';

type SeatingTuning = {
  opponentHandScale: number;
  riverX: number;
  riverY: number;
};

type NumberKey = keyof SeatingTuning;

const DEFAULTS: SeatingTuning = {
  opponentHandScale: 1.08,
  riverX: 250,
  riverY: 192,
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function load(): SeatingTuning {
  let raw: any = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { raw = {}; }
  return {
    opponentHandScale: finite(raw.opponentHandScale, DEFAULTS.opponentHandScale),
    riverX: finite(raw.riverX, DEFAULTS.riverX),
    riverY: finite(raw.riverY, DEFAULTS.riverY),
  };
}

let settings = load();
let scheduled = false;

function apply(): void {
  const style = document.documentElement.style;
  style.setProperty('--dev2d-opponent-hand-scale', String(settings.opponentHandScale));
  style.setProperty('--dev2d-river-x', `${settings.riverX}px`);
  style.setProperty('--dev2d-river-y', `${settings.riverY}px`);
}

function save(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  apply();
  const status = document.querySelector<HTMLElement>('.dev-tuning-status');
  if (status) status.textContent = '2D seating updated live.';
}

function sliderRow(
  section: HTMLElement,
  label: string,
  key: NumberKey,
  min: number,
  max: number,
  step: number,
  suffix = '',
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
  const number = document.createElement('input');
  number.type = 'number';
  number.min = String(min);
  number.max = String(max);
  number.step = String(step);
  number.className = 'dev-tuning-number';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'dev-tuning-reset';
  reset.textContent = '↺';
  reset.title = `Reset ${label} to ${DEFAULTS[key]}${suffix}`;

  const sync = () => {
    slider.value = String(settings[key]);
    number.value = step < 1 ? settings[key].toFixed(2) : String(Math.round(settings[key]));
    number.title = `${number.value}${suffix}`;
  };
  const commit = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    settings = { ...settings, [key]: Math.max(min, Math.min(max, raw)) };
    sync();
    save();
  };

  slider.addEventListener('input', () => commit(Number(slider.value)));
  number.addEventListener('change', () => commit(Number(number.value)));
  number.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit(Number(number.value));
  });
  reset.addEventListener('click', () => commit(DEFAULTS[key]));
  sync();
  row.append(name, slider, number, reset);
  section.append(row);
}

function buildSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'dev-tuning-section dev-2d-seating-section';
  section.innerHTML = '<h3>2D seating</h3><p class="dev-2d-note">Opponent rack scale and river distance around the centre counter.</p>';

  sliderRow(section, 'Opponent rack scale', 'opponentHandScale', .75, 1.55, .01, '×');
  sliderRow(section, 'River horizontal distance', 'riverX', 180, 420, 1, 'px');
  sliderRow(section, 'River vertical distance', 'riverY', 130, 320, 1, 'px');

  const actions = document.createElement('div');
  actions.className = 'dev-tuning-actions';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'dev-tuning-action';
  reset.textContent = 'Reset 2D seating';
  reset.addEventListener('click', () => {
    settings = { ...DEFAULTS };
    localStorage.removeItem(STORAGE_KEY);
    apply();
    section.replaceWith(buildSection());
  });
  actions.append(reset);
  section.append(actions);
  return section;
}

function ensureSection(): void {
  scheduled = false;
  const panel = document.querySelector<HTMLElement>('.dev-tuning-panel');
  if (!panel) return;
  let section = panel.querySelector<HTMLElement>('.dev-2d-seating-section');
  if (!section) {
    section = buildSection();
    const main2d = panel.querySelector<HTMLElement>('.dev-2d-section');
    if (main2d) main2d.insertAdjacentElement('afterend', section);
    else panel.append(section);
  }
  section.dataset.active = String(!document.querySelector('.mahjong-table.table-3d-active'));
}

function scheduleEnsure(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(ensureSection);
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  settings = load();
  apply();
  scheduleEnsure();
});

const observer = new MutationObserver(scheduleEnsure);
observer.observe(document.body, { childList: true, subtree: true });

apply();
scheduleEnsure();
