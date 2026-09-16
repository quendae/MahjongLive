import './meld-presentation.css';

type PhysicalTile = { id?: number };
type CalledMeld<T extends PhysicalTile> = {
  tiles: readonly T[];
  calledFrom?: number;
  calledTileId?: number;
};

/**
 * Meld arrays follow the physical table anchor used by the 3D renderer: slot 0 is the owner's
 * right-hand end. The final slot is the owner's left-hand end. `calledFrom` is an engine seat,
 * therefore the relative source is invariant no matter where the human camera sits.
 */
export function calledMeldTargetIndex(owner: number, calledFrom: number, size: number): number | null {
  if (!Number.isInteger(owner) || !Number.isInteger(calledFrom) || size < 2) return null;
  const relativeSource = ((calledFrom - owner) % 4 + 4) % 4;
  if (relativeSource === 1) return 0; // owner's right
  if (relativeSource === 2) return Math.min(1, size - 1); // across
  if (relativeSource === 3) return size - 1; // owner's left
  return null;
}

/**
 * Returns presentation order only. The authoritative meld and physical tile objects are never
 * mutated or cloned, so `calledTileId` continues to identify the exact claimed discard.
 */
export function orderMeldTilesForPresentation<T extends PhysicalTile>(
  meld: CalledMeld<T>,
  owner: number,
): T[] {
  const ordered = [...meld.tiles];
  if (meld.calledFrom === undefined || meld.calledTileId === undefined) return ordered;
  const calledIndex = ordered.findIndex((tile) => tile.id === meld.calledTileId);
  const targetIndex = calledMeldTargetIndex(owner, meld.calledFrom, ordered.length);
  if (calledIndex < 0 || targetIndex === null || calledIndex === targetIndex) return ordered;
  const [calledTile] = ordered.splice(calledIndex, 1);
  ordered.splice(targetIndex, 0, calledTile);
  return ordered;
}

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
