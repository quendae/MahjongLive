import './viewport-3d.css';

const app = document.querySelector<HTMLElement>('#app');
const rootStyle = document.documentElement.style;

let tableObserver: ResizeObserver | null = null;
let headerObserver: ResizeObserver | null = null;
let observedTable: HTMLElement | null = null;
let observedHeader: HTMLElement | null = null;
let ensureScheduled = false;
let resizeScheduled = false;

function dispatchRendererResize(): void {
  if (resizeScheduled) return;
  resizeScheduled = true;
  requestAnimationFrame(() => {
    resizeScheduled = false;
    // table-3d.ts already owns renderer.setSize/aspect updates on window resize. Reusing that
    // path avoids a second renderer API surface while still reacting to pure CSS/layout changes.
    window.dispatchEvent(new Event('resize'));
  });
}

function bindHeader(header: HTMLElement | null): void {
  if (header === observedHeader) return;
  headerObserver?.disconnect();
  headerObserver = null;
  observedHeader = header;
  if (!header) return;

  const applyHeight = () => {
    const height = Math.max(0, header.getBoundingClientRect().height);
    rootStyle.setProperty('--mahjong-header-height', `${height.toFixed(2)}px`);
    dispatchRendererResize();
  };

  headerObserver = new ResizeObserver(applyHeight);
  headerObserver.observe(header);
  applyHeight();
}

function bindTable(table: HTMLElement | null): void {
  if (table === observedTable) return;
  tableObserver?.disconnect();
  tableObserver = null;
  observedTable = table;
  if (!table) return;

  tableObserver = new ResizeObserver(() => {
    if (table.classList.contains('table-3d-active')) dispatchRendererResize();
  });
  tableObserver.observe(table);
  dispatchRendererResize();
}

function ensureBindings(): void {
  ensureScheduled = false;
  bindHeader(document.querySelector<HTMLElement>('.app-header'));
  bindTable(document.querySelector<HTMLElement>('.mahjong-table'));
}

function scheduleEnsure(): void {
  if (ensureScheduled) return;
  ensureScheduled = true;
  requestAnimationFrame(ensureBindings);
}

if (app) {
  const mutationObserver = new MutationObserver(scheduleEnsure);
  mutationObserver.observe(app, { childList: true, subtree: true });
}

window.addEventListener('orientationchange', dispatchRendererResize);
window.addEventListener('pageshow', dispatchRendererResize);
ensureBindings();
