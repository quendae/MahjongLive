import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const CROSS_BROWSER_PROFILES = [
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'phone-portrait', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
] as const;
type BootMode = '2d' | '3d' | '2d-fallback';

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

async function webglAvailable(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const webgl2 = document.createElement('canvas');
    const webgl = document.createElement('canvas');
    try {
      return Boolean(webgl2.getContext('webgl2') || webgl.getContext('webgl'));
    } catch {
      return false;
    }
  });
}

async function collect3dStartupDiagnostics(page: Page, messages: string[]): Promise<Record<string, unknown>> {
  const pageState = await page.evaluate(() => {
    const webglCanvas = document.createElement('canvas');
    const webgl2Canvas = document.createElement('canvas');
    let webgl = false;
    let webgl2 = false;
    let webglError = '';
    let webgl2Error = '';
    try { webgl = Boolean(webglCanvas.getContext('webgl')); } catch (error) { webglError = String(error); }
    try { webgl2 = Boolean(webgl2Canvas.getContext('webgl2')); } catch (error) { webgl2Error = String(error); }
    const button = document.querySelector<HTMLElement>('.table-3d-toggle');
    const fallback = document.querySelector<HTMLElement>('.table-3d-fallback-note');
    const table = document.querySelector<HTMLElement>('.mahjong-table');
    const stage = document.querySelector<HTMLElement>('#table-3d-stage');
    return {
      userAgent: navigator.userAgent,
      webgl,
      webgl2,
      webglError,
      webgl2Error,
      modeStorage: localStorage.getItem('mahjong-live:table-3d:v1'),
      backendStorage: localStorage.getItem('mahjong-live:renderer-backend:v1'),
      webgpuFallback: sessionStorage.getItem('mahjong-live:webgpu-fallback'),
      tableClass: table?.className ?? null,
      stageClass: stage?.className ?? null,
      modeButtonClass: button?.className ?? null,
      modeButtonText: button?.textContent?.trim() ?? null,
      modeButtonTitle: button?.title ?? null,
      fallbackText: fallback?.textContent?.trim() ?? null,
    };
  });
  return { ...pageState, console: messages };
}

async function boot(page: Page, mode: '2d' | '3d', touch = false): Promise<BootMode> {
  const startupMessages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      startupMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => startupMessages.push(`pageerror: ${error.message}`));

  await prepareStorage(page, mode);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  const confirm = page.locator('[data-ui-action="confirm-new-game"]');
  if (await confirm.isVisible()) {
    if (touch) await confirm.tap();
    else await confirm.click();
  }
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });

  if (mode === '3d') {
    const supportsWebGl = await webglAvailable(page);
    if (!supportsWebGl) {
      const fallback = page.locator('.table-3d-fallback-note');
      const button = page.locator('.table-3d-toggle');
      await expect(fallback).toBeVisible({ timeout: 5_000 });
      await expect(fallback).toContainText('3D renderer unavailable');
      await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-active/);
      await expect(page.locator('#table-3d-stage')).not.toHaveClass(/is-active/);
      await expect(button).toHaveClass(/is-error/);
      await expect(button).not.toHaveClass(/is-loading/);
      await expect(button).toContainText('2D · 3D unavailable');
      return '2d-fallback';
    }

    try {
      await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
      await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
    } catch (error) {
      const diagnostics = await collect3dStartupDiagnostics(page, startupMessages);
      throw new Error(`3D renderer did not activate despite WebGL support: ${JSON.stringify(diagnostics)}\n${error instanceof Error ? error.message : String(error)}`);
    }
    await page.waitForTimeout(450);
    return '3d';
  }

  await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-active/);
  return '2d';
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
      const actualMode = await boot(page, mode);
      if (mode === '3d' && actualMode === '2d-fallback') {
        expect(await webglAvailable(page)).toBe(false);
      }
      await expectLayoutInsideViewport(page, actualMode === '3d' ? '3d' : '2d');
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
