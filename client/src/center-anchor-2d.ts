import './center-anchor-2d.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

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
  // Absolutely positioned player-zones use the table padding box as their coordinate space.
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
  // offsetWidth/offsetHeight deliberately ignore transforms. That lets us calculate the visual
  // bounding box after a 90° seat rotation without relying on browser-specific transform matrices.
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
    left = c.centerX - width / 2;
    top = c.top - height;
    rotation = 180;
  } else if (side === 'bottom') {
    left = c.centerX - width / 2;
    top = c.bottom;
  } else if (side === 'left') {
    // After a 90° rotation visual width = unrotated height. Keep the visual right edge exactly on
    // the center's left edge, while keeping the river centered vertically on the center component.
    const visualCenterX = c.left - height / 2;
    left = visualCenterX - width / 2;
    top = c.centerY - height / 2;
    rotation = 90;
  } else {
    const visualCenterX = c.right + height / 2;
    left = visualCenterX - width / 2;
    top = c.centerY - height / 2;
    rotation = -90;
  }

  river.style.left = `${left}px`;
  river.style.right = 'auto';
  river.style.top = `${top}px`;
  river.style.bottom = 'auto';
  river.style.transform = rotation === 0 ? 'none' : `rotate(${rotation}deg)`;
  river.dataset.centerAnchored = 'true';
}

function clear3dMarkers(table: HTMLElement): void {
  table.classList.remove('center-anchored-2d');
  table.querySelectorAll<HTMLElement>('.discard-river[data-center-anchored]').forEach((river) => {
    delete river.dataset.centerAnchored;
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
