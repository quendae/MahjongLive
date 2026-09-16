import './presentation-transitions.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

let previousDoraCount: number | null = null;
let heldRonMarkup: string | null = null;
let scheduled = false;

function captureRonFromNode(node: Node): void {
  if (!(node instanceof HTMLElement)) return;
  if (node.matches('.call-bubble-ron:not(.call-bubble-held)')) {
    heldRonMarkup = node.outerHTML;
    return;
  }
  const nested = node.querySelector<HTMLElement>('.call-bubble-ron:not(.call-bubble-held)');
  if (nested) heldRonMarkup = nested.outerHTML;
}

function reconcileDoraReveal(): void {
  const row = app.querySelector<HTMLElement>('.dora-row');
  if (!row) return;
  const tiles = [...row.querySelectorAll<HTMLElement>('.tile')];
  const count = tiles.length;

  if (previousDoraCount === null) {
    previousDoraCount = count;
    return;
  }

  const presenting = Boolean(app.querySelector('.app-shell.is-presenting'));
  if (presenting && count > previousDoraCount) {
    const addedCount = count - previousDoraCount;
    tiles.slice(-addedCount).forEach((tile) => tile.classList.add('dora-revealed'));
  }

  previousDoraCount = count;
}

function createHeldRon(): HTMLElement | null {
  if (!heldRonMarkup) return null;
  const template = document.createElement('template');
  template.innerHTML = heldRonMarkup.trim();
  const bubble = template.content.firstElementChild;
  if (!(bubble instanceof HTMLElement)) return null;
  bubble.classList.add('call-bubble-held');
  return bubble;
}

function reconcileRonBridge(): void {
  const shell = app.querySelector<HTMLElement>('.app-shell');
  const presenting = Boolean(shell?.classList.contains('is-presenting'));
  const held = app.querySelector<HTMLElement>('.call-bubble-held');

  if (!presenting) {
    heldRonMarkup = null;
    held?.remove();
    return;
  }

  const liveRon = app.querySelector<HTMLElement>('.call-bubble-ron:not(.call-bubble-held)');
  if (liveRon) {
    heldRonMarkup = liveRon.outerHTML;
    held?.remove();
    return;
  }

  if (held || !heldRonMarkup) return;
  const table = app.querySelector<HTMLElement>('.mahjong-table');
  const bubble = createHeldRon();
  if (table && bubble) table.append(bubble);
}

function reconcile(): void {
  scheduled = false;
  reconcileDoraReveal();
  reconcileRonBridge();
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(reconcile);
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    record.addedNodes.forEach(captureRonFromNode);
    record.removedNodes.forEach(captureRonFromNode);
  }
  schedule();
});

observer.observe(app, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
});

reconcile();
