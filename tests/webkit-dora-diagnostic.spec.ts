import { expect, test } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

test('WebKit phone landscape exposes integrated 2D Dora geometry', async ({ page, browserName }) => {
  expect(browserName).toBe('webkit');
  await page.setViewportSize({ width: 844, height: 390 });
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
  const confirm = page.locator('[data-ui-action="confirm-new-game"]');
  if (await confirm.isVisible()) await confirm.click();
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);

  const audit = await page.evaluate(() => {
    const dora = document.querySelector<HTMLElement>('.table-center .dora-row.center-dora-integrated');
    const center = document.querySelector<HTMLElement>('.table-center');
    const table = document.querySelector<HTMLElement>('.mahjong-table');
    const snapshot = (element: HTMLElement | null) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        connected: element.isConnected,
        className: element.className,
        childCount: element.children.length,
        text: element.textContent?.trim() ?? '',
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        width: style.width,
        height: style.height,
        minHeight: style.minHeight,
        scale: style.scale,
        translate: style.translate,
        transform: style.transform,
        overflow: style.overflow,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
        clientRects: element.getClientRects().length,
      };
    };
    return {
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      dora: snapshot(dora),
      center: snapshot(center),
      table: snapshot(table),
      htmlOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  console.log(`WEBKIT_DORA_AUDIT ${JSON.stringify(audit)}`);
  expect(audit.dora, JSON.stringify(audit)).not.toBeNull();
  expect(audit.dora?.display, JSON.stringify(audit)).not.toBe('none');
  expect(audit.dora?.visibility, JSON.stringify(audit)).not.toBe('hidden');
  expect(Number(audit.dora?.opacity ?? 0), JSON.stringify(audit)).toBeGreaterThan(.01);
  expect(audit.dora?.rect.width ?? 0, JSON.stringify(audit)).toBeGreaterThan(1);
  expect(audit.dora?.rect.height ?? 0, JSON.stringify(audit)).toBeGreaterThan(1);
});
