import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const CALLED_ID = 9901;

type Transform = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  scale: number;
};

type AuditActor = {
  key: string;
  zone: 'hand' | 'river' | 'rack' | 'meld';
  side: 'bottom' | 'top' | 'left' | 'right';
  player: string;
  tileId: number | null;
  group: Transform;
  target: Transform;
  motion: null | {
    start: Transform;
    target: Transform;
    duration: number;
    arcHeight: number;
  };
};

type AuditSnapshot = { actors: AuditActor[] };

async function boot3d(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '1');
    localStorage.setItem('mahjong-live:renderer-backend:v1', 'webgl');
    localStorage.setItem('mahjong-live:preferences:v1', JSON.stringify({
      preferredDifficulty: 'standard',
      advisorEnabled: false,
      tutorialSeen: true,
      presentationSpeed: 'instant',
    }));
    localStorage.setItem('mahjong-live:dev-tuning:v1', JSON.stringify({
      tiles: {
        calledTileRotation: 90,
        calledTileGap: .1,
        calledTileGapFromLeft: .15,
        calledTileGapAcross: .25,
        calledTileGapFromRight: .35,
      },
    }));
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click());
  await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
  await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
  await page.waitForTimeout(320);
}

async function audit(page: Page): Promise<AuditSnapshot> {
  const snapshot = await page.evaluate(() => new Promise<any | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 900);
    const receive = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener('mahjong-live:3d-audit', receive);
      resolve((event as CustomEvent).detail ?? null);
    };
    window.addEventListener('mahjong-live:3d-audit', receive);
    window.dispatchEvent(new Event('mahjong-live:3d-audit-request'));
  }));
  expect(snapshot, '3D renderer should answer audit requests').not.toBeNull();
  return snapshot as AuditSnapshot;
}

async function waitForActor(
  page: Page,
  predicate: (actor: AuditActor) => boolean,
  timeoutMs = 2400,
): Promise<AuditActor> {
  const deadline = Date.now() + timeoutMs;
  let latest: AuditActor | undefined;
  do {
    const snapshot = await audit(page);
    latest = snapshot.actors.find((actor) => actor.key === `tile:${CALLED_ID}`);
    if (latest && predicate(latest)) return latest;
    await page.waitForTimeout(20);
  } while (Date.now() < deadline);
  throw new Error(`3D called-tile actor did not reach expected state; latest=${JSON.stringify(latest)}`);
}

function expectSameTransform(actual: Transform, expected: Transform): void {
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
  expect(actual.z).toBeCloseTo(expected.z, 3);
  expect(actual.yaw).toBeCloseTo(expected.yaw, 3);
  expect(actual.pitch).toBeCloseTo(expected.pitch, 3);
  expect(actual.roll).toBeCloseTo(expected.roll, 3);
}

test('called tile keeps its physical actor when moving from source river into the 3D meld', async ({ page }) => {
  await boot3d(page);

  const seats = await page.evaluate((calledId) => {
    const table = document.querySelector<HTMLElement>('.mahjong-table');
    const ownerZone = table?.querySelector<HTMLElement>('.player-bottom[data-player]');
    if (!table || !ownerZone) throw new Error('Missing bottom player zone');
    const owner = Number(ownerZone.dataset.player);
    const source = (owner + 1) % 4;
    const sourceZone = table.querySelector<HTMLElement>(`.player-zone[data-player="${source}"]`);
    const river = sourceZone?.querySelector<HTMLElement>('.discard-river');
    if (!river) throw new Error('Missing source river');

    const called = document.createElement('div');
    called.className = 'tile tile-compact';
    called.dataset.engineTileId = String(calledId);
    called.setAttribute('aria-label', '5m');
    called.innerHTML = '<span></span>';
    river.append(called);
    return { owner, source };
  }, CALLED_ID);

  const riverActor = await waitForActor(page, (actor) => actor.zone === 'river' && actor.motion === null);
  expect(riverActor.side).toBe('right');
  const settledRiver = { ...riverActor.group };

  await page.evaluate(({ calledId, source }) => {
    const row = document.querySelector<HTMLElement>('.player-bottom .human-melds');
    const sourceRiverTile = document.querySelector<HTMLElement>(`[data-engine-tile-id="${calledId}"]`);
    if (!row || !sourceRiverTile) throw new Error('Missing meld row or called source tile');

    sourceRiverTile.remove();
    const meld = document.createElement('div');
    meld.className = 'meld meld-triplet';
    meld.dataset.meldIndex = '0';

    const appendTile = (id: number, called = false) => {
      const tile = document.createElement('div');
      tile.className = `tile tile-compact${called ? ' tile-meld-called' : ''}`;
      tile.dataset.engineTileId = String(id);
      tile.setAttribute('aria-label', '5m');
      if (called) tile.dataset.calledFrom = String(source);
      tile.innerHTML = '<span></span>';
      meld.append(tile);
    };

    // For a source on the owner's right the called tile belongs at the owner's right-hand end.
    appendTile(calledId, true);
    appendTile(calledId + 1);
    appendTile(calledId + 2);
    row.replaceChildren(meld);
  }, { calledId: CALLED_ID, source: seats.source });

  const movingMeld = await waitForActor(page, (actor) => actor.zone === 'meld' && actor.motion !== null);
  expect(movingMeld.player).toBe(String(seats.owner));
  expect(movingMeld.motion).not.toBeNull();
  expectSameTransform(movingMeld.motion!.start, settledRiver);
  expect(movingMeld.motion!.duration).toBe(370);
  expect(movingMeld.motion!.arcHeight).toBeCloseTo(.46, 3);

  // Bottom-seat called tile turns sideways and uses the independently configured right-source gap.
  expect(Math.abs(movingMeld.motion!.target.yaw - Math.PI / 2)).toBeLessThan(.03);
  expect(movingMeld.motion!.target.x).toBeGreaterThan(5.98);
  expect(Math.abs(movingMeld.motion!.target.z - 4.48)).toBeLessThan(.02);

  const settledMeld = await waitForActor(page, (actor) => actor.zone === 'meld' && actor.motion === null);
  expectSameTransform(settledMeld.group, settledMeld.target);
  expect(settledMeld.tileId).toBe(CALLED_ID);
});
