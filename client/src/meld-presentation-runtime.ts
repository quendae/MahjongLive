import './meld-presentation.css';
import { calledMeldTargetIndex } from './meld-presentation';

function directMeldTiles(meld: HTMLElement): HTMLElement[] {
  return [...meld.children].filter((child): child is HTMLElement =>
    child instanceof HTMLElement && child.classList.contains('tile')
  );
}

function reconcileMeld(meld: HTMLElement): void {
  const zone = meld.closest<HTMLElement>('.player-zone[data-player]');
  if (!zone) return;
  const owner = Number(zone.dataset.player);
  if (!Number.isInteger(owner)) return;

  const tiles = directMeldTiles(meld);
  const called = tiles.find((tile) => tile.classList.contains('tile-meld-called'));
  if (!called) return;
  const calledFrom = Number(called.dataset.calledFrom);
  if (!Number.isInteger(calledFrom)) return;

  const target = calledMeldTargetIndex(owner, calledFrom, tiles.length);
  const current = tiles.indexOf(called);
  if (target === null || current < 0 || current === target) return;

  const ordered = [...tiles];
  ordered.splice(current, 1);
  ordered.splice(target, 0, called);
  meld.replaceChildren(...ordered);
}

function reconcileAllMelds(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.player-zone[data-player] .meld').forEach(reconcileMeld);
}

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      reconcileAllMelds(app);
    });
  };
  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  reconcileAllMelds(app);
}
