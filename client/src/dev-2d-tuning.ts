import './dev-2d-tuning.css';

const STORAGE_KEY = 'mahjong-live:dev-2d-tuning:v1';

type TwoDTuning = {
  tableMaxWidth: number;
  bottomReserve: number;
  playerScale: number;
  playerInsetTB: number;
  playerInsetSides: number;
  centerScale: number;
  centerX: number;
  centerY: number;
  doraScale: number;
  doraX: number;
  doraY: number;
  handScale: number;
  riverScale: number;
};

type NumberKey = keyof TwoDTuning;

const DEFAULTS: TwoDTuning = {
  tableMaxWidth: 2200,
  bottomReserve: 104,
  playerScale: 1,
  playerInsetTB: 18,
  playerInsetSides: 24,
  centerScale: 1,
  centerX: 0,
  centerY: 0,
  doraScale: 1.12,
  doraX: 24,
  doraY: 24,
  handScale: 1,
  riverScale: 1,
};

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function load(): TwoDTuning {
  let raw: any = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { raw = {}; }
  return {
    tableMaxWidth: finite(raw.tableMaxWidth, DEFAULTS.tableMaxWidth),
    bottomReserve: finite(raw.bottomReserve, DEFAULTS.bottomReserve),
    playerScale: finite(raw.playerScale, DEFAULTS.playerScale),
    playerInsetTB: finite(raw.playerInsetTB, DEFAULTS.playerInsetTB),
    playerInsetSides: finite(raw.playerInsetSides, DEFAULTS.playerInsetSides),
    centerScale: finite(raw.centerScale, DEFAULTS.centerScale),
    centerX: finite(raw.centerX, DEFAULTS.centerX),
    centerY: finite(raw.centerY, DEFAULTS.centerY),
    doraScale: finite(raw.doraScale, DEFAULTS.doraScale),
    doraX: finite(raw.doraX, DEFAULTS.doraX),
    doraY: finite(raw.doraY, DEFAULTS.doraY),
    handScale: finite(raw.handScale, DEFAULTS.handScale),
    riverScale: finite(raw.riverScale, DEFAULTS.riverScale),
  };
}

let settings = load();
let scheduled = false;

function apply(): void {
  const style = document.documentElement.style;
  style.setProperty('--dev2d-layout-max-width', `${settings.tableMaxWidth}px`);
  style.setProperty('--dev2d-bottom-reserve', `${settings.bottomReserve}px`);
  style.setProperty('--dev2d-player-scale', String(settings.playerScale));
  style.setProperty('--dev2d-player-inset-tb', `${settings.playerInsetTB}px`);
  style.setProperty('--dev2d-player-inset-sides', `${settings.playerInsetSides}px`);
  style.setProperty('--dev2d-center-scale', String(settings.centerScale));
  style.setProperty('--dev2d-center-x', `${settings.centerX}px`);
  style.setProperty('--dev2d-center-y', `${settings.centerY}px`);
  style.setProperty('--dev2d-dora-scale', String(settings.doraScale));
  style.setProperty('--dev2d-dora-x', `${settings.doraX}px`);
  style.setProperty('--dev2d-dora-y', `${settings.doraY}px`);
  style.setProperty('--dev2d-hand-scale', String(settings.handScale));
  style.setProperty('--dev2d-river-scale', String(settings.riverScale));
}

function save(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  apply();
  const status = document.querySelector<HTMLElement>('.dev-tuning-status');
  if (status) status.textContent = '2D layout updated live.';
}

function format(value: number, step: number): string {
  return step < 1 ? value.toFixed(2) : String(Math.round(value));
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
    number.value = format(settings[key], step);
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
  section.className = 'dev-tuning-section dev-2d-section';
  section.innerHTML = '<h3>2D layout</h3><p class="dev-2d-note">Live layout controls for the lightweight table. They do not change 3D camera/world geometry.</p>';

  sliderRow(section, 'Table max width', 'tableMaxWidth', 1400, 2600, 10, 'px');
  sliderRow(section, 'Bottom reserve', 'bottomReserve', 72, 220, 1, 'px');
  sliderRow(section, 'Player panels', 'playerScale', .70, 1.40, .01, '×');
  sliderRow(section, 'Top/bottom inset', 'playerInsetTB', 0, 100, 1, 'px');
  sliderRow(section, 'Side inset', 'playerInsetSides', 0, 120, 1, 'px');
  sliderRow(section, 'Center scale', 'centerScale', .70, 1.55, .01, '×');
  sliderRow(section, 'Center X', 'centerX', -260, 260, 1, 'px');
  sliderRow(section, 'Center Y', 'centerY', -220, 220, 1, 'px');
  sliderRow(section, 'Dora scale', 'doraScale', .70, 2.20, .01, '×');
  sliderRow(section, 'Dora X', 'doraX', 8, 320, 1, 'px');
  sliderRow(section, 'Dora Y', 'doraY', 8, 260, 1, 'px');
  sliderRow(section, 'Your hand tiles', 'handScale', .75, 1.35, .01, '×');
  sliderRow(section, 'River tiles', 'riverScale', .75, 1.35, .01, '×');

  const actions = document.createElement('div');
  actions.className = 'dev-tuning-actions';
  const resetAll = document.createElement('button');
  resetAll.type = 'button';
  resetAll.className = 'dev-tuning-action';
  resetAll.textContent = 'Reset 2D layout';
  resetAll.addEventListener('click', () => {
    settings = { ...DEFAULTS };
    localStorage.removeItem(STORAGE_KEY);
    apply();
    section.replaceWith(buildSection());
  });
  actions.append(resetAll);
  section.append(actions);
  return section;
}

function ensureSection(): void {
  scheduled = false;
  const panel = document.querySelector<HTMLElement>('.dev-tuning-panel');
  if (!panel) return;
  const title = panel.querySelector<HTMLElement>('.dev-tuning-head strong');
  if (title && title.textContent !== 'Dev Tuning') title.textContent = 'Dev Tuning';

  let section = panel.querySelector<HTMLElement>('.dev-2d-section');
  if (!section) {
    section = buildSection();
    const note = panel.querySelector<HTMLElement>('.dev-appearance-moved-note');
    const head = panel.querySelector<HTMLElement>('.dev-tuning-head');
    (note ?? head)?.insertAdjacentElement('afterend', section);
  }
  const active = !document.querySelector('.mahjong-table.table-3d-active');
  section.dataset.active = String(active);
  const note = section.querySelector<HTMLElement>('.dev-2d-note');
  if (note) {
    note.textContent = active
      ? 'Live now: drag a slider and the 2D table updates without a render/reload.'
      : '2D-only controls. Switch to 2D Table to preview them live; values stay saved.';
  }
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
