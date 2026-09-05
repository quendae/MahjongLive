import './dev-ui-layout.css';

const STORAGE_KEY = 'mahjong-live:dev-ui-layout:v2';

type Offset = { x: number; y: number };
type ComponentId =
  | 'table'
  | 'topPanel' | 'leftPanel' | 'rightPanel' | 'bottomPanel'
  | 'topBadge' | 'leftBadge' | 'rightBadge' | 'bottomBadge'
  | 'topRack' | 'leftRack' | 'rightRack' | 'humanHand'
  | 'topRiver' | 'leftRiver' | 'rightRiver' | 'bottomRiver'
  | 'topMeld' | 'leftMeld' | 'rightMeld' | 'bottomMeld'
  | 'center' | 'dora' | 'actionDock' | 'callBubble';

type LayoutSettings = {
  sideRiverColumns: number;
  offsets: Record<ComponentId, Offset>;
};

const COMPONENT_IDS: readonly ComponentId[] = [
  'table',
  'topPanel', 'leftPanel', 'rightPanel', 'bottomPanel',
  'topBadge', 'leftBadge', 'rightBadge', 'bottomBadge',
  'topRack', 'leftRack', 'rightRack', 'humanHand',
  'topRiver', 'leftRiver', 'rightRiver', 'bottomRiver',
  'topMeld', 'leftMeld', 'rightMeld', 'bottomMeld',
  'center', 'dora', 'actionDock', 'callBubble',
];

function emptyOffsets(): Record<ComponentId, Offset> {
  return Object.fromEntries(COMPONENT_IDS.map((id) => [id, { x: 0, y: 0 }])) as Record<ComponentId, Offset>;
}

const DEFAULTS: LayoutSettings = {
  sideRiverColumns: 6,
  offsets: emptyOffsets(),
};

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function loadSettings(): LayoutSettings {
  let raw: any = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { raw = {}; }
  const offsets = emptyOffsets();
  for (const id of COMPONENT_IDS) {
    offsets[id] = {
      x: finite(raw?.offsets?.[id]?.x, 0),
      y: finite(raw?.offsets?.[id]?.y, 0),
    };
  }
  return {
    sideRiverColumns: Math.max(3, Math.min(8, Math.round(finite(raw?.sideRiverColumns, 6)))),
    offsets,
  };
}

let settings = loadSettings();
let scheduled = false;

function kebab(id: ComponentId): string {
  return id.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function applySettings(): void {
  const style = document.documentElement.style;
  style.setProperty('--devui-side-river-columns', String(settings.sideRiverColumns));
  for (const id of COMPONENT_IDS) {
    const name = kebab(id);
    style.setProperty(`--devui-${name}-x`, `${settings.offsets[id].x}px`);
    style.setProperty(`--devui-${name}-y`, `${settings.offsets[id].y}px`);
  }
}

function setStatus(text: string): void {
  const target = document.querySelector<HTMLElement>('.dev-tuning-status');
  if (target) target.textContent = text;
}

function saveSettings(message = '2D component layout updated live.'): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  applySettings();
  setStatus(message);
}

function sliderRow(
  parent: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  get: () => number,
  set: (value: number) => void,
  defaultValue = 0,
  suffix = 'px',
): void {
  const row = document.createElement('div');
  row.className = 'dev-tuning-control';

  const name = document.createElement('label');
  name.textContent = label;
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = String(min); slider.max = String(max); slider.step = String(step);
  const number = document.createElement('input');
  number.type = 'number'; number.min = String(min); number.max = String(max); number.step = String(step);
  number.className = 'dev-tuning-number';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'dev-tuning-reset'; reset.textContent = '↺';
  reset.title = `Reset ${label} to ${defaultValue}${suffix}`;

  const sync = (value: number) => {
    slider.value = String(value);
    number.value = step < 1 ? value.toFixed(2) : String(Math.round(value));
  };
  const commit = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    const value = Math.max(min, Math.min(max, raw));
    set(value);
    sync(value);
    saveSettings();
  };

  sync(get());
  slider.addEventListener('input', () => commit(Number(slider.value)));
  number.addEventListener('change', () => commit(Number(number.value)));
  number.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit(Number(number.value));
  });
  reset.addEventListener('click', () => commit(defaultValue));

  row.append(name, slider, number, reset);
  parent.append(row);
}

