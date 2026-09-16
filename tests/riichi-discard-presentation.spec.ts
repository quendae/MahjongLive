import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const PI = Math.PI;

type AuditActor = {
  zone: 'hand' | 'river' | 'rack' | 'meld';
  side: 'bottom' | 'top' | 'left' | 'right';
  tileId: number | null;
  target: { yaw: number };
};
type AuditSnapshot = { actors: AuditActor[] };

async function boot(page: Page, threeD: boolean): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((enable3d) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', enable3d ? '1' : '0');
    localStorage.setItem('mahjong-live:renderer-backend:v1', 'webgl');
    localStorage.setItem('mahjong-live:preferences:v1', JSON.stringify({
      preferredDifficulty: 'standard',
      advisorEnabled: false,
      tutorialSeen: true,
      presentationSpeed: 'instant',
    }));
  }, threeD);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click();
  });
  if (threeD) {
    await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
    await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
  }
  await page.waitForTimeout(350);
}

async function installSyntheticRiichiMarker(page: Page): Promise<{ declarationId: number; fallbackId: number }> {
  return page.evaluate(() => {
    const rivers = [...document.querySelectorAll<HTMLElement>('.discard-river')];
    const river = rivers.find((candidate) => candidate.querySelectorAll<HTMLElement>('.tile[data-engine-tile-id]').length >= 2);
    if (!river) throw new Error('Need a river with at least two physical discards');
    const tiles = [...river.querySelectorAll<HTMLElement>('.tile[data-engine-tile-id]')];
    const declaration = tiles[0];
    const fallback = tiles[1];
    const declarationId = Number(declaration.dataset.engineTileId);
    const fallbackId = Number(fallback.dataset.engineTileId);
    if (!Number.isFinite(declarationId) || !Number.isFinite(fallbackId)) throw new Error('Missing physical tile ids');

    declaration.dataset.riichiDeclaration = 'true';
    declaration.classList.add('tile-called');
    fallback.classList.remove('tile-called');

    // clarity.ts observes child-list changes; poke the authoritative app subtree after changing metadata.
    const ping = document.createElement('i');
    ping.hidden = true;
    river.appendChild(ping);
    ping.remove();
    return { declarationId, fallbackId };
  });
}

async function audit(page: Page): Promise<AuditSnapshot> {
  const snapshot = await page.evaluate(() => new Promise<any | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 1200);
    const receive = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener('mahjong-live:3d-audit', receive);
      resolve((event as CustomEvent).detail ?? null);
    };
    window.addEventListener('mahjong-live:3d-audit', receive);
    window.dispatchEvent(new Event('mahjong-live:3d-audit-request'));
  }));
  expect(snapshot).not.toBeNull();
  return snapshot as AuditSnapshot;
}

function seatYaw(side: AuditActor['side']): number {
  if (side === 'top') return PI;
  if (side === 'left') return -PI / 2;
  if (side === 'right') return PI / 2;
  return 0;
}

function angleDistance(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

test('2D transfers the sideways Riichi marker when the declaration discard was called', async ({ page }) => {
  await boot(page, false);
  const { declarationId, fallbackId } = await installSyntheticRiichiMarker(page);

  const declaration = page.locator(`.tile[data-engine-tile-id="${declarationId}"]`);
  const fallback = page.locator(`.tile[data-engine-tile-id="${fallbackId}"]`);
  await expect(declaration).not.toHaveClass(/tile-riichi-discard/);
  await expect(fallback).toHaveClass(/tile-riichi-discard/);
  await expect(fallback).toHaveCSS('transform', /matrix/);
});

test('3D uses the same effective marker and rotates it exactly 90 degrees from its seat yaw', async ({ page }) => {
  await boot(page, true);
  const { fallbackId } = await installSyntheticRiichiMarker(page);
  await expect(page.locator(`.tile[data-engine-tile-id="${fallbackId}"]`)).toHaveClass(/tile-riichi-discard/);
  await page.waitForTimeout(120);

  const snapshot = await audit(page);
  const actor = snapshot.actors.find((candidate) => candidate.zone === 'river' && candidate.tileId === fallbackId);
  expect(actor).toBeTruthy();
  const expected = seatYaw(actor!.side) + PI / 2;
  expect(angleDistance(actor!.target.yaw, expected)).toBeLessThan(.02);
});
