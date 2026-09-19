import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

async function boot(page: Page, threeD: boolean): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((use3d) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', use3d ? '1' : '0');
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
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click());
  await expect(page.locator('.table-center')).toHaveClass(/classic-table-counter/, { timeout: 15_000 });
}

for (const threeD of [false, true]) {
  test(`${threeD ? '3D' : '2D'} center exposes dealer, honba, draws and a classic riichi-pot stick`, async ({ page }) => {
    await boot(page, threeD);
    const panel = page.locator('.table-center .table-state-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.table-state-dealer')).toContainText('Dealer');
    await expect(panel.locator('.table-state-honba .counter-stick')).toBeVisible();
    await expect(panel.locator('.table-state-riichi .riichi-stick')).toBeVisible();
    await expect(panel.locator('.table-state-draws')).toContainText('Draws');
    await expect(page.locator('.table-center .center-meta')).toHaveClass(/clarity-source-hidden/);

    const dealerName = await page.locator('.player-zone').evaluateAll((zones) => {
      const dealer = zones.find((zone) => zone.querySelector('.dealer-tag'));
      return dealer?.querySelector('.player-name')?.textContent?.trim() ?? '';
    });
    expect(dealerName).not.toBe('');
    await expect(panel.locator('.table-state-dealer strong')).toHaveText(dealerName);
  });
}

test('counter refreshes numeric table state and marks a declared-riichi seat with a stick', async ({ page }) => {
  await boot(page, false);

  await page.evaluate(() => {
    const center = document.querySelector<HTMLElement>('.table-center');
    const meta = center?.querySelectorAll<HTMLElement>('.center-meta > span');
    const zone = document.querySelector<HTMLElement>('.player-bottom');
    if (!center || !meta || meta.length < 3 || !zone) throw new Error('Missing table-state fixture');
    meta[0].textContent = '2 honba';
    meta[1].textContent = '3 riichi sticks';
    meta[2].textContent = '51 draws';
    const tags = zone.querySelector<HTMLElement>('.player-tags');
    if (!tags) throw new Error('Missing player tags');
    const riichi = document.createElement('span');
    riichi.className = 'status-tag riichi-tag';
    riichi.textContent = 'Riichi';
    tags.appendChild(riichi);
    center.querySelector('.table-state-panel')?.remove();
    center.querySelector('.counter-score-ring')?.remove();
    center.appendChild(document.createComment('force clarity refresh'));
  });

  const panel = page.locator('.table-center .table-state-panel');
  await expect(panel).toHaveAttribute('data-honba', '2');
  await expect(panel).toHaveAttribute('data-riichi-sticks', '3');
  await expect(panel).toHaveAttribute('data-draws', '51');
  await expect(panel.locator('.table-state-honba strong')).toHaveText('2');
  await expect(panel.locator('.table-state-riichi strong')).toHaveText('3');
  await expect(panel.locator('.table-state-draws strong')).toHaveText('51');

  const bottomScore = page.locator('.counter-score-bottom');
  await expect(bottomScore).toHaveClass(/is-riichi/);
  await expect(bottomScore.locator('.counter-riichi-stick')).toBeVisible();
});

test('3D Dora HUD stays mounted through a discard rerender instead of blinking out with the table DOM', async ({ page }) => {
  await boot(page, true);
  await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
  await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });

  const tray = page.locator('.table-dora-tray');
  await expect(tray).toBeVisible();
  await tray.evaluate((element) => { element.dataset.persistenceProbe = 'stable-dora'; });

  const acted = await page.evaluate(() => {
    const tile = document.querySelector<HTMLElement>('.human-hand [data-tile-id]');
    if (!tile) return false;
    tile.click();
    return true;
  });
  expect(acted, 'new game should stop at a human discard prompt').toBe(true);

  await page.waitForTimeout(180);
  await expect(page.locator('.table-dora-tray')).toBeVisible();
  await expect(page.locator('.table-dora-tray[data-persistence-probe="stable-dora"]')).toHaveCount(1);
});

for (const threeD of [false, true]) {
  test(`${threeD ? '3D' : '2D'} desktop center counter uses readable geometry and text`, async ({ page }) => {
    await boot(page, threeD);
    if (threeD) {
      await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
    }

    const metrics = await page.locator('.table-center').evaluate((center) => {
      const rect = center.getBoundingClientRect();
      const title = center.querySelector<HTMLElement>('.round-title');
      const value = center.querySelector<HTMLElement>('.table-state-item > strong');
      const label = center.querySelector<HTMLElement>('.table-state-item > small');
      return {
        width: rect.width,
        height: rect.height,
        titlePx: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
        valuePx: value ? parseFloat(getComputedStyle(value).fontSize) : 0,
        labelPx: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
      };
    });

    if (threeD) {
      expect(metrics.width).toBeGreaterThanOrEqual(330);
      expect(metrics.height).toBeGreaterThanOrEqual(280);
      expect(metrics.titlePx).toBeGreaterThanOrEqual(40);
    } else {
      expect(metrics.width).toBeGreaterThanOrEqual(316);
      expect(metrics.height).toBeGreaterThanOrEqual(316);
      expect(metrics.titlePx).toBeGreaterThanOrEqual(42);
    }
    expect(metrics.valuePx).toBeGreaterThanOrEqual(11);
    expect(metrics.labelPx).toBeGreaterThanOrEqual(7);
  });
}
