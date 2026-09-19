import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '0');
    localStorage.setItem('mahjong-live:renderer-backend:v1', 'webgl');
    localStorage.setItem('mahjong-live:preferences:v1', JSON.stringify({
      preferredDifficulty: 'standard',
      advisorEnabled: false,
      tutorialSeen: true,
      presentationSpeed: 'instant',
    }));
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-ui-action="confirm-new-game"]').click();
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });
}

async function setWaitFixture(page: Page, furiten: boolean): Promise<void> {
  await page.evaluate((isFuriten) => {
    const tags = document.querySelector<HTMLElement>('.player-bottom .player-tags');
    const opponent = document.querySelector<HTMLElement>('.player-top .opponent-hand');
    if (!tags || !opponent) throw new Error('Missing player fixture');

    tags.querySelectorAll('.tenpai-tag, .furiten-tag, .wait-hint').forEach((node) => node.remove());

    const status = document.createElement('span');
    status.className = `status-tag ${isFuriten ? 'furiten-tag' : 'tenpai-tag'}`;
    status.textContent = isFuriten ? 'Furiten' : 'Tenpai';
    tags.appendChild(status);

    const waits = document.createElement('span');
    waits.className = 'wait-hint';
    waits.innerHTML = `
      <span class="wait-hint-label">Wait</span>
      <span class="wait-tile" aria-label="3m"></span>
      <span class="wait-tile" aria-label="6m"></span>
    `;
    tags.appendChild(waits);

    const secret = document.createElement('span');
    secret.dataset.hiddenFixture = 'true';
    secret.textContent = 'SECRET-HIDDEN-9P';
    opponent.appendChild(secret);
  }, furiten);
}

async function setActionFixture(page: Page, actions: readonly string[]): Promise<void> {
  await page.evaluate((fixtureActions) => {
    document.querySelectorAll('.table-panel > .action-dock').forEach((dock) => dock.remove());
    const panel = document.querySelector<HTMLElement>('.table-panel');
    if (!panel) throw new Error('Missing table panel');
    const dock = document.createElement('div');
    dock.className = 'action-dock action-dock-compact';
    const buttons = fixtureActions.map((action) => {
      const label = action === 'daiminkan' ? 'Kan'
        : action === 'ankan' ? 'Closed Kan'
        : action === 'shouminkan' ? 'Added Kan'
        : action[0].toUpperCase() + action.slice(1);
      return `<button class="action-button" data-ui-action="${action}">${label}</button>`;
    }).join('');
    dock.innerHTML = `<div class="action-buttons">${buttons}</div>`;
    panel.appendChild(dock);
  }, actions);
}

test('teaches Tenpai using only the human wait tiles and never copies concealed opponent content', async ({ page }) => {
  await boot(page);
  await setWaitFixture(page, false);

  const teaching = page.locator('[data-contextual-teaching]');
  await expect(teaching).toBeVisible();
  await expect(teaching).toHaveAttribute('data-teaching-topic', 'waits');
  await expect(teaching).toContainText('Tenpai');
  await expect(teaching).toContainText('3m');
  await expect(teaching).toContainText('6m');
  await expect(teaching).not.toContainText('SECRET-HIDDEN-9P');
});

test('explains why Furiten blocks Ron while preserving the visible waits', async ({ page }) => {
  await boot(page);
  await setWaitFixture(page, true);

  const teaching = page.locator('[data-contextual-teaching]');
  await expect(teaching).toHaveAttribute('data-teaching-topic', 'furiten');
  await expect(teaching).toContainText('Furiten');
  await expect(teaching).toContainText('Ron');
  await expect(teaching).toContainText('3m');
  await expect(teaching).toContainText('6m');
});

test('explains only the legal reaction calls currently offered to the human', async ({ page }) => {
  await boot(page);
  await setActionFixture(page, ['chi', 'pon', 'daiminkan', 'pass']);

  const teaching = page.locator('[data-contextual-teaching]');
  await expect(teaching).toHaveAttribute('data-teaching-topic', 'calls');
  await expect(teaching).toContainText('Chi');
  await expect(teaching).toContainText('Pon');
  await expect(teaching).toContainText('Kan');
  await expect(teaching).toContainText('Pass');
  await expect(teaching).not.toContainText('Riichi');
});

test('explains legal Riichi and Kan turn options without changing the action dock', async ({ page }) => {
  await boot(page);
  await setActionFixture(page, ['riichi', 'ankan']);

  const teaching = page.locator('[data-contextual-teaching]');
  await expect(teaching).toHaveAttribute('data-teaching-topic', 'turn-options');
  await expect(teaching).toContainText('Riichi');
  await expect(teaching).toContainText('Closed Kan');
  await expect(page.locator('.action-dock [data-ui-action="riichi"]')).toBeVisible();
  await expect(page.locator('.action-dock [data-ui-action="ankan"]')).toBeVisible();
});

test('points a completed hand to the existing Yaku, Fu, Dora and payment breakdown', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell');
    if (!shell) throw new Error('Missing app shell');
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="dialog result-dialog">
        <div class="score-card">
          <details class="score-explanation"><summary>How this score was calculated</summary></details>
        </div>
      </div>
    `;
    shell.appendChild(overlay);
  });

  const teaching = page.locator('[data-contextual-teaching]');
  await expect(teaching).toHaveAttribute('data-teaching-topic', 'scoring');
  await expect(teaching).toContainText('Yaku');
  await expect(teaching).toContainText('Fu');
  await expect(teaching).toContainText('Dora');
  await expect(teaching).toContainText('Payment');
});
