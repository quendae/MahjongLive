import './clarity.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

const TILE_MODE_KEY = 'mahjong-live:tile-face-mode:v1';
type TileFaceMode = 'classic' | 'beginner';

let scheduled = false;

function tileMode(): TileFaceMode {
  return localStorage.getItem(TILE_MODE_KEY) === 'beginner' ? 'beginner' : 'classic';
}

function setTileMode(mode: TileFaceMode): void {
  localStorage.setItem(TILE_MODE_KEY, mode);
  enhanceNow();
  window.dispatchEvent(new CustomEvent('mahjong-live:tile-face-mode', { detail: mode }));
}

function learningLabel(raw: string | null): string | null {
  const label = raw?.trim().toLowerCase() ?? '';
  const suited = /^(?:red )?([1-9])([mps])$/.exec(label);
  if (suited) return suited[1];
  if (label === 'east') return 'E';
  if (label === 'south') return 'S';
  if (label === 'west') return 'W';
  if (label === 'north') return 'N';
  if (label === 'white dragon') return 'W';
  if (label === 'green dragon') return 'G';
  if (label === 'red dragon') return 'R';
  return null;
}

function ensureTileModeControl(): void {
  const actions = app.querySelector<HTMLElement>('.header-actions');
  if (!actions || actions.querySelector('[data-setting-tile-face]')) return;

  const label = document.createElement('label');
  label.className = 'header-control tile-face-control';
  label.innerHTML = `
    <span>Tiles</span>
    <select class="difficulty-select" data-setting-tile-face aria-label="Tile face style">
      <option value="classic">Classic</option>
      <option value="beginner">Beginner</option>
    </select>
  `;
  const select = label.querySelector<HTMLSelectElement>('select');
  if (!select) return;
  select.value = tileMode();
  select.addEventListener('change', () => {
    setTileMode(select.value === 'beginner' ? 'beginner' : 'classic');
  });

  const advisor = actions.querySelector('.advisor-toggle');
  actions.insertBefore(label, advisor ?? actions.firstChild);
}

function decorateTileFaces(): void {
  const beginner = tileMode() === 'beginner';
  app.querySelector('.app-shell')?.classList.toggle('tile-mode-beginner', beginner);

  for (const tile of app.querySelectorAll<HTMLElement>('.tile[aria-label]:not(.tile-back)')) {
    const wanted = beginner ? learningLabel(tile.getAttribute('aria-label')) : null;
    const existing = tile.querySelector<HTMLElement>(':scope > .tile-learning-label');
    if (!wanted) {
      existing?.remove();
      continue;
    }
    if (existing?.textContent === wanted) continue;
    if (existing) {
      existing.textContent = wanted;
    } else {
      const badge = document.createElement('span');
      badge.className = 'tile-learning-label';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = wanted;
      tile.appendChild(badge);
    }
  }
}

function ensureDoraTray(table: HTMLElement): void {
  const source = table.querySelector<HTMLElement>('.table-center .dora-row');
  if (!source) return;
  const tray = table.querySelector<HTMLElement>('.table-dora-tray');

  // 2D has enough DOM space to render the actual Dora row inside the physical centre counter.
  // Keep the original source in flow so 1–5 active indicators naturally expand as one row instead
  // of cloning them into a detached overlay window.
  if (!table.classList.contains('table-3d-active')) {
    source.classList.remove('clarity-source-hidden');
    source.classList.add('center-dora-integrated');
    tray?.remove();
    return;
  }

  // 3D still uses the detached HUD tray because the Three.js table covers the DOM counter source.
  source.classList.remove('center-dora-integrated');
  source.classList.add('clarity-source-hidden');
  const signature = [...source.querySelectorAll<HTMLElement>('.tile')]
    .map((tile) => tile.getAttribute('aria-label') ?? '')
    .join('|');
  let currentTray = tray;
  if (currentTray?.dataset.signature === signature) return;

  if (!currentTray) {
    currentTray = document.createElement('div');
    currentTray.className = 'table-dora-tray';
    currentTray.setAttribute('aria-label', 'Dora indicators');
    table.appendChild(currentTray);
  }
  currentTray.dataset.signature = signature;
  currentTray.replaceChildren();

  const title = document.createElement('span');
  title.className = 'dora-tray-title';
  title.textContent = 'DORA';
  currentTray.appendChild(title);

  const tiles = document.createElement('div');
  tiles.className = 'dora-tray-tiles';
  for (const tile of source.querySelectorAll<HTMLElement>('.tile')) {
    tiles.appendChild(tile.cloneNode(true));
  }
  currentTray.appendChild(tiles);
}

function seatSide(zone: Element): 'bottom' | 'top' | 'left' | 'right' {
  if (zone.classList.contains('player-top')) return 'top';
  if (zone.classList.contains('player-left')) return 'left';
  if (zone.classList.contains('player-right')) return 'right';
  return 'bottom';
}

function enhanceCenterCounter(table: HTMLElement): void {
  const center = table.querySelector<HTMLElement>('.table-center');
  if (!center) return;
  center.classList.add('classic-table-counter');
  if (center.querySelector('.counter-score-ring')) return;

  const ring = document.createElement('div');
  ring.className = 'counter-score-ring';
  for (const zone of table.querySelectorAll<HTMLElement>('.player-zone')) {
    const side = seatSide(zone);
    const name = zone.querySelector('.player-name')?.textContent?.trim() ?? '';
    const points = zone.querySelector('.player-points')?.textContent?.trim() ?? '';
    const wind = zone.querySelector('.seat-wind')?.textContent?.trim() ?? '';
    if (!name || !points) continue;
    const score = document.createElement('div');
    score.className = `counter-score counter-score-${side}`;
    score.innerHTML = `<b>${wind}</b><span>${name}</span><strong>${points}</strong>`;
    ring.appendChild(score);
  }
  center.appendChild(ring);
}

