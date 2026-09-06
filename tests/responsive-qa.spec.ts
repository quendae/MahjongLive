import { expect, test, type Page, type TestInfo } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

type Profile = { name: string; width: number; height: number };

const PROFILES: Profile[] = [
  { name: 'desktop-2560x1440', width: 2560, height: 1440 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'laptop-1366x768', width: 1366, height: 768 },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768 },
  { name: 'tablet-portrait-820x1180', width: 820, height: 1180 },
  { name: 'phone-portrait-390x844', width: 390, height: 844 },
  { name: 'phone-landscape-844x390', width: 844, height: 390 },
];

async function domClick(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .01) return false;
    element.click();
    return true;
  }, selector);
}

async function boot(page: Page, mode: '2d' | '3d'): Promise<void> {
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

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });

  await domClick(page, '[data-ui-action="confirm-new-game"]');
  await page.locator('.mahjong-table').waitFor({ state: 'visible' });

  if (mode === '3d') {
    await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
    await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
    await page.waitForTimeout(500);
  } else {
    await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-active/);
  }
}

async function playSome2d(page: Page, turns = 14): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await page.waitForTimeout(25);

    if (await domClick(page, '[data-ui-action="continue"]')) continue;
    if (await domClick(page, '.choice-option')) continue;
    if (await domClick(page, '.reaction-popup [data-proxy-action="pass"]')) continue;
    if (await domClick(page, '[data-ui-action="pass"]')) continue;
    if (await domClick(page, '#human-hand .tile-clickable')) continue;

    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(140);
}

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

async function visualAudit(page: Page, mode: '2d' | '3d'): Promise<string[]> {
  return page.evaluate((mode) => {
    const issues: string[] = [];
    const table = document.querySelector<HTMLElement>('.mahjong-table');
    if (!table) return ['missing .mahjong-table'];

    const rect = (element: Element): Rect => {
      const value = element.getBoundingClientRect();
      return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
    };
    const visible = (element: Element): boolean => {
      const style = getComputedStyle(element);
      const value = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .01 && value.width > 1 && value.height > 1;
    };
    const intersectionRatio = (a: Rect, b: Rect): number => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const area = width * height;
      return area / Math.max(1, Math.min(a.width * a.height, b.width * b.height));
    };

    const tableRect = rect(table);
    if (document.documentElement.scrollWidth > innerWidth + 4) {
      issues.push(`page horizontal overflow: ${document.documentElement.scrollWidth}px > ${innerWidth}px`);
    }
    if (tableRect.left < -3 || tableRect.right > innerWidth + 3) {
      issues.push(`table clipped horizontally: ${tableRect.left.toFixed(1)}..${tableRect.right.toFixed(1)} in ${innerWidth}`);
    }

    const doraSelector = mode === '3d' ? '.table-dora-tray' : '.table-center .dora-row.center-dora-integrated';
    for (const [name, selector] of [
      ['Dora', doraSelector],
      ['center', '.table-center'],
      ['top badge', '.player-top .player-heading'],
      ['right badge', '.player-right .player-heading'],
      ['bottom badge', '.player-bottom .player-heading'],
      ['left badge', '.player-left .player-heading'],
    ] as const) {
      const element = table.querySelector(selector);
      if (!element || !visible(element)) continue;
      const item = rect(element);
      const tolerance = 4;
      if (item.left < tableRect.left - tolerance || item.right > tableRect.right + tolerance
          || item.top < tableRect.top - tolerance || item.bottom > tableRect.bottom + tolerance) {
        issues.push(`${name} outside table bounds`);
      }
    }

    if (mode === '3d') {
      const stage = document.querySelector<HTMLElement>('#table-3d-stage.is-active');
      if (!stage) issues.push('3D stage is not active');
      else {
        const stageRect = rect(stage);
        for (const [axis, a, b] of [
          ['left', stageRect.left, tableRect.left],
          ['top', stageRect.top, tableRect.top],
          ['width', stageRect.width, tableRect.width],
          ['height', stageRect.height, tableRect.height],
        ] as const) {
          if (Math.abs(a - b) > 3) issues.push(`3D stage/table ${axis} mismatch: ${a.toFixed(1)} vs ${b.toFixed(1)}`);
        }
      }
      return issues;
    }

    const centerElement = table.querySelector('.table-center');
    const center = centerElement && visible(centerElement) ? rect(centerElement) : null;
    const reactionPopup = document.querySelector('.reaction-popup');
    const reactionPopupOpen = Boolean(reactionPopup && visible(reactionPopup));
    if (center && !reactionPopupOpen) {
      for (const river of table.querySelectorAll('.discard-river')) {
        if (!visible(river) || river.children.length === 0) continue;
        const overlap = intersectionRatio(rect(river), center);
        if (overlap > .12) issues.push(`river overlaps center (${Math.round(overlap * 100)}%)`);
      }
    }

    for (const side of ['top', 'left', 'right'] as const) {
      const hand = table.querySelector(`.player-${side} .opponent-hand`);
      const badge = table.querySelector(`.player-${side} .player-heading`);
      if (!hand || !badge || !visible(hand) || !visible(badge)) continue;
      const overlap = intersectionRatio(rect(hand), rect(badge));
      if (overlap > .18) issues.push(`${side} badge overlaps concealed rack (${Math.round(overlap * 100)}%)`);
    }

    return issues;
  }, mode);
}

async function capture(page: Page, testInfo: TestInfo, profile: Profile, mode: '2d' | '3d'): Promise<void> {
  const path = testInfo.outputPath(`${profile.name}-${mode}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`${profile.name}-${mode}`, { path, contentType: 'image/png' });
}

test.setTimeout(60_000);

for (const profile of PROFILES) {
  for (const mode of ['2d', '3d'] as const) {
    test(`${profile.name} · ${mode}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: profile.width, height: profile.height });
      await boot(page, mode);
      if (mode === '2d') await playSome2d(page);

      const issues = await visualAudit(page, mode);
      await capture(page, testInfo, profile, mode);
      expect(issues, issues.join('\n')).toEqual([]);
    });
  }
}
