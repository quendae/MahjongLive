import './dev-ui-layout.css';

const STORAGE_KEY = 'mahjong-live:dev-ui-layout:v2';
const DEV_TUNING_KEY = 'mahjong-live:dev-tuning:v1';
const DEV_TUNING_EVENT = 'mahjong-live:dev-tuning';
const LAYOUT_VERSION = 4;

type Offset = { x: number; y: number };
type ComponentId =
  | 'table'
  | 'topPanel' | 'leftPanel' | 'rightPanel' | 'bottomPanel'
  | 'topBadge' | 'leftBadge' | 'rightBadge' | 'bottomBadge'
  | 'topRack' | 'leftRack' | 'rightRack' | 'humanHand'
  | 'topRiver' | 'leftRiver' | 'rightRiver' | 'bottomRiver'
  | 'topMeld' | 'leftMeld' | 'rightMeld' | 'bottomMeld'
  | 'center' | 'dora' | 'actionDock' | 'callBubble';

type ScaleId = Exclude<ComponentId, 'table'>;
type CalledGapKey = 'calledTileGapFromLeft' | 'calledTileGapAcross' | 'calledTileGapFromRight';

type LayoutSettings = {
  layoutVersion: number;
  tileScale: number;
  sideRiverColumns: number;
  offsets: Record<ComponentId, Offset>;
  scales: Record<ScaleId, number>;
  bottomPanelWidth: number;
  bottomPanelHeight: number;
  backTextureScale: number;
  backCornerRadius: number;
  backPatternOpacity: number;
  backFrameOpacity: number;
  doraGap: number;
  humanHandGap: number;
  drawnTileGap: number;
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

const SCALE_IDS = COMPONENT_IDS.filter((id): id is ScaleId => id !== 'table');
const TILE_BEARING_SCALE_IDS: readonly ScaleId[] = [
  'topRack', 'leftRack', 'rightRack', 'humanHand',
  'topRiver', 'leftRiver', 'rightRiver', 'bottomRiver',
  'topMeld', 'leftMeld', 'rightMeld', 'bottomMeld', 'dora',
];

function emptyOffsets(): Record<ComponentId, Offset> {
  return Object.fromEntries(COMPONENT_IDS.map((id) => [id, { x: 0, y: 0 }])) as Record<ComponentId, Offset>;
}

function defaultOffsets(): Record<ComponentId, Offset> {
  const values = emptyOffsets();
  values.topBadge = { x: 0, y: -10 };
  values.leftBadge = { x: 50, y: 202 };
  values.rightBadge = { x: -50, y: 202 };
  values.topRack = { x: 0, y: 18 };
  values.leftRack = { x: 42, y: 0 };
  values.rightRack = { x: -42, y: 0 };
  values.dora = { x: 0, y: 0 };
  return values;
}

function defaultScales(): Record<ScaleId, number> {
  const values = Object.fromEntries(SCALE_IDS.map((id) => [id, 1])) as Record<ScaleId, number>;
  values.topBadge = 1.25;
  values.leftBadge = 1.25;
  values.rightBadge = 1.25;
  return values;
}

const DEFAULTS: LayoutSettings = {
  layoutVersion: LAYOUT_VERSION,
  tileScale: 1,
  sideRiverColumns: 7,
  offsets: defaultOffsets(),
  scales: defaultScales(),
  bottomPanelWidth: 910,
  bottomPanelHeight: 189,
  backTextureScale: .72,
  backCornerRadius: 2.5,
  backPatternOpacity: .22,
  backFrameOpacity: .30,
  doraGap: 4,
  humanHandGap: 4,
  drawnTileGap: 16,
};

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function loadSettings(): LayoutSettings {
  let raw: any = {};
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { raw = {}; }
  const oldVersion = Math.round(finite(raw?.layoutVersion, raw?.scales ? 2 : 1));
  const offsets = defaultOffsets();
  for (const id of COMPONENT_IDS) {
    offsets[id] = {
      x: finite(raw?.offsets?.[id]?.x, offsets[id].x),
      y: finite(raw?.offsets?.[id]?.y, offsets[id].y),
    };
  }
  if (oldVersion < 3) offsets.dora = { x: 0, y: 0 };

  const scales = defaultScales();
  for (const id of SCALE_IDS) scales[id] = finite(raw?.scales?.[id], scales[id]);
  // v4 establishes one physical tile scale. Legacy rack/river/meld/Dora multipliers would break
  // that invariant, so normalize only the tile-bearing groups while preserving panels and badges.
  if (oldVersion < LAYOUT_VERSION) {
    for (const id of TILE_BEARING_SCALE_IDS) scales[id] = 1;
  }

  return {
    layoutVersion: LAYOUT_VERSION,
    tileScale: Math.max(.55, Math.min(1.65, finite(raw?.tileScale, DEFAULTS.tileScale))),
    sideRiverColumns: Math.max(3, Math.min(9, Math.round(finite(raw?.sideRiverColumns, DEFAULTS.sideRiverColumns)))),
    offsets,
    scales,
    bottomPanelWidth: finite(raw?.bottomPanelWidth, DEFAULTS.bottomPanelWidth),
    bottomPanelHeight: finite(raw?.bottomPanelHeight, DEFAULTS.bottomPanelHeight),
    backTextureScale: finite(raw?.backTextureScale, DEFAULTS.backTextureScale),
    backCornerRadius: finite(raw?.backCornerRadius, DEFAULTS.backCornerRadius),
    backPatternOpacity: finite(raw?.backPatternOpacity, DEFAULTS.backPatternOpacity),
    backFrameOpacity: finite(raw?.backFrameOpacity, DEFAULTS.backFrameOpacity),
    doraGap: finite(raw?.doraGap, DEFAULTS.doraGap),
    humanHandGap: finite(raw?.humanHandGap, DEFAULTS.humanHandGap),
    drawnTileGap: finite(raw?.drawnTileGap, DEFAULTS.drawnTileGap),
  };
}

let settings = loadSettings();
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
let scheduled = false;

function kebab(id: ComponentId): string {
  return id.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function px(value: number): string {
  return `${Number(value.toFixed(2))}px`;
}

function applyTileProfile(style: CSSStyleDeclaration, name: string, width: number, height: number, gap: number): void {
  style.setProperty(`--devui-tile-w-${name}`, px(width * settings.tileScale));
  style.setProperty(`--devui-tile-h-${name}`, px(height * settings.tileScale));
  style.setProperty(`--devui-tile-gap-${name}`, px(gap * settings.tileScale));
}

function applySettings(): void {
  const style = document.documentElement.style;
  style.setProperty('--devui-tile-scale', String(settings.tileScale));
  applyTileProfile(style, 'desktop', 43, 58, 3);
  applyTileProfile(style, 'tablet', 35, 47, 3);
  applyTileProfile(style, 'phone', 28, 38, 2);
  applyTileProfile(style, 'landscape', 25, 34, 2);
  style.setProperty('--devui-side-river-columns', String(settings.sideRiverColumns));
  style.setProperty('--devui-bottom-panel-width', `${settings.bottomPanelWidth}px`);
  style.setProperty('--devui-bottom-panel-height', `${settings.bottomPanelHeight}px`);
  style.setProperty('--devui-back-texture-scale', String(settings.backTextureScale));
  style.setProperty('--devui-back-corner-radius', `${settings.backCornerRadius}px`);
  style.setProperty('--devui-back-pattern-opacity', String(settings.backPatternOpacity));
  style.setProperty('--devui-back-frame-opacity', String(settings.backFrameOpacity));
  style.setProperty('--devui-dora-gap', `${settings.doraGap}px`);
  style.setProperty('--devui-human-hand-gap', `${settings.humanHandGap}px`);
  style.setProperty('--devui-drawn-tile-gap', `${settings.drawnTileGap}px`);
  for (const id of COMPONENT_IDS) {
    const name = kebab(id);
    style.setProperty(`--devui-${name}-x`, `${settings.offsets[id].x}px`);
    style.setProperty(`--devui-${name}-y`, `${settings.offsets[id].y}px`);
    if (id !== 'table') style.setProperty(`--devui-${name}-scale`, String(settings.scales[id]));
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
  onSave: () => void = () => saveSettings(),
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
    onSave();
  };

  sync(get());
  slider.addEventListener('input', () => commit(Number(slider.value)));
  number.addEventListener('change', () => commit(Number(number.value)));
  number.addEventListener('keydown', (event) => { if (event.key === 'Enter') commit(Number(number.value)); });
  reset.addEventListener('click', () => commit(defaultValue));
  row.append(name, slider, number, reset);
  parent.append(row);
}

function offsetRows(parent: HTMLElement, label: string, id: ComponentId, range = 420): void {
  const fallback = DEFAULTS.offsets[id];
  sliderRow(parent, `${label} X`, -range, range, 1, () => settings.offsets[id].x, (value) => { settings.offsets[id].x = value; }, fallback.x);
  sliderRow(parent, `${label} Y`, -range, range, 1, () => settings.offsets[id].y, (value) => { settings.offsets[id].y = value; }, fallback.y);
}

function scaleRow(parent: HTMLElement, label: string, id: ScaleId, min = .45, max = 2.2): void {
  sliderRow(parent, `${label} size`, min, max, .01, () => settings.scales[id], (value) => { settings.scales[id] = value; }, DEFAULTS.scales[id], '×');
}

function positionAndScale(parent: HTMLElement, label: string, id: ScaleId, range = 420, min = .45, max = 2.2): void {
  offsetRows(parent, label, id, range);
  scaleRow(parent, label, id, min, max);
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
    <h3>Component positions & sizes</h3>
    <p class="dev-ui-layout-note">All physical 2D tiles share one size. X/Y controls only move groups; they no longer secretly rescale rack, river, meld or Dora tiles.</p>
  `;

  const global = subgroup('Table / global', true);
  offsetRows(global.body, 'Whole table', 'table', 700);
  sliderRow(global.body, 'All 2D tiles size', .55, 1.65, .01, () => settings.tileScale, (value) => { settings.tileScale = value; }, DEFAULTS.tileScale, '×');
  sliderRow(global.body, 'Side river columns', 3, 9, 1, () => settings.sideRiverColumns, (value) => { settings.sideRiverColumns = Math.round(value); }, DEFAULTS.sideRiverColumns, '');
  section.append(global.details);

  const backs = subgroup('2D tile backs / hand spacing', true);
  sliderRow(backs.body, 'Back pattern scale', .15, 1.60, .01, () => settings.backTextureScale, (value) => { settings.backTextureScale = value; }, DEFAULTS.backTextureScale, '×');
  sliderRow(backs.body, 'Back corner radius', 0, 6, .1, () => settings.backCornerRadius, (value) => { settings.backCornerRadius = value; }, DEFAULTS.backCornerRadius, 'px');
  sliderRow(backs.body, 'Back pattern opacity', 0, .65, .01, () => settings.backPatternOpacity, (value) => { settings.backPatternOpacity = value; }, DEFAULTS.backPatternOpacity, '');
  sliderRow(backs.body, 'Back inner frame opacity', 0, .70, .01, () => settings.backFrameOpacity, (value) => { settings.backFrameOpacity = value; }, DEFAULTS.backFrameOpacity, '');
  sliderRow(backs.body, 'Your hand tile gap', 0, 12, 1, () => settings.humanHandGap, (value) => { settings.humanHandGap = value; }, DEFAULTS.humanHandGap, 'px');
  sliderRow(backs.body, 'Drawn tile gap', 0, 36, 1, () => settings.drawnTileGap, (value) => { settings.drawnTileGap = value; }, DEFAULTS.drawnTileGap, 'px');
  section.append(backs.details);

  const panels = subgroup('Player backgrounds / panels');
  positionAndScale(panels.body, 'Top panel', 'topPanel');
  positionAndScale(panels.body, 'Left panel', 'leftPanel');
  positionAndScale(panels.body, 'Right panel', 'rightPanel');
  positionAndScale(panels.body, 'Your panel', 'bottomPanel', 420, .55, 1.8);
  sliderRow(panels.body, 'Your panel width', 420, 1400, 5, () => settings.bottomPanelWidth, (value) => { settings.bottomPanelWidth = value; }, DEFAULTS.bottomPanelWidth, 'px');
  sliderRow(panels.body, 'Your panel height', 72, 260, 1, () => settings.bottomPanelHeight, (value) => { settings.bottomPanelHeight = value; }, DEFAULTS.bottomPanelHeight, 'px');
  section.append(panels.details);

  const labels = subgroup('Badges / concealed racks');
  positionAndScale(labels.body, 'Top badge', 'topBadge', 320, .6, 2.2);
  positionAndScale(labels.body, 'Left badge', 'leftBadge', 360, .6, 2.5);
  positionAndScale(labels.body, 'Right badge', 'rightBadge', 360, .6, 2.5);
  positionAndScale(labels.body, 'Your badge', 'bottomBadge', 320, .6, 2.2);
  offsetRows(labels.body, 'Top rack', 'topRack', 360);
  offsetRows(labels.body, 'Left rack', 'leftRack', 360);
  offsetRows(labels.body, 'Right rack', 'rightRack', 360);
  offsetRows(labels.body, 'Your hand', 'humanHand', 360);
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
  positionAndScale(overlays.body, 'Center', 'center', 320, .55, 1.8);
  offsetRows(overlays.body, 'Dora row', 'dora', 120);
  sliderRow(overlays.body, 'Dora indicator gap', 0, 12, 1, () => settings.doraGap, (value) => { settings.doraGap = value; }, DEFAULTS.doraGap, 'px');
  positionAndScale(overlays.body, 'Action dock', 'actionDock', 420, .55, 1.8);
  positionAndScale(overlays.body, 'Call bubble', 'callBubble', 320, .55, 2.0);
  section.append(overlays.details);

  const actions = document.createElement('div');
  actions.className = 'dev-tuning-actions';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'dev-tuning-action'; reset.textContent = 'Reset 2D UI baseline';
  reset.addEventListener('click', () => {
    settings = structuredClone(DEFAULTS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    applySettings();
    section.replaceWith(buildAdvanced2dSection());
    setStatus('2D UI restored to the current baseline.');
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

function read3dTuning(): any {
  try { return JSON.parse(localStorage.getItem(DEV_TUNING_KEY) ?? '{}'); } catch { return {}; }
}

function calledGap(key: CalledGapKey): number {
  const raw = read3dTuning();
  return finite(raw?.tiles?.[key], finite(raw?.tiles?.calledTileGap, .10));
}

function setCalledGap(key: CalledGapKey, value: number): void {
  const raw = read3dTuning();
  raw.tiles = raw.tiles && typeof raw.tiles === 'object' ? raw.tiles : {};
  raw.tiles[key] = value;
  try { localStorage.setItem(DEV_TUNING_KEY, JSON.stringify(raw)); } catch {}
  window.dispatchEvent(new CustomEvent(DEV_TUNING_EVENT, { detail: raw }));
  setStatus('3D called-tile spacing updated live.');
}

function build3dCalledTileSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'dev-tuning-section dev-called-tile-section';
  section.innerHTML = '<h3>3D called tile spacing</h3><p class="dev-ui-layout-note">Separate spacing for the sideways tile depending on which opponent supplied it.</p>';
  for (const [label, key] of [
    ['Called tile gap · from left', 'calledTileGapFromLeft'],
    ['Called tile gap · across', 'calledTileGapAcross'],
    ['Called tile gap · from right', 'calledTileGapFromRight'],
  ] as const) {
    sliderRow(section, label, -.40, .40, .01, () => calledGap(key), (value) => setCalledGap(key, value), .10, '', () => {});
  }
  return section;
}

type GroupId = '2d' | '3d-view' | '3d-world' | 'performance' | 'appearance' | 'more';
type GroupSpec = { id: GroupId; label: string; copy: string; open?: boolean };

const GROUPS: readonly GroupSpec[] = [
  { id: '2d', label: '2D · Layout', copy: 'table, seats, rivers, sizes', open: true },
  { id: '3d-view', label: '3D · Camera & UI', copy: 'camera, seat rotation, overlays' },
  { id: '3d-world', label: '3D · Tiles & table', copy: 'geometry, rivers, meld spacing' },
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
  if (value === 'tiles & front material' || value === 'discard layout' || value === 'table geometry' || value.startsWith('3d called tile')) return '3d-world';
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
  if (title && title.textContent !== 'Dev Tuning') title.textContent = 'Dev Tuning';
  const bodies = ensureGroups(panel);
  const looseSections = Array.from(panel.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches('section.dev-tuning-section'));
  for (const section of looseSections) {
    const heading = section.querySelector('h3')?.textContent ?? '';
    bodies.get(groupIdFor(heading))?.append(section);
  }
  const base2d = panel.querySelector<HTMLElement>('.dev-2d-section');
  const baseHeading = base2d?.querySelector<HTMLElement>('h3');
  if (baseHeading && baseHeading.textContent !== 'Base table / scaling') baseHeading.textContent = 'Base table / scaling';
  const twoDBody = bodies.get('2d');
  if (twoDBody && !twoDBody.querySelector('.dev-ui-layout-section')) twoDBody.append(buildAdvanced2dSection());
  const worldBody = bodies.get('3d-world');
  if (worldBody && !worldBody.querySelector('.dev-called-tile-section')) worldBody.append(build3dCalledTileSection());
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