function offsetRows(parent: HTMLElement, label: string, id: ComponentId, range = 420): void {
  sliderRow(parent, `${label} X`, -range, range, 1, () => settings.offsets[id].x, (value) => { settings.offsets[id].x = value; });
  sliderRow(parent, `${label} Y`, -range, range, 1, () => settings.offsets[id].y, (value) => { settings.offsets[id].y = value; });
}

function subgroup(title: string, open = false): { details: HTMLDetailsElement; body: HTMLDivElement } {
  const details = document.createElement('details');
  details.className = 'dev-ui-subgroup';
  details.open = open;
  const summary = document.createElement('summary');
  summary.textContent = title;
  const body = document.createElement('div');
  body.className = 'dev-ui-subgroup-body';
  details.append(summary, body);
  return { details, body };
}

function buildAdvanced2dSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'dev-tuning-section dev-ui-layout-section';
  section.innerHTML = `
    <h3>Component positions</h3>
    <p class="dev-ui-layout-note">Fine X/Y offsets are additive and work on desktop, tablet and phone without replacing the seat rotations. Keep a subgroup closed until you need it.</p>
  `;

  const global = subgroup('Table / global', true);
  offsetRows(global.body, 'Whole table', 'table', 700);
  sliderRow(global.body, 'Side river columns', 3, 8, 1,
    () => settings.sideRiverColumns,
    (value) => { settings.sideRiverColumns = Math.round(value); },
    6,
    '',
  );
  section.append(global.details);

  const panels = subgroup('Player panels');
  offsetRows(panels.body, 'Top panel', 'topPanel');
  offsetRows(panels.body, 'Left panel', 'leftPanel');
  offsetRows(panels.body, 'Right panel', 'rightPanel');
  offsetRows(panels.body, 'Your panel', 'bottomPanel');
  section.append(panels.details);

  const labels = subgroup('Badges / concealed racks');
  offsetRows(labels.body, 'Top badge', 'topBadge', 260);
  offsetRows(labels.body, 'Left badge', 'leftBadge', 260);
  offsetRows(labels.body, 'Right badge', 'rightBadge', 260);
  offsetRows(labels.body, 'Your badge', 'bottomBadge', 260);
  offsetRows(labels.body, 'Top rack', 'topRack', 300);
  offsetRows(labels.body, 'Left rack', 'leftRack', 300);
  offsetRows(labels.body, 'Right rack', 'rightRack', 300);
  offsetRows(labels.body, 'Your hand', 'humanHand', 300);
  section.append(labels.details);

  const rivers = subgroup('Discard rivers');
  offsetRows(rivers.body, 'Top river', 'topRiver');
  offsetRows(rivers.body, 'Left river', 'leftRiver');
  offsetRows(rivers.body, 'Right river', 'rightRiver');
  offsetRows(rivers.body, 'Your river', 'bottomRiver');
  section.append(rivers.details);

  const melds = subgroup('Meld groups');
  offsetRows(melds.body, 'Top melds', 'topMeld');
  offsetRows(melds.body, 'Left melds', 'leftMeld');
  offsetRows(melds.body, 'Right melds', 'rightMeld');
  offsetRows(melds.body, 'Your melds', 'bottomMeld');
  section.append(melds.details);

  const overlays = subgroup('Center / Dora / prompts');
  offsetRows(overlays.body, 'Center', 'center');
  offsetRows(overlays.body, 'Dora', 'dora');
  offsetRows(overlays.body, 'Action dock', 'actionDock');
  offsetRows(overlays.body, 'Call bubble', 'callBubble');
  section.append(overlays.details);

  const actions = document.createElement('div');
  actions.className = 'dev-tuning-actions';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'dev-tuning-action'; reset.textContent = 'Reset component offsets';
  reset.addEventListener('click', () => {
    settings = { sideRiverColumns: 6, offsets: emptyOffsets() };
    localStorage.removeItem(STORAGE_KEY);
    applySettings();
    const replacement = buildAdvanced2dSection();
    section.replaceWith(replacement);
    setStatus('2D component offsets restored to defaults.');
  });
  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'dev-tuning-action'; copy.textContent = 'Copy 2D UI JSON';
  copy.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(JSON.stringify(settings, null, 2));
    setStatus('2D component layout JSON copied.');
  });
  actions.append(reset, copy);
  section.append(actions);
  return section;
}

