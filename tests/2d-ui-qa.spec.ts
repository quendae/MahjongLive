import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

async function boot2d(page: Page): Promise<void> {
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
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });
  await page.evaluate(() => document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click());
  await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-active/);
}

test('2D side rivers keep the configured first seven discards on one row', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);

  const result = await page.evaluate(() => {
    const rows: Record<string, { tops: number[]; columns: string }> = {};
    for (const side of ['left', 'right'] as const) {
      const river = document.querySelector<HTMLElement>(`.player-${side} .discard-river`);
      if (!river) throw new Error(`Missing ${side} river`);
      river.replaceChildren(...Array.from({ length: 7 }, () => {
        const tile = document.createElement('div');
        tile.className = 'tile tile-compact';
        return tile;
      }));
      const children = Array.from(river.children) as HTMLElement[];
      rows[side] = {
        tops: children.map((tile) => tile.offsetTop),
        columns: getComputedStyle(river).gridTemplateColumns,
      };
    }
    return rows;
  });

  for (const side of ['left', 'right'] as const) {
    expect(new Set(result[side].tops).size, `${side}: ${result[side].columns}`).toBe(1);
  }
});

test('Options appearance is visually authoritative and 2D backs use the inset design', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot2d(page);

  await page.locator('.appearance-toggle').click();
  await page.locator('[data-appearance-preset="burgundy"]').click();

  const values = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const table = document.querySelector<HTMLElement>('.mahjong-table:not(.table-3d-active)');
    const back = document.querySelector<HTMLElement>('.mahjong-table:not(.table-3d-active) .tile-back');
    const inner = back?.querySelector<HTMLElement>(':scope > span');
    if (!table || !back || !inner) throw new Error('Missing 2D appearance targets');
    const tableStyle = getComputedStyle(table);
    const backStyle = getComputedStyle(back);
    const patternStyle = getComputedStyle(inner, '::after');
    return {
      feltVar: root.getPropertyValue('--user-felt-color').trim(),
      frameVar: root.getPropertyValue('--user-frame-color').trim(),
      backVar: root.getPropertyValue('--user-back-color').trim(),
      tableColor: tableStyle.backgroundColor,
      frameColor: tableStyle.borderTopColor,
      backRadius: Number.parseFloat(backStyle.borderRadius),
      patternImage: patternStyle.backgroundImage,
      patternOpacity: Number.parseFloat(patternStyle.opacity),
    };
  });

  expect(values.feltVar).toBe('#5a2032');
  expect(values.frameVar).toBe('#4a3022');
  expect(values.backVar).toBe('#6b3444');
  expect(values.tableColor).toBe('rgb(90, 32, 50)');
  expect(values.frameColor).toBe('rgb(74, 48, 34)');
  expect(values.backRadius).toBeLessThanOrEqual(3);
  expect(values.patternImage).not.toBe('none');
  expect(values.patternOpacity).toBeLessThan(.4);
});

test('Dev is grouped and exposes the refined 2D controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await boot2d(page);
  await page.locator('.dev-tuning-toggle').click();

  await expect(page.locator('.dev-tuning-panel')).toBeVisible();
  await expect(page.locator('.dev-tuning-group')).toHaveCount(6);
  await expect(page.locator('.dev-tuning-group[data-dev-group="2d"]')).toHaveAttribute('open', '');

  const labels = await page.locator('.dev-ui-layout-section label').allTextContents();
  for (const required of [
    'Side river columns', 'Back pattern scale', 'Back corner radius', 'Back pattern opacity', 'Back inner frame opacity',
    'Your hand tile gap', 'Drawn tile gap',
    'Top panel X', 'Left panel Y', 'Right panel X', 'Your panel Y',
    'Top panel size', 'Your panel size', 'Your panel width', 'Your panel height',
    'Top badge X', 'Left badge size', 'Right badge size',
    'Left rack Y', 'Left rack size', 'Your hand X', 'Your hand size',
    'Top river X', 'Left river size', 'Right river Y', 'Your river size',
    'Top melds X', 'Right melds size', 'Your melds X',
    'Center X', 'Center size', 'Dora row Y', 'Dora row size', 'Dora indicator gap',
    'Action dock X', 'Call bubble size',
  ]) {
    expect(labels, `Missing Dev control: ${required}`).toContain(required);
  }
});

