import { expect, test, type Page } from '@playwright/test';
import { analyzePerformanceSample } from '../client/src/performance-diagnostics';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

type PerformanceSample = {
  loopHz?: number;
  rafHz?: number;
  frameMs?: number;
  rafFrameMs?: number;
  renderMs?: number;
  gpuMs?: number | null;
  actors?: number;
  instancedRivers?: number;
  batchedFaces?: number;
  rendererBackend?: string;
  loopRafRatio?: number;
  schedulerGapHz?: number;
  frameBudgetMs?: number;
  cpuBudgetRatio?: number;
  gpuBudgetRatio?: number | null;
  diagnosticHint?: string;
  syncActorsMs?: number;
  reconcileMs?: number;
  staticBatchMs?: number;
  shadowRefreshSerial?: number;
};

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
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click());
  await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
  await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

async function nextPerformanceSample(page: Page): Promise<PerformanceSample> {
  const sample = await page.evaluate(() => new Promise<Record<string, unknown> | null>((resolve) => {
    document.body.classList.add('perf-capture-active');
    const timeout = window.setTimeout(() => {
      window.removeEventListener('mahjong-live:fps', receive as EventListener);
      resolve(null);
    }, 2200);
    const receive = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener('mahjong-live:fps', receive as EventListener);
      resolve((event as CustomEvent<Record<string, unknown>>).detail ?? null);
    };
    window.addEventListener('mahjong-live:fps', receive as EventListener);
  }));
  expect(sample, '3D renderer should emit a performance sample while capture is active').not.toBeNull();
  return sample as PerformanceSample;
}

test('classifies a low-cost 32 Hz Three loop against a 120 Hz browser RAF as an animation-loop gap', () => {
  const result = analyzePerformanceSample({
    loopHz: 32,
    rafHz: 120,
    renderMs: 0.60,
    rafFrameMs: 8.33,
    gpuMs: null,
  });

  expect(result.loopRafRatio).toBeCloseTo(32 / 120, 4);
  expect(result.schedulerGapHz).toBeCloseTo(88, 3);
  expect(result.frameBudgetMs).toBeCloseTo(8.33, 2);
  expect(result.cpuBudgetRatio).toBeCloseTo(0.60 / 8.33, 3);
  expect(result.diagnosticHint).toBe('animation-loop-gap');
});

test('classifies a low browser RAF ceiling separately from a Three-loop gap', () => {
  const result = analyzePerformanceSample({
    loopHz: 31,
    rafHz: 32,
    renderMs: 0.55,
    rafFrameMs: 31.25,
    gpuMs: null,
  });

  expect(result.loopRafRatio).toBeGreaterThan(0.95);
  expect(result.diagnosticHint).toBe('browser-raf-limit');
});

test('reports headroom when the Three loop tracks 120 Hz RAF with low CPU and GPU cost', () => {
  const result = analyzePerformanceSample({
    loopHz: 118,
    rafHz: 120,
    renderMs: 1.20,
    rafFrameMs: 8.33,
    gpuMs: 2.10,
  });

  expect(result.loopRafRatio).toBeGreaterThan(0.95);
  expect(result.gpuBudgetRatio).toBeCloseTo(2.10 / 8.33, 3);
  expect(result.diagnosticHint).toBe('headroom');
});

test('performance telemetry separates Three-loop throughput from browser RAF headroom', async ({ page }) => {
  await boot3d(page);
  const sample = await nextPerformanceSample(page);

  expect(sample.rendererBackend).toBe('webgl');
  expect(sample.loopHz).toBeGreaterThan(0);
  expect(sample.rafHz).toBeGreaterThan(0);
  expect(sample.loopRafRatio).toEqual(expect.any(Number));
  expect(sample.schedulerGapHz).toEqual(expect.any(Number));
  expect(sample.frameBudgetMs).toEqual(expect.any(Number));
  expect(sample.cpuBudgetRatio).toEqual(expect.any(Number));
  expect(sample.diagnosticHint).toMatch(/^(animation-loop-gap|browser-raf-limit|gpu-bound|cpu-submit-bound|headroom)$/);
  expect(sample.syncActorsMs).toEqual(expect.any(Number));
  expect(sample.reconcileMs).toEqual(expect.any(Number));
  expect(sample.shadowRefreshSerial).toEqual(expect.any(Number));
});

test('24-discards-per-river stress telemetry stays batched and reports static rebuild cost', async ({ page }) => {
  await boot3d(page);
  await page.evaluate(() => {
    document.body.classList.add('perf-capture-active');
    window.dispatchEvent(new CustomEvent('mahjong-live:dev-stress-discards', { detail: { enabled: true } }));
  });
  await page.waitForTimeout(150);
  const sample = await nextPerformanceSample(page);

  expect(sample.actors).toBeGreaterThanOrEqual(96);
  expect(sample.instancedRivers).toBeGreaterThanOrEqual(80);
  expect(sample.batchedFaces).toBeGreaterThanOrEqual(80);
  expect(sample.staticBatchMs).toEqual(expect.any(Number));
  expect(sample.staticBatchMs).toBeGreaterThanOrEqual(0);
  expect(sample.loopRafRatio).toEqual(expect.any(Number));
  expect(sample.diagnosticHint).toEqual(expect.any(String));
});
