import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const DEV_UI_KEY = 'mahjong-live:dev-ui-layout:v2';

async function boot2d(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '0');
    localStorage.setItem('mahjong-live:renderer-backend:v1', 'webgl');
    localStorage.setItem('mahjong-live:tile-face-mode:v1', 'classic');
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
  await expect(page.locator('.table-center')).toHaveClass(/table-center-core/);
}

async function populateGeometryTargets(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const river = document.querySelector<HTMLElement>(`.player-${side} .discard-river`);
      if (!river) throw new Error(`Missing ${side} river`);
      const count = side === 'left' || side === 'right' ? 7 : 6;
      river.replaceChildren(...Array.from({ length: count }, () => {
        const tile = document.createElement('div');
        tile.className = 'tile tile-compact';
        tile.innerHTML = '<span></span>';
        return tile;
      }));
    }
    const meld = document.querySelector<HTMLElement>('.player-bottom .human-melds');
    if (!meld) throw new Error('Missing human meld row');
    meld.replaceChildren(...Array.from({ length: 4 }, () => {
      const tile = document.createElement('div');
      tile.className = 'tile tile-compact';
      tile.innerHTML = '<span></span>';
      return tile;
    }));
  });
  await page.waitForTimeout(120);
}

function closeEnough(a: number, b: number, tolerance = 1.25): boolean {
  return Math.abs(a - b) <= tolerance;
}

test('2D center is square, rivers touch matching corners, and all table tiles share one size', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);
  await populateGeometryTargets(page);

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    };
    const physicalSize = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return { width: element.offsetWidth, height: element.offsetHeight };
    };
    return {
      center: rect('.table-center'),
      top: rect('.player-top .discard-river'),
      right: rect('.player-right .discard-river'),
      bottom: rect('.player-bottom .discard-river'),
      left: rect('.player-left .discard-river'),
      sizes: [
        physicalSize('.human-hand .tile'),
        physicalSize('.player-top .opponent-hand .tile'),
        physicalSize('.player-left .discard-river .tile'),
        physicalSize('.player-bottom .human-melds .tile'),
        physicalSize('.table-center .dora-row .tile'),
      ],
    };
  });

  expect(closeEnough(geometry.center.width, geometry.center.height, 1.5), `${geometry.center.width}x${geometry.center.height}`).toBe(true);
  expect(closeEnough(geometry.top.bottom, geometry.center.top), `top ${geometry.top.bottom} vs ${geometry.center.top}`).toBe(true);
  expect(closeEnough(geometry.bottom.top, geometry.center.bottom), `bottom ${geometry.bottom.top} vs ${geometry.center.bottom}`).toBe(true);
  expect(closeEnough(geometry.left.right, geometry.center.left), `left ${geometry.left.right} vs ${geometry.center.left}`).toBe(true);
  expect(closeEnough(geometry.right.left, geometry.center.right), `right ${geometry.right.left} vs ${geometry.center.right}`).toBe(true);
  expect(closeEnough(geometry.top.left, geometry.center.left), `top start ${geometry.top.left} vs ${geometry.center.left}`).toBe(true);
  expect(closeEnough(geometry.bottom.left, geometry.center.left), `bottom start ${geometry.bottom.left} vs ${geometry.center.left}`).toBe(true);
  expect(closeEnough(geometry.left.top, geometry.center.top), `left start ${geometry.left.top} vs ${geometry.center.top}`).toBe(true);
  expect(closeEnough(geometry.right.top, geometry.center.top), `right start ${geometry.right.top} vs ${geometry.center.top}`).toBe(true);

  const [reference, ...rest] = geometry.sizes;
  for (const size of rest) {
    expect(closeEnough(size.width, reference.width, .75), `${size.width} vs ${reference.width}`).toBe(true);
    expect(closeEnough(size.height, reference.height, .75), `${size.height} vs ${reference.height}`).toBe(true);
  }
});

test('center anchoring survives viewport resize without per-river retuning', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await boot2d(page);
  await populateGeometryTargets(page);

  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(120);
    const edges = await page.evaluate(() => {
      const r = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      const center = r('.table-center');
      const top = r('.player-top .discard-river');
      const right = r('.player-right .discard-river');
      const bottom = r('.player-bottom .discard-river');
      const left = r('.player-left .discard-river');
      return {
        square: [center.width, center.height],
        topEdge: [top.bottom, center.top],
        rightEdge: [right.left, center.right],
        bottomEdge: [bottom.top, center.bottom],
        leftEdge: [left.right, center.left],
        topStart: [top.left, center.left],
        rightStart: [right.top, center.top],
        bottomStart: [bottom.left, center.left],
        leftStart: [left.top, center.top],
      };
    });
    for (const [name, pair] of Object.entries(edges)) {
      expect(closeEnough(pair[0], pair[1], 1.5), `${name}: ${pair[0]} vs ${pair[1]} @ ${viewport.width}x${viewport.height}`).toBe(true);
    }
  }
});

test('one Dev tile scale changes hand, racks, rivers, melds and Dora together', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);
  await populateGeometryTargets(page);

  const before = await page.locator('.human-hand .tile').first().evaluate((tile) => ({ width: (tile as HTMLElement).offsetWidth, height: (tile as HTMLElement).offsetHeight }));
  await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    raw.tileScale = 1.25;
    const serialized = JSON.stringify(raw);
    localStorage.setItem(key, serialized);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: serialized }));
  }, DEV_UI_KEY);
  await page.waitForTimeout(120);

  const after = await page.evaluate(() => {
    const size = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return { width: element.offsetWidth, height: element.offsetHeight };
    };
    return [
      size('.human-hand .tile'),
      size('.player-top .opponent-hand .tile'),
      size('.player-left .discard-river .tile'),
      size('.player-bottom .human-melds .tile'),
      size('.table-center .dora-row .tile'),
    ];
  });

  expect(after[0].width / before.width).toBeCloseTo(1.25, 1);
  expect(after[0].height / before.height).toBeCloseTo(1.25, 1);
  for (const size of after.slice(1)) {
    expect(closeEnough(size.width, after[0].width, .75), `${size.width} vs ${after[0].width}`).toBe(true);
    expect(closeEnough(size.height, after[0].height, .75), `${size.height} vs ${after[0].height}`).toBe(true);
  }
});

test('human melds are anchored at the table bottom-right instead of inside the hand panel', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);
  await populateGeometryTargets(page);

  const geometry = await page.evaluate(() => {
    const table = document.querySelector<HTMLElement>('.mahjong-table')!.getBoundingClientRect();
    const meld = document.querySelector<HTMLElement>('.player-bottom .human-melds')!.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>('.player-bottom .human-card')!.getBoundingClientRect();
    return {
      rightGap: table.right - meld.right,
      bottomGap: table.bottom - meld.bottom,
      outsideHandPanel: meld.left >= card.right - 4 || meld.top < card.top - 4,
    };
  });

  expect(geometry.rightGap).toBeGreaterThanOrEqual(8);
  expect(geometry.rightGap).toBeLessThanOrEqual(72);
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(8);
  expect(geometry.bottomGap).toBeLessThanOrEqual(72);
  expect(geometry.outsideHandPanel).toBe(true);
});
