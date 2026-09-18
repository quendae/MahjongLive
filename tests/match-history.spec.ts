import { expect, test } from '@playwright/test';

import {
  appendSingleDriveHistory,
  createMatchHistory,
  createSingleGame,
  driveSingleGame,
} from '../shared/src/engine/single';
import {
  buildMatchHistoryView,
  matchHistoryViewerMarkup,
} from '../client/src/match-history-view';

const QA_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const SAVE_KEY = 'mahjong-live:single:v1';
const HISTORY_KEY = 'mahjong-live:history:v1';
const SETUP_PENDING_KEY = 'mahjong-live:setup-pending:v1';

test('history viewer model exposes deterministic cursor state and step controls', () => {
  const initial = createSingleGame(0x10203040, 0, 'standard');
  const driven = driveSingleGame(initial);
  if (!driven.ok) throw new Error(driven.message);
  const history = appendSingleDriveHistory(createMatchHistory(initial), driven);

  const view = buildMatchHistoryView(history, history.entries.length);
  expect(view.cursor).toBe(history.entries.length);
  expect(view.totalSteps).toBe(history.entries.length);
  expect(view.roundNumber).toBe(driven.state.match.roundNumber);
  expect(view.points).toEqual(driven.state.match.round.players.map((player) => player.points));
  expect(view.rounds).toHaveLength(1);

  const html = matchHistoryViewerMarkup(view);
  expect(html).toContain('Match history');
  expect(html).toContain('data-history-action="start"');
  expect(html).toContain('data-history-action="prev"');
  expect(html).toContain('data-history-action="next"');
  expect(html).toContain('data-history-action="end"');
  expect(html).toContain('Step');
});

test('new game persists history separately and a legacy save still resumes without it', async ({ page }) => {
  await page.goto(QA_URL);
  await expect(page.locator('.setup-dialog')).toBeVisible();
  await page.locator('[data-ui-action="confirm-new-game"]').click();

  // Confirming the required setup must win over any hidden initial presentation work. If this key
  // remains set, reload intentionally returns to setup instead of resuming the accepted game.
  await expect.poll(() => page.evaluate((pendingKey) => localStorage.getItem(pendingKey), SETUP_PENDING_KEY)).toBeNull();

  // 2D/3D enhancement layers may replace presentation classes after startup, so persistence is the
  // stable contract here: both authoritative autosave and its separate history must reach storage.
  await expect.poll(() => page.evaluate(({ saveKey, historyKey }) =>
    localStorage.getItem(saveKey) !== null && localStorage.getItem(historyKey) !== null,
  { saveKey: SAVE_KEY, historyKey: HISTORY_KEY })).toBe(true);

  const saved = await page.evaluate(({ saveKey, historyKey }) => ({
    save: localStorage.getItem(saveKey),
    history: localStorage.getItem(historyKey),
  }), { saveKey: SAVE_KEY, historyKey: HISTORY_KEY });

  expect(saved.save).not.toBeNull();
  expect(saved.history).not.toBeNull();
  const savedState = JSON.parse(saved.save ?? '{}');
  const history = JSON.parse(saved.history ?? '{}');
  expect(history.version).toBe(1);
  expect(history.entries.length).toBeGreaterThan(0);

  await page.evaluate((historyKey) => localStorage.removeItem(historyKey), HISTORY_KEY);
  await page.reload();

  await expect(page.locator('.setup-dialog')).toHaveCount(0);
  await expect(page.getByText(`Seed ${savedState.seed}`, { exact: true })).toBeVisible();
});
