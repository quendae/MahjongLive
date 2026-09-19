import { expect, test, type Page } from '@playwright/test';

import {
  appendSingleDriveHistory,
  createMatchHistory,
  createSingleGame,
  driveSingleGame,
} from '../shared/src/engine/single';

const QA_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const SAVE_KEY = 'mahjong-live:single:v1';
const HISTORY_KEY = 'mahjong-live:history:v1';

type AuditActor = {
  zone: 'hand' | 'river' | 'rack' | 'meld';
};

type AuditSnapshot = {
  actors: AuditActor[];
};

function replayFixture() {
  const initial = createSingleGame(0x3300aa55, 1, 'standard');
  const driven = driveSingleGame(initial);
  if (!driven.ok) throw new Error(driven.message);
  const history = appendSingleDriveHistory(createMatchHistory(initial), driven);
  const liveDiscards = driven.state.match.round.players.reduce(
    (total, player) => total + player.discards.length,
    0,
  );
  expect(history.entries.length).toBeGreaterThan(0);
  expect(liveDiscards).toBeGreaterThan(0);
  return { state: driven.state, history, liveDiscards };
}

async function bootSavedMatch(page: Page, use3d: boolean) {
  const fixture = replayFixture();
  await page.addInitScript(({ saveKey, historyKey, save, history, use3d }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(saveKey, save);
    localStorage.setItem(historyKey, history);
    localStorage.setItem('mahjong-live:preferences:v1', JSON.stringify({
      preferredDifficulty: 'standard',
      advisorEnabled: false,
      tutorialSeen: true,
      presentationSpeed: 'instant',
    }));
    localStorage.setItem('mahjong-live:table-3d:v1', use3d ? '1' : '0');
    if (use3d) {
      localStorage.setItem('mahjong-live:renderer-backend:v1', 'webgl');
      localStorage.setItem('mahjong-live:tile-face-mode:v1', 'beginner');
    }
  }, {
    saveKey: SAVE_KEY,
    historyKey: HISTORY_KEY,
    save: JSON.stringify(fixture.state),
    history: JSON.stringify(fixture.history),
    use3d,
  });
  await page.goto(QA_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.setup-dialog')).toHaveCount(0);
  await expect(page.locator('[data-visual-replay-open]')).toBeVisible();
  return fixture;
}

async function replayStep(page: Page): Promise<number> {
  const text = await page.locator('.visual-replay-status strong').first().textContent();
  return Number(text ?? 'NaN');
}

async function audit3d(page: Page): Promise<AuditSnapshot> {
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
  expect(snapshot).not.toBeNull();
  return snapshot as AuditSnapshot;
}

async function waitForRiverActors(page: Page, count: number): Promise<AuditSnapshot> {
  const deadline = Date.now() + 2400;
  let latest = await audit3d(page);
  while (latest.actors.filter((actor) => actor.zone === 'river').length !== count && Date.now() < deadline) {
    await page.waitForTimeout(30);
    latest = await audit3d(page);
  }
  expect(latest.actors.filter((actor) => actor.zone === 'river')).toHaveLength(count);
  return latest;
}

test('visual replay renders the selected history cursor on the live 2D table without mutating autosave', async ({ page }) => {
  const fixture = await bootSavedMatch(page, false);
  const originalSave = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-active/);
  expect(await page.locator('.discard-river .tile').count()).toBe(fixture.liveDiscards);

  await page.locator('[data-visual-replay-open]').click();
  await expect(page.locator('[data-visual-replay-panel]')).toBeVisible();
  await expect(page.locator('[data-history-action="play"]')).toBeVisible();
  await expect(page.locator('[data-visual-replay-round-cursor]')).toHaveCount(1);
  const speed = page.locator('[data-visual-replay-speed]');
  await expect(speed).toBeVisible();
  await expect(speed).toHaveValue('1');
  await expect(speed.locator('option')).toHaveCount(4);
  await speed.selectOption('4');
  await expect(speed).toHaveValue('4');
  await page.locator('[data-history-action="start"]').click();

  await expect(page.locator('[data-visual-replay-table] .discard-river .tile')).toHaveCount(0);
  await expect(page.locator('[data-visual-replay-table] [data-tile-id]')).toHaveCount(0);
  expect(await replayStep(page)).toBe(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(originalSave);

  const play = page.locator('[data-history-action="play"]');
  await play.click();
  await expect(play).toHaveText('Pause');
  await page.waitForTimeout(500);
  expect(await replayStep(page)).toBeGreaterThanOrEqual(2);
  await play.click();
  await expect(play).toHaveText('Play');
  const pausedStep = await replayStep(page);
  await page.waitForTimeout(700);
  expect(await replayStep(page)).toBe(pausedStep);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(originalSave);

  await page.locator('[data-visual-replay-close]').click();
  await expect(page.locator('[data-visual-replay-panel]')).toHaveCount(0);
  expect(await page.locator('.discard-river .tile').count()).toBe(fixture.liveDiscards);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(originalSave);
});

test('3D renderer follows the same visual replay cursor as the 2D table', async ({ page }) => {
  test.setTimeout(60_000);

  const fixture = await bootSavedMatch(page, true);
  await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
  await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
  await waitForRiverActors(page, fixture.liveDiscards);
  const originalSave = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);

  await page.locator('[data-visual-replay-open]').click();
  await page.locator('[data-history-action="start"]').click();
  await waitForRiverActors(page, 0);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(originalSave);

  await page.locator('[data-visual-replay-close]').click();
  await waitForRiverActors(page, fixture.liveDiscards);
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe(originalSave);
});
