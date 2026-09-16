import { expect, test } from '@playwright/test';
import { orderMeldTilesForPresentation } from '../client/src/meld-presentation';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';

function tile(id: number) {
  return { id, kind: 'suited', suit: 'man', rank: 5, isRed: false } as const;
}

function openMeld(
  ids: readonly number[],
  owner: 0 | 1 | 2 | 3,
  calledFrom?: 0 | 1 | 2 | 3,
  calledTileId?: number,
) {
  return {
    owner,
    meld: {
      type: ids.length === 4 ? 'quad' : 'triplet',
      tiles: ids.map(tile),
      isOpen: true,
      calledFrom,
      calledTileId,
    },
  } as const;
}

// Meld DOM order follows the physical 3D anchor: index 0 is the owner's right-hand end and the
// final index is the owner's left-hand end. 2D reverses the flex row so the same DOM convention is
// visible from every seat perspective.
test('called tile occupies the source-facing slot without changing its physical id', () => {
  const owner = 1 as const;

  const fromLeft = openMeld([10, 20, 30], owner, 0, 30);
  const across = openMeld([10, 20, 30], owner, 3, 30);
  const fromRight = openMeld([10, 20, 30], owner, 2, 30);

  expect(orderMeldTilesForPresentation(fromLeft.meld, owner).map((entry) => entry.id)).toEqual([10, 20, 30]);
  expect(orderMeldTilesForPresentation(across.meld, owner).map((entry) => entry.id)).toEqual([10, 30, 20]);
  expect(orderMeldTilesForPresentation(fromRight.meld, owner).map((entry) => entry.id)).toEqual([30, 10, 20]);

  for (const fixture of [fromLeft, across, fromRight]) {
    const ordered = orderMeldTilesForPresentation(fixture.meld, owner);
    const sideways = ordered.find((entry) => entry.id === fixture.meld.calledTileId);
    expect(sideways?.id).toBe(30);
    expect(sideways).toBe(fixture.meld.tiles[2]);
  }
});

test('daiminkan uses the same left/across/right convention and preserves all four physical tiles', () => {
  const owner = 2 as const;
  const fixtures = [
    { source: 1 as const, expected: [11, 12, 13, 99] }, // left source -> owner's left end
    { source: 0 as const, expected: [11, 99, 12, 13] }, // across -> inner slot
    { source: 3 as const, expected: [99, 11, 12, 13] }, // right source -> owner's right end
  ];

  for (const fixture of fixtures) {
    const { meld } = openMeld([11, 12, 13, 99], owner, fixture.source, 99);
    const ordered = orderMeldTilesForPresentation(meld, owner);
    expect(ordered.map((entry) => entry.id)).toEqual(fixture.expected);
    expect(new Set(ordered.map((entry) => entry.id))).toEqual(new Set([11, 12, 13, 99]));
  }
});

test('concealed or legacy melds keep authoritative tile order', () => {
  const tiles = [tile(41), tile(42), tile(43)];
  const legacy = { type: 'triplet', tiles, isOpen: true } as const;
  const ordered = orderMeldTilesForPresentation(legacy, 0);
  expect(ordered).toEqual(tiles);
  expect(ordered).not.toBe(tiles);
});

test('2D runtime moves the exact called DOM tile to the owner-right slot and turns it sideways', async ({ page }) => {
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

  await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('.player-bottom > .human-melds');
    const zone = row?.closest<HTMLElement>('.player-zone[data-player]');
    if (!row || !zone) throw new Error('Missing human meld zone');
    const owner = Number(zone.dataset.player);
    const sourceOnRight = (owner + 1) % 4;
    const meld = document.createElement('div');
    meld.className = 'meld meld-triplet';
    meld.dataset.meldIndex = '99';
    for (const id of [10, 20, 30]) {
      const tileElement = document.createElement('div');
      tileElement.className = `tile tile-compact${id === 30 ? ' tile-meld-called' : ''}`;
      tileElement.dataset.engineTileId = String(id);
      if (id === 30) tileElement.dataset.calledFrom = String(sourceOnRight);
      tileElement.innerHTML = '<span></span>';
      meld.append(tileElement);
    }
    row.replaceChildren(meld);
  });

  await expect.poll(() => page.locator('.player-bottom .meld > .tile').evaluateAll((tiles) =>
    tiles.map((tile) => Number((tile as HTMLElement).dataset.engineTileId))
  )).toEqual([30, 10, 20]);

  const presentation = await page.locator('.player-bottom .meld').evaluate((meld) => {
    const called = meld.querySelector<HTMLElement>('.tile-meld-called');
    if (!called) throw new Error('Missing called tile');
    const meldStyle = getComputedStyle(meld);
    const tileStyle = getComputedStyle(called);
    return {
      flexDirection: meldStyle.flexDirection,
      transform: tileStyle.transform,
      id: Number(called.dataset.engineTileId),
    };
  });

  expect(presentation.flexDirection).toBe('row-reverse');
  expect(presentation.transform).not.toBe('none');
  expect(presentation.id).toBe(30);
});
