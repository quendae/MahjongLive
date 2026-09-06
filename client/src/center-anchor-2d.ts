import './center-anchor-2d.css';
import './2d-mobile-final.css';

const DEV_UI_KEY = 'mahjong-live:dev-ui-layout:v2';
const UNIFIED_BASELINE_MIGRATION_KEY = 'mahjong-live:center-anchor-unified:v2';
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

/* The old 2D tuning baseline intentionally enlarged opponent racks and shrank Dora. The new table
   model starts every physical tile at exactly the human-hand size. Preserve panels and most labels,
   but normalize tile-bearing groups and obsolete river offsets once. Side-badge X offsets also
   return to the seat edge because the old ±50px values were tuned around much smaller side racks. */
function migrateUnifiedTileBaseline(): void {
  if (localStorage.getItem(UNIFIED_BASELINE_MIGRATION_KEY) === '1') return;
  let raw: any = null;
  try { raw = JSON.parse(localStorage.getItem(DEV_UI_KEY) ?? 'null'); } catch { raw = null; }
  if (raw && typeof raw === 'object') {
    raw.scales = raw.scales && typeof raw.scales === 'object' ? raw.scales : {};
    for (const id of [
      'topRack', 'leftRack', 'rightRack', 'humanHand',
      'topRiver', 'leftRiver', 'rightRiver', 'bottomRiver',
      'topMeld', 'leftMeld', 'rightMeld', 'bottomMeld', 'dora',
    ]) raw.scales[id] = 1;
    raw.offsets = raw.offsets && typeof raw.offsets === 'object' ? raw.offsets : {};
    for (const id of ['topRiver', 'leftRiver', 'rightRiver', 'bottomRiver']) raw.offsets[id] = { x: 0, y: 0 };
    raw.offsets.leftBadge = { ...(raw.offsets.leftBadge ?? {}), x: 0 };
    raw.offsets.rightBadge = { ...(raw.offsets.rightBadge ?? {}), x: 0 };
    const serialized = JSON.stringify(raw);
    try {
      localStorage.setItem(DEV_UI_KEY, serialized);
      window.dispatchEvent(new StorageEvent('storage', { key: DEV_UI_KEY, newValue: serialized }));
    } catch {}
  }
  try { localStorage.setItem(UNIFIED_BASELINE_MIGRATION_KEY, '1'); } catch {}
}

migrateUnifiedTileBaseline();

let scheduled = false;
let observedCenter: HTMLElement | null = null;
let observedTable: HTMLElement | null = null;
const observedRivers = new Set<HTMLElement>();

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(layout);
}

const resizeObserver = new ResizeObserver(schedule);

function relativeCenterRect(table: HTMLElement, center: HTMLElement): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
} {
  const tableRect = table.getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const originX = tableRect.left + table.clientLeft;
  const originY = tableRect.top + table.clientTop;
  const left = centerRect.left - originX;
  const right = centerRect.right - originX;
  const top = centerRect.top - originY;
  const bottom = centerRect.bottom - originY;
  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function important(element: HTMLElement, property: string, value: string): void {
  element.style.setProperty(property, value, 'important');
}

function positionRiver(
  table: HTMLElement,
  center: HTMLElement,
  side: 'top' | 'right' | 'bottom' | 'left',
): void {
  const river = table.querySelector<HTMLElement>(`.player-${side} .discard-river`);
  if (!river) return;

  if (!observedRivers.has(river)) {
    observedRivers.add(river);
    resizeObserver.observe(river);
  }

  const c = relativeCenterRect(table, center);
  // offsetWidth/offsetHeight deliberately ignore transforms. For the side rivers, a 90° rotation
  // swaps their visual dimensions; the formulas below solve from the requested visual corner.
  const width = river.offsetWidth;
  const height = river.offsetHeight;
  if (width <= 0 || height <= 0) {
    river.dataset.centerAnchored = 'true';
    return;
  }

  let left = 0;
  let top = 0;
  let rotation = 0;

  if (side === 'top') {
    // Horizontal rivers start at the center's left edge and extend outward from its top edge.
    left = c.left;
    top = c.top - height;
    rotation = 180;
  } else if (side === 'bottom') {
    left = c.left;
    top = c.bottom;
  } else if (side === 'left') {
    // After +90° rotation: visual right = c.left and visual top = c.top.
    left = c.left - (width + height) / 2;
    top = c.top + (width - height) / 2;
    rotation = 90;
  } else {
    // After -90° rotation: visual left = c.right and visual top = c.top.
    left = c.right + (height - width) / 2;
    top = c.top + (width - height) / 2;
    rotation = -90;
  }

  important(river, 'left', `${left}px`);
  important(river, 'right', 'auto');
  important(river, 'top', `${top}px`);
  important(river, 'bottom', 'auto');
  important(river, 'transform', rotation === 0 ? 'none' : `rotate(${rotation}deg)`);
  // Individual Dev X/Y offsets remain additive through the CSS translate property. The measured
  // left/top geometry is always recomputed from the center and therefore stays stable on resize.
  river.style.removeProperty('translate');
  river.dataset.centerAnchored = 'true';
}

function clear3dMarkers(table: HTMLElement): void {
  table.classList.remove('center-anchored-2d');
  table.querySelectorAll<HTMLElement>('.discard-river[data-center-anchored]').forEach((river) => {
    delete river.dataset.centerAnchored;
    for (const property of ['left', 'right', 'top', 'bottom', 'transform', 'translate']) river.style.removeProperty(property);
  });
}

function layout(): void {
  scheduled = false;
  const table = app.querySelector<HTMLElement>('.mahjong-table');
  if (!table) return;
  if (table.classList.contains('table-3d-active')) {
    clear3dMarkers(table);
    return;
  }

  const center = table.querySelector<HTMLElement>('.table-center');
  if (!center) return;
  center.classList.add('table-center-core');
  table.classList.add('center-anchored-2d');

  if (observedTable !== table) {
    if (observedTable) resizeObserver.unobserve(observedTable);
    observedTable = table;
    resizeObserver.observe(table);
  }
  if (observedCenter !== center) {
    if (observedCenter) resizeObserver.unobserve(observedCenter);
    observedCenter = center;
    resizeObserver.observe(center);
  }

  positionRiver(table, center, 'top');
  positionRiver(table, center, 'right');
  positionRiver(table, center, 'bottom');
  positionRiver(table, center, 'left');
}

const observer = new MutationObserver(schedule);
observer.observe(app, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
});
window.addEventListener('resize', schedule, { passive: true });
window.addEventListener('orientationchange', schedule, { passive: true });

schedule();
