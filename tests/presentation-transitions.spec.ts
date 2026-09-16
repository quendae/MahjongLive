import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '0');
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
}

test('new Dora indicator gets one reveal beat while existing indicators stay still', async ({ page }) => {
  await boot(page);

  const baseline = await page.locator('.dora-row .tile').count();
  expect(baseline).toBeGreaterThan(0);

  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const row = document.querySelector<HTMLElement>('.dora-row');
    if (!shell || !row) throw new Error('Missing presentation shell or Dora row');
    shell.classList.add('is-presenting');
    const tile = document.createElement('div');
    tile.className = 'tile tile-compact';
    tile.dataset.transitionTestDora = 'true';
    tile.innerHTML = '<span></span>';
    row.append(tile);
  });

  const revealed = page.locator('[data-transition-test-dora="true"]');
  await expect(revealed).toHaveClass(/dora-revealed/);
  await expect(page.locator('.dora-row .tile').first()).not.toHaveClass(/dora-revealed/);
  const animation = await revealed.evaluate((element) => getComputedStyle(element).animationName);
  expect(animation).toContain('dora-reveal');
});

test('Ron announcement remains visible through the winning frame and hands off to an animated result', async ({ page }) => {
  await boot(page);

  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const table = document.querySelector<HTMLElement>('.mahjong-table');
    if (!shell || !table) throw new Error('Missing presentation shell or table');
    shell.classList.add('is-presenting');
    const bubble = document.createElement('div');
    bubble.className = 'call-bubble call-bubble-bottom call-bubble-ron';
    bubble.innerHTML = '<strong>RON</strong><span>Bot 1</span>';
    table.append(bubble);
  });
  await expect(page.locator('.call-bubble-ron')).toHaveCount(1);

  // Simulate the next authoritative HandWon frame: main.ts rerenders without a call bubble while
  // presentationLocked remains true. The transition layer should bridge that otherwise blank hold.
  await page.locator('.call-bubble-ron').evaluate((element) => element.remove());
  const held = page.locator('.call-bubble-held');
  await expect(held).toHaveCount(1);
  await expect(held.locator('strong')).toHaveText('RON');
  await expect(held.locator('span')).toHaveText('Bot 1');

  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (!shell) throw new Error('Missing shell');
    shell.classList.remove('is-presenting');
    document.querySelector('.call-bubble-held')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = '<div class="dialog result-dialog"><h2>Hand complete</h2></div>';
    shell.append(overlay);
  });

  await expect(held).toHaveCount(0);
  const resultAnimation = await page.locator('.result-dialog').evaluate((element) => getComputedStyle(element).animationName);
  expect(resultAnimation).toContain('result-dialog-in');
});
