import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const CROSS_BROWSER_PROFILES = [
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
] as const;

async function prepareStorage(page: Page, mode: '2d' | '3d'): Promise<void> {
  await page.addInitScript(({ mode }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', mode === '3d' ? '1' : '0');
    localStorage.setItem('mahjong-live:renderer-backend:v1', 'webgl');
    localStorage.setItem('mahjong-live:tile-face-mode:v1', 'beginner');
    localStorage.setItem('mahjong-live:preferences:v1', JSON.stringify({
      preferredDifficulty: 'standard',
      advisorEnabled: false,
      tutorialSeen: true,
      presentationSpeed: 'instant',
    }));
  }, { mode });
}

async function boot(page: Page, mode: '2d' | '3d', touch = false): Promise<void> {
  await prepareStorage(page, mode);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  const confirm = page.locator('[data-ui-action="confirm-new-game"]');
  if (await confirm.isVisible()) {
    if (touch) await confirm.tap();
    else await confirm.click();
  }
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });

  if (mode === '3d') {
    await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
    await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
    await page.waitForTimeout(450);
  } else {
    await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-active/);
  }
}

async function expectLayoutInsideViewport(page: Page, mode: '2d' | '3d'): Promise<void> {
  const audit = await page.evaluate((tableMode) => {
    const table = document.querySelector<HTMLElement>('.mahjong-table');
    const center = document.querySelector<HTMLElement>('.table-center');
    const stage = document.querySelector<HTMLElement>('#table-3d-stage');
    const dora = tableMode === '3d'
      ? document.querySelector<HTMLElement>('#table-3d-stage .table-dora-tray')
      : document.querySelector<HTMLElement>('.table-center .dora-row.center-dora-integrated');
    if (!table || !center) return { error: 'missing table or center' };

    const tableRect = table.getBoundingClientRect();
    const centerRect = center.getBoundingClientRect();
    const visible = (element: HTMLElement | null) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .01
        && rect.width > 1 && rect.height > 1;
    };

    return {
      error: '',
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tableLeft: tableRect.left,
      tableRight: tableRect.right,
      viewportWidth: innerWidth,
      centerVisible: visible(center),
      centerWidth: centerRect.width,
      centerHeight: centerRect.height,
      doraVisible: visible(dora),
      stageActive: tableMode === '2d' || Boolean(stage?.classList.contains('is-active')),
    };
  }, mode);

  expect(audit.error).toBe('');
  expect(audit.overflow).toBeLessThanOrEqual(2);
  expect(audit.tableLeft).toBeGreaterThanOrEqual(-4);
  expect(audit.tableRight).toBeLessThanOrEqual(audit.viewportWidth + 4);
  expect(audit.centerVisible).toBe(true);
  expect(audit.centerWidth).toBeGreaterThan(80);
  expect(audit.centerHeight).toBeGreaterThan(80);
  expect(audit.doraVisible).toBe(true);
  expect(audit.stageActive).toBe(true);
}

for (const profile of CROSS_BROWSER_PROFILES) {
  for (const mode of ['2d', '3d'] as const) {
    test(`@cross-browser ${profile.name} ${mode} keeps the table usable`, async ({ page, browserName }) => {
      expect(['firefox', 'webkit']).toContain(browserName);
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await boot(page, mode);
      await expectLayoutInsideViewport(page, mode);
    });
  }
}

test.describe('mobile touch', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('@touch uses real taps for game setup, Options and a human discard without overflow', async ({ page }) => {
    await prepareStorage(page, '2d');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);

    const confirm = page.locator('[data-ui-action="confirm-new-game"]');
    await expect(confirm).toBeVisible();
    await confirm.tap();
    await page.locator('.mahjong-table').waitFor({ state: 'visible' });

    const options = page.locator('.appearance-toggle');
    await expect(options).toBeVisible();
    await options.tap();
    await expect(page.locator('.appearance-overlay')).toBeVisible();
    await page.locator('button[data-ui-scale="large"]').tap();
    await expect(page.locator('button[data-ui-scale="large"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.appearance-done').tap();
    await expect(page.locator('.appearance-overlay')).toBeHidden();

    const handTile = page.locator('#human-hand .tile-clickable').first();
    await expect(handTile).toBeVisible({ timeout: 5_000 });
    const before = await page.locator('.player-bottom .discard-river > .tile:not(.tile-called)').count();
    await handTile.tap();
    await expect.poll(
      () => page.locator('.player-bottom .discard-river > .tile:not(.tile-called)').count(),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);

    const viewport = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 2);

    // Touch users must never need a hover-only state to reach the main controls.
    await expect(options).toBeVisible();
    await expect(page.locator('.mahjong-table')).toBeVisible();
  });
});
