import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

async function boot3d(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '1');
    localStorage.setItem('mahjong-live:renderer-backend:v1', 'webgl');
    localStorage.setItem('mahjong-live:tile-face-mode:v1', 'beginner');
    localStorage.setItem('mahjong-live:preferences:v1', JSON.stringify({
      preferredDifficulty: 'standard',
      advisorEnabled: false,
      tutorialSeen: true,
      presentationSpeed: 'instant',
    }));
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click();
  });
  await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
  await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
  await page.waitForTimeout(250);
}

test('3D runtime exposes a geometry snapshot for discard, hover and seat-orientation audits', async ({ page }) => {
  await boot3d(page);

  const snapshot = await page.evaluate(() => new Promise<any | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 800);
    const receive = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener('mahjong-live:3d-audit', receive);
      resolve((event as CustomEvent).detail ?? null);
    };
    window.addEventListener('mahjong-live:3d-audit', receive);
    window.dispatchEvent(new Event('mahjong-live:3d-audit-request'));
  }));

  expect(snapshot, '3D renderer should answer an explicit audit request').not.toBeNull();
  expect(snapshot.actors.length).toBeGreaterThan(20);
  expect(new Set(snapshot.actors.map((actor: any) => actor.side))).toEqual(new Set(['bottom', 'top', 'left', 'right']));
});