type LatestDiscard = {
  player: string;
  label: string;
  tile: HTMLElement;
};

function latestDiscard(table: HTMLElement): LatestDiscard | null {
  const entries = [...app.querySelectorAll<HTMLElement>('.log-entry')];
  for (const entry of entries) {
    const text = entry.textContent?.trim() ?? '';
    const match = /^(You|Bot \d+) discarded (.+?)(?: \(tsumogiri\))?\.$/.exec(text);
    if (!match) continue;
    const player = match[1];
    const label = match[2];
    const zone = [...table.querySelectorAll<HTMLElement>('.player-zone')]
      .find((candidate) => candidate.querySelector('.player-name')?.textContent?.trim() === player);
    if (!zone) continue;
    const candidates = [...zone.querySelectorAll<HTMLElement>('.discard-river .tile')]
      .filter((tile) => tile.getAttribute('aria-label') === label && !tile.classList.contains('tile-called'));
    const tile = candidates.at(-1);
    if (tile) return { player, label, tile };
  }
  return null;
}

function markLatestDiscard(table: HTMLElement): LatestDiscard | null {
  const latest = latestDiscard(table);
  for (const tile of table.querySelectorAll<HTMLElement>('.tile-latest-discard')) {
    if (tile !== latest?.tile) tile.classList.remove('tile-latest-discard');
  }
  if (!latest) return null;
  latest.tile.classList.add('tile-latest-discard');
  latest.tile.dataset.latestDiscardBy = latest.player;
  latest.tile.title = `Latest discard — ${latest.player}: ${latest.label}`;
  return latest;
}

function reactionActions(): HTMLButtonElement[] {
  const dock = app.querySelector<HTMLElement>('.action-dock:not(.presentation-dock)');
  if (!dock || !dock.querySelector('[data-ui-action="pass"]')) return [];
  return [...dock.querySelectorAll<HTMLButtonElement>('.action-button[data-ui-action]')]
    .filter((button) => ['ron', 'pon', 'chi', 'daiminkan', 'pass'].includes(button.dataset.uiAction ?? ''));
}

function ensureReactionPopup(table: HTMLElement, latest: LatestDiscard | null): void {
  const actions = reactionActions();
  const old = table.querySelector<HTMLElement>('.reaction-popup');
  if (actions.length === 0) {
    old?.remove();
    app.querySelector('.action-dock')?.classList.remove('reaction-source-dock');
    return;
  }

  const signature = `${latest?.player ?? ''}|${latest?.label ?? ''}|${actions.map((action) => action.dataset.uiAction).join('|')}`;
  if (old?.dataset.signature === signature) return;
  old?.remove();

  const dock = app.querySelector<HTMLElement>('.action-dock:not(.presentation-dock)');
  dock?.classList.add('reaction-source-dock');

  const popup = document.createElement('div');
  popup.className = 'reaction-popup';
  popup.dataset.signature = signature;
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Respond to latest discard');

  const header = document.createElement('div');
  header.className = 'reaction-popup-header';
  const copy = document.createElement('div');
  copy.innerHTML = latest
    ? `<span>Latest discard</span><strong>${latest.player}</strong><small>${latest.label}</small>`
    : '<span>Reaction available</span><strong>Choose an action</strong>';
  header.appendChild(copy);
  if (latest) {
    const preview = latest.tile.cloneNode(true) as HTMLElement;
    preview.classList.remove('tile-compact', 'tile-latest-discard', 'tile-called');
    preview.classList.add('reaction-tile-preview');
    preview.removeAttribute('data-tile-id');
    preview.removeAttribute('role');
    preview.removeAttribute('tabindex');
    header.appendChild(preview);
  }
  popup.appendChild(header);

  const buttons = document.createElement('div');
  buttons.className = 'reaction-popup-actions';
  const order = ['ron', 'pon', 'chi', 'daiminkan', 'pass'];
  actions.sort((a, b) => order.indexOf(a.dataset.uiAction ?? '') - order.indexOf(b.dataset.uiAction ?? ''));
  for (const source of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${source.className} reaction-action`;
    button.textContent = source.textContent;
    button.dataset.proxyAction = source.dataset.uiAction;
    button.addEventListener('click', () => {
      const action = button.dataset.proxyAction;
      app.querySelector<HTMLButtonElement>(`.action-dock [data-ui-action="${action}"]`)?.click();
    });
    buttons.appendChild(button);
  }
  popup.appendChild(buttons);
  table.appendChild(popup);
}

function enhanceNow(): void {
  scheduled = false;
  ensureTileModeControl();
  const table = app.querySelector<HTMLElement>('.mahjong-table');
  if (!table) {
    decorateTileFaces();
    return;
  }
  ensureDoraTray(table);
  enhanceCenterCounter(table);
  const latest = markLatestDiscard(table);
  ensureReactionPopup(table, latest);
  decorateTileFaces();
}

function scheduleEnhance(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(enhanceNow);
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(app, { childList: true, subtree: true });
window.addEventListener('mahjong-live:tile-face-mode', scheduleEnhance);
// The 3D/2D switch updates a class without necessarily re-rendering the game DOM. Re-run the Dora
// integration one frame later so the source row and 3D HUD tray swap cleanly in either direction.
document.addEventListener('click', (event) => {
  if ((event.target as Element | null)?.closest('.table-3d-toggle')) {
    requestAnimationFrame(() => requestAnimationFrame(scheduleEnhance));
  }
});
scheduleEnhance();
