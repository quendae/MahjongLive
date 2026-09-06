import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

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

function closeEnough(a: number, b: number, tolerance = 1.25): boolean {
  return Math.abs(a - b) <= tolerance;
}

test('2D rivers stay flush with the measured center edges and all table tiles share one size', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);

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
  });
  await page.waitForTimeout(100);

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
      // offsetWidth/offsetHeight describe the physical tile before a player's 90° seat rotation.
      return { width: element.offsetWidth, height: element.offsetHeight };
    };
    const center = rect('.table-center');
    const top = rect('.player-top .discard-river');
    const right = rect('.player-right .discard-river');
    const bottom = rect('.player-bottom .discard-river');
    const left = rect('.player-left .discard-river');
    const sizes = [
      physicalSize('.human-hand .tile'),
      physicalSize('.player-top .opponent-hand .tile'),
      physicalSize('.player-left .discard-river .tile'),
      physicalSize('.table-center .dora-row .tile'),
    ];
    return { center, top, right, bottom, left, sizes };
  });

  expect(closeEnough(geometry.top.bottom, geometry.center.top), `top ${geometry.top.bottom} vs ${geometry.center.top}`).toBe(true);
  expect(closeEnough(geometry.bottom.top, geometry.center.bottom), `bottom ${geometry.bottom.top} vs ${geometry.center.bottom}`).toBe(true);
  expect(closeEnough(geometry.left.right, geometry.center.left), `left ${geometry.left.right} vs ${geometry.center.left}`).toBe(true);
  expect(closeEnough(geometry.right.left, geometry.center.right), `right ${geometry.right.left} vs ${geometry.center.right}`).toBe(true);

  const [reference, ...rest] = geometry.sizes;
  for (const size of rest) {
    expect(closeEnough(size.width, reference.width, .75), `${size.width} vs ${reference.width}`).toBe(true);
    expect(closeEnough(size.height, reference.height, .75), `${size.height} vs ${reference.height}`).toBe(true);
  }
});

test('center anchoring survives viewport resize without per-river retuning', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await boot2d(page);
  await page.evaluate(() => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const river = document.querySelector<HTMLElement>(`.player-${side} .discard-river`);
      if (!river) continue;
      river.replaceChildren(...Array.from({ length: 6 }, () => {
        const tile = document.createElement('div');
        tile.className = 'tile tile-compact';
        return tile;
      }));
    }
  });

  for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const edges = await page.evaluate(() => {
      const r = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      const center = r('.table-center');
      const top = r('.player-top .discard-river');
      const right = r('.player-right .discard-river');
      const bottom = r('.player-bottom .discard-river');
      const left = r('.player-left .discard-river');
      return {
        top: [top.bottom, center.top],
        right: [right.left, center.right],
        bottom: [bottom.top, center.bottom],
        left: [left.right, center.left],
      };
    });
    for (const [name, pair] of Object.entries(edges)) {
      expect(closeEnough(pair[0], pair[1], 1.5), `${name}: ${pair[0]} vs ${pair[1]} @ ${viewport.width}x${viewport.height}`).toBe(true);
    }
  }
});
