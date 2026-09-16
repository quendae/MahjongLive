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

async function populateRivers(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const river = document.querySelector<HTMLElement>(`.player-${side} .discard-river`);
      if (!river) throw new Error(`Missing ${side} river`);
      const count = side === 'left' || side === 'right' ? 7 : 6;
      river.replaceChildren(...Array.from({ length: count }, (_, index) => {
        const tile = document.createElement('div');
        tile.className = 'tile tile-compact';
        tile.setAttribute('aria-label', `qa-${side}-${index}`);
        tile.innerHTML = '<span></span>';
        return tile;
      }));
    }
  });
  await page.waitForTimeout(120);
}

test('2D discard rivers keep a visible clearance around the center counter', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);
  await populateRivers(page);

  const gaps = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element.getBoundingClientRect();
    };

    const center = rect('.table-center');
    const top = rect('.player-top .discard-river');
    const right = rect('.player-right .discard-river');
    const bottom = rect('.player-bottom .discard-river');
    const left = rect('.player-left .discard-river');

    return {
      top: center.top - top.bottom,
      right: right.left - center.right,
      bottom: bottom.top - center.bottom,
      left: center.left - left.right,
    };
  });

  for (const [side, gap] of Object.entries(gaps)) {
    expect(gap, `${side} river clearance`).toBeGreaterThanOrEqual(5);
    expect(gap, `${side} river clearance`).toBeLessThanOrEqual(16);
  }
});

test('2D discard uses the source-flight animation without adding a second tile-fresh bounce', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);

  await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('#app');
    const river = document.querySelector<HTMLElement>('.player-bottom .discard-river');
    if (!app || !river) throw new Error('Missing app or human discard river');

    const tile = document.createElement('div');
    tile.className = 'tile tile-compact';
    tile.dataset.regressionDiscard = 'true';
    tile.setAttribute('aria-label', 'qa discard');
    tile.innerHTML = '<span></span>';
    river.append(tile);

    let pulse = app.querySelector<HTMLElement>('.presentation-pulse');
    if (!pulse) {
      pulse = document.createElement('div');
      pulse.className = 'presentation-pulse';
      app.prepend(pulse);
    }
    pulse.innerHTML = '<span>You discarded qa discard.</span>';
  });

  const tile = page.locator('[data-regression-discard="true"]');
  await expect(tile).toBeVisible();
  await page.waitForTimeout(120);
  await expect(tile).not.toHaveClass(/tile-fresh/);
});

test('human melds belong to the player zone and stay at the table bottom-right', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);

  await page.evaluate(() => {
    const melds = document.querySelector<HTMLElement>('.player-bottom > .human-melds');
    if (!melds) throw new Error('Human meld row is not a direct child of the bottom player zone');
    melds.replaceChildren(...Array.from({ length: 4 }, () => {
      const tile = document.createElement('div');
      tile.className = 'tile tile-compact';
      tile.innerHTML = '<span></span>';
      return tile;
    }));
  });
  await page.waitForTimeout(120);

  await expect(page.locator('.human-card .human-melds')).toHaveCount(0);
  await expect(page.locator('.player-bottom > .human-melds')).toHaveCount(1);

  const geometry = await page.evaluate(() => {
    const table = document.querySelector<HTMLElement>('.mahjong-table')!.getBoundingClientRect();
    const meld = document.querySelector<HTMLElement>('.player-bottom > .human-melds')!.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>('.player-bottom .human-card')!.getBoundingClientRect();
    return {
      rightGap: table.right - meld.right,
      bottomGap: table.bottom - meld.bottom,
      overlapsHandPanel: !(meld.right <= card.left || meld.left >= card.right || meld.bottom <= card.top || meld.top >= card.bottom),
    };
  });

  expect(geometry.rightGap).toBeGreaterThanOrEqual(8);
  expect(geometry.rightGap).toBeLessThanOrEqual(48);
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(8);
  expect(geometry.bottomGap).toBeLessThanOrEqual(48);
  expect(geometry.overlapsHandPanel).toBe(false);
});
