import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const UI_SCALE_KEY = 'mahjong-live:ui-scale:v1';

async function boot2d(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '0');
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
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click());
  await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-active/);
}

async function chooseScale(page: Page, scale: 'compact' | 'normal' | 'large' | 'extra-large'): Promise<void> {
  await page.locator('.appearance-toggle').click();
  await page.locator(`button[data-ui-scale="${scale}"]`).click();
  await page.locator('.appearance-done').click();
}

test('Options exposes persistent Compact, Normal, Large and Extra large UI scale presets', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot2d(page);

  const optionsButton = page.locator('.appearance-toggle');
  const before = await optionsButton.evaluate((element) => element.getBoundingClientRect().height);
  await optionsButton.click();

  const presets = page.locator('button[data-ui-scale]');
  await expect(presets).toHaveCount(4);
  await expect(page.locator('button[data-ui-scale="normal"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('button[data-ui-scale="large"]').click();
  await expect(page.locator('button[data-ui-scale="large"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.appearance-done').click();

  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), UI_SCALE_KEY)).toBe('large');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.uiScale)).toBe('large');
  const after = await optionsButton.evaluate((element) => element.getBoundingClientRect().height);
  expect(after).toBeGreaterThan(before);

  const reopened = await page.context().newPage();
  await reopened.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await reopened.locator('.mahjong-table').waitFor({ state: 'visible' });
  await expect.poll(() => reopened.evaluate(() => document.documentElement.dataset.uiScale)).toBe('large');
  await reopened.close();
});

test('Escape closes Options and restores focus to the Options button', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot2d(page);

  const optionsButton = page.locator('.appearance-toggle');
  await optionsButton.click();
  await expect(page.locator('.appearance-overlay')).toBeVisible();
  await expect(page.locator('.appearance-close')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('.appearance-overlay')).toBeHidden();
  await expect(optionsButton).toBeFocused();
});

test('Extra large scales UI without scaling the 2D table or causing horizontal page overflow', async ({ page }) => {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await boot2d(page);

    const before = await page.locator('.mahjong-table').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    await chooseScale(page, 'extra-large');

    const state = await page.evaluate(() => {
      const table = document.querySelector<HTMLElement>('.mahjong-table');
      if (!table) throw new Error('Missing table');
      const rect = table.getBoundingClientRect();
      return {
        table: { width: rect.width, height: rect.height },
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    expect(state.table.width).toBeCloseTo(before.width, 0);
    expect(state.table.height).toBeCloseTo(before.height, 0);
    expect(state.scrollWidth, `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(state.clientWidth + 1);
  }
});
