import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

async function snapshot(page: Page, label: string) {
  return page.evaluate((sampleLabel) => {
    const dora = document.querySelector<HTMLElement>('.table-center .dora-row');
    const integrated = document.querySelector<HTMLElement>('.table-center .dora-row.center-dora-integrated');
    const center = document.querySelector<HTMLElement>('.table-center');
    const snap = (element: HTMLElement | null) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        className: element.className,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: style.width,
        height: style.height,
        scale: style.scale,
        translate: style.translate,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    };
    return {
      label: sampleLabel,
      now: performance.now(),
      rawDora: snap(dora),
      integratedDora: snap(integrated),
      center: snap(center),
    };
  }, label);
}

async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

test('WebKit phone landscape exposes integrated 2D Dora after enhancement frame', async ({ page, browserName }) => {
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

  const timeline = [];
  timeline.push(await snapshot(page, 'table-visible'));
  await nextFrame(page);
  timeline.push(await snapshot(page, 'raf-1'));
  await nextFrame(page);
  timeline.push(await snapshot(page, 'raf-2'));
  await page.waitForTimeout(50);
  timeline.push(await snapshot(page, 'plus-50ms'));
  console.log(`WEBKIT_DORA_TIMELINE ${JSON.stringify(timeline)}`);

  const final = timeline.at(-1)?.integratedDora;
  expect(final, JSON.stringify(timeline)).not.toBeNull();
  expect(final?.display, JSON.stringify(timeline)).not.toBe('none');
  expect(final?.visibility, JSON.stringify(timeline)).not.toBe('hidden');
  expect(Number(final?.opacity ?? 0), JSON.stringify(timeline)).toBeGreaterThan(.01);
  expect(final?.rect.width ?? 0, JSON.stringify(timeline)).toBeGreaterThan(1);
  expect(final?.rect.height ?? 0, JSON.stringify(timeline)).toBeGreaterThan(1);
});
