import './discard-source-2d.css';

const app = document.querySelector<HTMLElement>('#app');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PlayerSourceSnapshot = {
  hand: RectSnapshot | null;
  drawn: RectSnapshot | null;
  side: 'bottom' | 'top' | 'left' | 'right';
};

type LatestDiscard = {
  signature: string;
  player: string;
  label: string;
  tsumogiri: boolean;
  tile: HTMLElement;
  side: 'bottom' | 'top' | 'left' | 'right';
};

const sources = new Map<string, PlayerSourceSnapshot>();
let lastAnimatedSignature = '';
let scheduled = false;

function snapshot(rect: DOMRect): RectSnapshot {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function sideFor(zone: HTMLElement): PlayerSourceSnapshot['side'] {
  if (zone.classList.contains('player-top')) return 'top';
  if (zone.classList.contains('player-left')) return 'left';
  if (zone.classList.contains('player-right')) return 'right';
  return 'bottom';
}

function captureSources(): void {
  const table = app?.querySelector<HTMLElement>('.mahjong-table');
  if (!table || table.classList.contains('table-3d-active')) return;

  const next = new Map<string, PlayerSourceSnapshot>();
  for (const zone of table.querySelectorAll<HTMLElement>('.player-zone')) {
    const player = zone.querySelector<HTMLElement>('.player-name')?.textContent?.trim();
    if (!player) continue;
    const hand = zone.querySelector<HTMLElement>('.opponent-hand, .human-hand');
    const drawn = hand?.querySelector<HTMLElement>('.tile-drawn') ?? null;
    const tiles = hand ? [...hand.querySelectorAll<HTMLElement>(':scope > .tile')] : [];
    const arrangedTiles = tiles.filter((tile) => !tile.classList.contains('tile-drawn'));
    const handRect = arrangedTiles.length > 0
      ? (() => {
          const rects = arrangedTiles.map((tile) => tile.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
          if (rects.length === 0) return null;
          const left = Math.min(...rects.map((rect) => rect.left));
          const top = Math.min(...rects.map((rect) => rect.top));
          const right = Math.max(...rects.map((rect) => rect.right));
          const bottom = Math.max(...rects.map((rect) => rect.bottom));
          return { left, top, width: right - left, height: bottom - top };
        })()
      : null;
    const drawnRect = drawn?.getBoundingClientRect();
    next.set(player, {
      hand: handRect,
      drawn: drawnRect && drawnRect.width > 0 && drawnRect.height > 0 ? snapshot(drawnRect) : null,
      side: sideFor(zone),
    });
  }
  sources.clear();
  for (const [key, value] of next) sources.set(key, value);
}

function latestDiscard(): LatestDiscard | null {
  const table = app?.querySelector<HTMLElement>('.mahjong-table');
  if (!table || table.classList.contains('table-3d-active')) return null;

  const entries = [...app.querySelectorAll<HTMLElement>('.log-entry')];
  for (const entry of entries) {
    const text = entry.textContent?.trim() ?? '';
    const match = /^(You|Bot \d+) discarded (.+?)(?: \(tsumogiri\))?\.$/.exec(text);
    if (!match) continue;
    const player = match[1];
    const label = match[2];
    const tsumogiri = text.includes('(tsumogiri)');
    const zone = [...table.querySelectorAll<HTMLElement>('.player-zone')]
      .find((candidate) => candidate.querySelector('.player-name')?.textContent?.trim() === player);
    if (!zone) continue;
    const candidates = [...zone.querySelectorAll<HTMLElement>('.discard-river .tile')]
      .filter((tile) => tile.getAttribute('aria-label') === label && !tile.classList.contains('tile-called'));
    const tile = candidates.at(-1);
    if (!tile) continue;
    const engineId = tile.dataset.engineTileId ?? '';
    return {
      signature: `${text}|${engineId}|${candidates.length}`,
      player,
      label,
      tsumogiri,
      tile,
      side: sideFor(zone),
    };
  }
  return null;
}

function center(rect: RectSnapshot): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function handSourceRect(snapshot: PlayerSourceSnapshot): RectSnapshot | null {
  if (!snapshot.hand) return null;
  const hand = snapshot.hand;
  const side = snapshot.side;
  // For tedashi do not identify a specific hidden bot tile. Start from the arranged rack itself,
  // using a compact virtual tile at its visual centre. This communicates hand-vs-draw without
  // leaking which concealed tile was selected.
  if (side === 'left' || side === 'right') {
    return {
      left: hand.left + hand.width / 2 - 16,
      top: hand.top + hand.height / 2 - 12,
      width: 32,
      height: 24,
    };
  }
  return {
    left: hand.left + hand.width / 2 - 12,
    top: hand.top + hand.height / 2 - 16,
    width: 24,
    height: 32,
  };
}

function sideAngle(side: LatestDiscard['side']): number {
  if (side === 'top') return 180;
  if (side === 'left') return 90;
  if (side === 'right') return -90;
  return 0;
}

function markLatest(latest: LatestDiscard): void {
  const table = latest.tile.closest<HTMLElement>('.mahjong-table');
  table?.querySelectorAll<HTMLElement>('.tile-discard-source-latest').forEach((tile) => {
    if (tile !== latest.tile) tile.classList.remove('tile-discard-source-latest', 'tile-discard-tsumogiri', 'tile-discard-tedashi');
  });
  latest.tile.classList.add('tile-discard-source-latest', latest.tsumogiri ? 'tile-discard-tsumogiri' : 'tile-discard-tedashi');
  latest.tile.dataset.discardSource = latest.tsumogiri ? 'draw' : 'hand';
  latest.tile.title = `${latest.player}: ${latest.label} — ${latest.tsumogiri ? 'tsumogiri (drawn tile)' : 'discard from hand'}`;
}

function animateFlight(latest: LatestDiscard): void {
  markLatest(latest);
  if (latest.signature === lastAnimatedSignature) return;
  lastAnimatedSignature = latest.signature;
  if (reducedMotion) return;

  const previous = sources.get(latest.player);
  if (!previous) return;
  const source = latest.tsumogiri ? previous.drawn ?? handSourceRect(previous) : handSourceRect(previous);
  if (!source) return;

  const destinationRect = latest.tile.getBoundingClientRect();
  if (destinationRect.width < 2 || destinationRect.height < 2) return;
  const destination = snapshot(destinationRect);
  const start = center(source);
  const end = center(destination);
  const dx = start.x - end.x;
  const dy = start.y - end.y;
  const scaleX = Math.max(.55, Math.min(1.65, source.width / Math.max(1, destination.width)));
  const scaleY = Math.max(.55, Math.min(1.65, source.height / Math.max(1, destination.height)));
  const angle = sideAngle(latest.side);

  const ghost = latest.tile.cloneNode(true) as HTMLElement;
  ghost.classList.remove('tile-latest-discard', 'tile-discard-source-latest', 'tile-discard-tsumogiri', 'tile-discard-tedashi');
  ghost.classList.add('discard-flight-ghost');
  ghost.removeAttribute('id');
  ghost.removeAttribute('role');
  ghost.removeAttribute('tabindex');
  ghost.style.left = `${destination.left}px`;
  ghost.style.top = `${destination.top}px`;
  ghost.style.width = `${destination.width}px`;
  ghost.style.height = `${destination.height}px`;
  document.body.append(ghost);

  latest.tile.classList.add('discard-flight-target');
  const lift = latest.tsumogiri ? 24 : 34;
  const animation = ghost.animate([
    {
      transform: `translate(${dx}px, ${dy}px) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`,
      opacity: .38,
      offset: 0,
    },
    {
      transform: `translate(${dx * .52}px, ${dy * .52 - lift}px) rotate(${angle}deg) scale(1.06)`,
      opacity: 1,
      offset: .58,
    },
    {
      transform: `translate(0px, 0px) rotate(${angle}deg) scale(1)`,
      opacity: 1,
      offset: 1,
    },
  ], {
    duration: latest.tsumogiri ? 320 : 390,
    easing: 'cubic-bezier(.18,.72,.24,1)',
    fill: 'forwards',
  });

  animation.finished.catch(() => undefined).finally(() => {
    ghost.remove();
    latest.tile.classList.remove('discard-flight-target');
  });
}

function processFrame(): void {
  scheduled = false;
  const latest = latestDiscard();
  if (latest) animateFlight(latest);
  captureSources();
}

function scheduleProcess(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(processFrame);
}

if (app) {
  const observer = new MutationObserver(scheduleProcess);
  observer.observe(app, { childList: true, subtree: true });
}

window.addEventListener('resize', scheduleProcess, { passive: true });
window.addEventListener('mahjong-live:tile-face-mode', scheduleProcess);
captureSources();
scheduleProcess();