test('2D side badges rotate with seats and Dora is truly inside the center counter', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);
  await expect(page.locator('.table-center .dora-row.center-dora-integrated')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const left = document.querySelector<HTMLElement>('.player-left .player-heading');
    const right = document.querySelector<HTMLElement>('.player-right .player-heading');
    const center = document.querySelector<HTMLElement>('.table-center');
    const dora = document.querySelector<HTMLElement>('.table-center .dora-row.center-dora-integrated');
    const detachedTray = document.querySelector<HTMLElement>('.mahjong-table:not(.table-3d-active) > .table-dora-tray');
    if (!left || !right || !center || !dora) throw new Error('Missing 2D UI targets');
    const centerRect = center.getBoundingClientRect();
    const doraRect = dora.getBoundingClientRect();
    return {
      leftRotate: getComputedStyle(left).rotate,
      rightRotate: getComputedStyle(right).rotate,
      leftScale: getComputedStyle(left).scale,
      rightScale: getComputedStyle(right).scale,
      doraParentIsCenter: dora.parentElement === center,
      detachedTray: Boolean(detachedTray),
      indicatorCount: dora.querySelectorAll('.tile').length,
      doraInsideCenter: doraRect.left >= centerRect.left - 1
        && doraRect.right <= centerRect.right + 1
        && doraRect.top >= centerRect.top - 1
        && doraRect.bottom <= centerRect.bottom + 1,
    };
  });

  expect(geometry.leftRotate).toContain('90deg');
  expect(geometry.rightRotate).toContain('-90deg');
  expect(Number.parseFloat(geometry.leftScale)).toBeGreaterThan(1);
  expect(Number.parseFloat(geometry.rightScale)).toBeGreaterThan(1);
  expect(geometry.doraParentIsCenter).toBe(true);
  expect(geometry.detachedTray).toBe(false);
  expect(geometry.indicatorCount).toBeGreaterThanOrEqual(1);
  expect(geometry.doraInsideCenter).toBe(true);
});

test('human hand has no visible browser scrollbar on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot2d(page);
  const state = await page.evaluate(() => {
    const hand = document.querySelector<HTMLElement>('.human-hand');
    const card = document.querySelector<HTMLElement>('.human-card');
    if (!hand || !card) throw new Error('Missing human rack');
    const handStyle = getComputedStyle(hand);
    return {
      overflowX: handStyle.overflowX,
      overflowY: handStyle.overflowY,
      scrollbarWidth: handStyle.getPropertyValue('scrollbar-width'),
      cardOverflow: getComputedStyle(card).overflow,
    };
  });
  expect(state.overflowX).toBe('visible');
  expect(state.overflowY).toBe('visible');
  expect(state.scrollbarWidth).toBe('none');
  expect(state.cardOverflow).toBe('visible');
});

test('3D rendering defaults to Maximum and can be lowered from Options', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot2d(page);

  const initial = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('mahjong-live:dev-tuning:v1') ?? '{}');
    return { profile: localStorage.getItem('mahjong-live:graphics-profile:v1'), graphics: raw.graphics };
  });
  expect(initial.profile).toBe('max');
  expect(initial.graphics).toEqual({ pixelRatio: 2, shadowQuality: 3, anisotropy: 16, geometryQuality: 3 });

  await page.locator('.appearance-toggle').click();
  const select = page.locator('[data-graphics-profile]');
  await expect(select).toHaveValue('max');
  await select.selectOption('balanced');

  const changed = await page.evaluate(() => JSON.parse(localStorage.getItem('mahjong-live:dev-tuning:v1') ?? '{}').graphics);
  expect(changed).toEqual({ pixelRatio: 1, shadowQuality: 1, anisotropy: 4, geometryQuality: 1 });
});
