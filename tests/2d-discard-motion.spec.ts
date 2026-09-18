import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

async function boot2d(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '0');
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
}

function angleFromMatrix(transform: string): number | null {
  if (transform === 'none') return null;
  const match = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!match) return null;
  const values = match[1].split(',').map(Number);
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return null;
  return Math.atan2(values[1], values[0]);
}

function rotationDegrees(transform: string): number | null {
  const match = /rotate\((-?[\d.]+)deg\)/.exec(transform);
  return match ? Number(match[1]) : null;
}

test('2D Riichi declaration is already sideways in the fresh river DOM and stays stable when another discard appears', async ({ page }) => {
  await boot2d(page);

  const transforms = await page.evaluate(() => {
    const river = document.querySelector<HTMLElement>('.player-bottom .discard-river');
    if (!river) throw new Error('Missing human discard river');

    river.innerHTML = `
      <div class="tile tile-compact" aria-label="3m" data-engine-tile-id="990101" data-riichi-declaration="true"><span></span></div>
    `;
    const marker = river.querySelector<HTMLElement>('[data-riichi-declaration="true"]');
    if (!marker) throw new Error('Missing synthetic Riichi declaration');
    const before = getComputedStyle(marker).transform;

    const next = document.createElement('div');
    next.className = 'tile tile-compact';
    next.setAttribute('aria-label', '4m');
    next.dataset.engineTileId = '990102';
    next.innerHTML = '<span></span>';
    river.append(next);

    const after = getComputedStyle(marker).transform;
    return { before, after };
  });

  const beforeAngle = angleFromMatrix(transforms.before);
  const afterAngle = angleFromMatrix(transforms.after);
  expect(beforeAngle).not.toBeNull();
  expect(afterAngle).not.toBeNull();
  expect(Math.abs(Math.abs(beforeAngle!) - Math.PI / 2)).toBeLessThan(.03);
  expect(Math.abs(afterAngle! - beforeAngle!)).toBeLessThan(.001);
});

test('2D discard flight has no upward hop and the settled latest discard remains in its river row', async ({ page }) => {
  await boot2d(page);

  await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('#app');
    const river = document.querySelector<HTMLElement>('.player-bottom .discard-river');
    if (!app || !river) throw new Error('Missing app or human discard river');

    const tile = document.createElement('div');
    tile.className = 'tile tile-compact';
    tile.dataset.engineTileId = '990201';
    tile.dataset.motionRegression = 'true';
    tile.setAttribute('aria-label', 'qa discard');
    tile.innerHTML = '<span></span>';
    river.append(tile);

    const log = document.createElement('div');
    log.className = 'log-entry';
    log.textContent = 'You discarded qa discard.';
    app.append(log);
  });

  const ghost = page.locator('.discard-flight-ghost');
  await expect(ghost).toBeVisible({ timeout: 2_000 });

  const keyframes = await ghost.evaluate((element) => {
    const animation = element.getAnimations()[0];
    const effect = animation?.effect as KeyframeEffect | null;
    return effect?.getKeyframes().map((frame) => ({ offset: frame.offset, transform: String(frame.transform ?? '') })) ?? [];
  });
  expect(keyframes).toHaveLength(2);

  await expect(ghost).toHaveCount(0, { timeout: 1_500 });
  const settledTransform = await page.locator('[data-motion-regression="true"]').evaluate((tile) => getComputedStyle(tile).transform);
  expect(settledTransform).toBe('none');
});

test('2D side-seat discards turn into the river orientation during flight instead of facing the side player for the whole flight', async ({ page }) => {
  await boot2d(page);

  for (const side of ['left', 'right'] as const) {
    await page.evaluate((seat) => {
      const app = document.querySelector<HTMLElement>('#app');
      const zone = document.querySelector<HTMLElement>(`.player-${seat}`);
      const river = zone?.querySelector<HTMLElement>('.discard-river');
      const player = zone?.querySelector<HTMLElement>('.player-name')?.textContent?.trim();
      if (!app || !river || !player) throw new Error(`Missing ${seat} seat fixture`);

      // Keep each synthetic seat case independent. Production logs are newest-first, while this
      // fixture appends into #app; leaving the prior QA entry around would make latestDiscard()
      // keep selecting the previous seat even though the new tile/log pair is valid.
      app.querySelectorAll<HTMLElement>('.log-entry[data-side-flight-qa="true"]')
        .forEach((entry) => entry.remove());

      const label = `qa-${seat}-flight`;
      const tile = document.createElement('div');
      tile.className = 'tile tile-compact';
      tile.dataset.engineTileId = seat === 'left' ? '990301' : '990302';
      tile.setAttribute('aria-label', label);
      tile.innerHTML = '<span></span>';
      river.append(tile);

      const log = document.createElement('div');
      log.className = 'log-entry';
      log.dataset.sideFlightQa = 'true';
      log.textContent = `${player} discarded ${label}.`;
      app.append(log);
    }, side);

    const ghost = page.locator('.discard-flight-ghost');
    await expect(ghost).toBeVisible({ timeout: 2_000 });
    const frames = await ghost.evaluate((element) => {
      const animation = element.getAnimations()[0];
      const effect = animation?.effect as KeyframeEffect | null;
      return effect?.getKeyframes().map((frame) => String(frame.transform ?? '')) ?? [];
    });
    expect(frames).toHaveLength(2);
    expect(rotationDegrees(frames[0])).toBeCloseTo(0, 3);
    expect(rotationDegrees(frames[1])).toBeCloseTo(side === 'left' ? 90 : -90, 3);
    await expect(ghost).toHaveCount(0, { timeout: 1_500 });
  }
});