type GroupId = '2d' | '3d-view' | '3d-world' | 'performance' | 'appearance' | 'more';
type GroupSpec = { id: GroupId; label: string; copy: string; open?: boolean };

const GROUPS: readonly GroupSpec[] = [
  { id: '2d', label: '2D · Layout', copy: 'table, seats, rivers, melds', open: true },
  { id: '3d-view', label: '3D · Camera & UI', copy: 'camera, seat rotation, overlays' },
  { id: '3d-world', label: '3D · Tiles & table', copy: 'geometry, rivers, materials' },
  { id: 'performance', label: 'Rendering & diagnostics', copy: 'renderer, FPS, benchmark' },
  { id: 'appearance', label: 'Advanced appearance', copy: 'prefer Options for normal use' },
  { id: 'more', label: 'Other / legacy', copy: 'uncategorized controls' },
];

function groupIdFor(title: string): GroupId {
  const value = title.trim().toLowerCase();
  if (value.startsWith('2d')) return '2d';
  if (value === 'performance & graphics') return 'performance';
  if (value === 'scene background' || value === 'felt & tile backs') return 'appearance';
  if (value === 'camera' || value === 'ui overlays' || value.includes('opponent tiles') || value === 'your tiles') return '3d-view';
  if (value === 'tiles & front material' || value === 'discard layout' || value === 'table geometry') return '3d-world';
  return 'more';
}

function insertionAnchor(panel: HTMLElement): Element | null {
  for (const child of Array.from(panel.children)) {
    if (child.classList.contains('dev-tuning-actions') || child.classList.contains('dev-tuning-status')) return child;
  }
  return null;
}

function ensureGroups(panel: HTMLElement): Map<GroupId, HTMLDivElement> {
  const bodies = new Map<GroupId, HTMLDivElement>();
  const anchor = insertionAnchor(panel);
  for (const spec of GROUPS) {
    let details = panel.querySelector<HTMLDetailsElement>(`:scope > .dev-tuning-group[data-dev-group="${spec.id}"]`);
    if (!details) {
      details = document.createElement('details');
      details.className = 'dev-tuning-group';
      details.dataset.devGroup = spec.id;
      details.open = Boolean(spec.open);
      const summary = document.createElement('summary');
      summary.innerHTML = `<span>${spec.label}</span><small>${spec.copy}</small>`;
      const body = document.createElement('div');
      body.className = 'dev-tuning-group-body';
      details.append(summary, body);
      panel.insertBefore(details, anchor);
    }
    const body = details.querySelector<HTMLDivElement>(':scope > .dev-tuning-group-body');
    if (body) bodies.set(spec.id, body);
  }
  return bodies;
}

function organizePanel(panel: HTMLElement): void {
  const title = panel.querySelector<HTMLElement>('.dev-tuning-head strong');
  if (title) title.textContent = 'Dev Tuning';

  const bodies = ensureGroups(panel);
  const looseSections = Array.from(panel.children).filter((child): child is HTMLElement =>
    child instanceof HTMLElement && child.matches('section.dev-tuning-section')
  );
  for (const section of looseSections) {
    const heading = section.querySelector('h3')?.textContent ?? '';
    bodies.get(groupIdFor(heading))?.append(section);
  }

  const base2d = panel.querySelector<HTMLElement>('.dev-2d-section');
  const baseHeading = base2d?.querySelector<HTMLElement>('h3');
  if (baseHeading) baseHeading.textContent = 'Base table / scaling';

  const twoDBody = bodies.get('2d');
  if (twoDBody && !twoDBody.querySelector('.dev-ui-layout-section')) {
    twoDBody.append(buildAdvanced2dSection());
  }
}

function scheduleOrganize(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    document.querySelectorAll<HTMLElement>('.dev-tuning-panel').forEach(organizePanel);
  });
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  settings = loadSettings();
  applySettings();
  scheduleOrganize();
});

const observer = new MutationObserver(scheduleOrganize);
observer.observe(document.body, { childList: true, subtree: true });

applySettings();
scheduleOrganize();
