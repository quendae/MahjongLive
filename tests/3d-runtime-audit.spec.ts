import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.MAHJONG_QA_URL ?? 'http://127.0.0.1:4173';
const PI = Math.PI;

type Vector3 = { x: number; y: number; z: number };
type Transform = Vector3 & { yaw: number; pitch: number; roll: number; scale: number };
type AuditActor = {
  key: string;
  zone: 'hand' | 'river' | 'rack' | 'meld';
  side: 'bottom' | 'top' | 'left' | 'right';
  player: string;
  selectable: boolean;
  drawn: boolean;
  tileId: number | null;
  group: Transform;
  target: Transform;
  motion: null | {
    start: Transform;
    target: Transform;
    startedAt: number;
    duration: number;
    arcHeight: number;
  };
  visual: {
    position: Vector3;
    rotation: Vector3;
    worldOffset: Vector3;
  };
  screen: null | { x: number; y: number };
};
type AuditSnapshot = {
  rendererBackend: string;
  hoveredKey: string | null;
  pressedKey: string | null;
  shadowRefreshSerial: number;
  actors: AuditActor[];
};

async function boot3d(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('mahjong-live:table-3d:v1', '1');
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
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-ui-action="confirm-new-game"]')?.click();
  });
  await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-active/, { timeout: 15_000 });
  await expect(page.locator('#table-3d-stage')).toHaveClass(/is-active/, { timeout: 15_000 });
  await page.waitForTimeout(320);
}

async function audit(page: Page): Promise<AuditSnapshot> {
  const snapshot = await page.evaluate(() => new Promise<any | null>((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 900);
    const receive = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener('mahjong-live:3d-audit', receive);
      resolve((event as CustomEvent).detail ?? null);
    };
    window.addEventListener('mahjong-live:3d-audit', receive);
    window.dispatchEvent(new Event('mahjong-live:3d-audit-request'));
  }));
  expect(snapshot, '3D renderer should answer an explicit audit request').not.toBeNull();
  return snapshot as AuditSnapshot;
}

async function waitForAudit(
  page: Page,
  predicate: (snapshot: AuditSnapshot) => boolean,
  timeoutMs = 1800,
): Promise<AuditSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let latest = await audit(page);
  while (!predicate(latest) && Date.now() < deadline) {
    await page.waitForTimeout(24);
    latest = await audit(page);
  }
  expect(predicate(latest), '3D audit condition should become true before timeout').toBe(true);
  return latest;
}

function actorByKey(snapshot: AuditSnapshot, key: string): AuditActor {
  const actor = snapshot.actors.find((candidate) => candidate.key === key);
  expect(actor, `missing 3D actor ${key}`).toBeTruthy();
  return actor!;
}

function expectTransformStart(actual: Transform, expected: Transform): void {
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
  expect(actual.z).toBeCloseTo(expected.z, 3);
  expect(actual.yaw).toBeCloseTo(expected.yaw, 3);
  expect(actual.pitch).toBeCloseTo(expected.pitch, 3);
  expect(actual.roll).toBeCloseTo(expected.roll, 3);
}

function expectedRiverYaw(side: AuditActor['side']): number {
  if (side === 'top') return PI;
  if (side === 'left') return -PI / 2;
  if (side === 'right') return PI / 2;
  return 0;
}

test('3D runtime exposes a geometry snapshot for discard, hover and seat-orientation audits', async ({ page }) => {
  await boot3d(page);
  const snapshot = await audit(page);

  expect(snapshot.rendererBackend).toBe('webgl');
  expect(snapshot.actors.length).toBeGreaterThan(20);
  expect(new Set(snapshot.actors.map((actor) => actor.side))).toEqual(new Set(['bottom', 'top', 'left', 'right']));
  expect(snapshot.shadowRefreshSerial).toBeGreaterThanOrEqual(0);
});

test('opponent racks keep the configured seat-facing 3D orientations', async ({ page }) => {
  await boot3d(page);
  const snapshot = await audit(page);
  const racks = snapshot.actors.filter((actor) => actor.zone === 'rack');

  const top = racks.find((actor) => actor.side === 'top');
  const left = racks.find((actor) => actor.side === 'left');
  const right = racks.find((actor) => actor.side === 'right');
  expect(top).toBeTruthy();
  expect(left).toBeTruthy();
  expect(right).toBeTruthy();

  expect(top!.group.pitch).toBeCloseTo(-PI / 2, 4);
  expect(top!.group.yaw).toBeCloseTo(PI, 4);
  expect(top!.group.roll).toBeCloseTo(0, 4);
  expect(left!.group.pitch).toBeCloseTo(-PI / 2, 4);
  expect(left!.group.yaw).toBeCloseTo(PI, 4);
  expect(left!.group.roll).toBeCloseTo(-PI / 2, 4);
  expect(right!.group.pitch).toBeCloseTo(-PI / 2, 4);
  expect(right!.group.yaw).toBeCloseTo(PI, 4);
  expect(right!.group.roll).toBeCloseTo(PI / 2, 4);
});

test('discard animation starts from the exact physical hand/rack actor instead of a generic draw source', async ({ page }) => {
  await boot3d(page);
  const before = await audit(page);
  const human = before.actors.find((actor) => actor.zone === 'hand' && actor.selectable && actor.tileId !== null);
  expect(human?.tileId).not.toBeNull();
  const rackBefore = new Map(before.actors.filter((actor) => actor.zone === 'rack').map((actor) => [actor.key, actor]));

  await page.evaluate((tileId) => {
    document.querySelector<HTMLElement>(`[data-tile-id="${tileId}"]`)?.click();
  }, human!.tileId);

  const during = await waitForAudit(page, (snapshot) => {
    const actor = snapshot.actors.find((candidate) => candidate.key === human!.key);
    return actor?.zone === 'river' && Boolean(actor.motion);
  });
  const humanRiver = actorByKey(during, human!.key);
  expect(humanRiver.motion).not.toBeNull();
  expectTransformStart(humanRiver.motion!.start, human!.group);
  expect(humanRiver.motion!.arcHeight).toBeCloseTo(.86, 3);
  expect(humanRiver.motion!.duration).toBe(390);
  expect(Math.abs(humanRiver.motion!.target.yaw - expectedRiverYaw('bottom'))).toBeLessThan(.07);

  const opponentDuring = await waitForAudit(page, (snapshot) => snapshot.actors.some((actor) =>
    actor.zone === 'river' && actor.side !== 'bottom' && Boolean(actor.motion) && rackBefore.has(actor.key)
  ), 2200);
  const opponentRiver = opponentDuring.actors.find((actor) =>
    actor.zone === 'river' && actor.side !== 'bottom' && Boolean(actor.motion) && rackBefore.has(actor.key)
  )!;
  const sourceRack = rackBefore.get(opponentRiver.key)!;
  expectTransformStart(opponentRiver.motion!.start, sourceRack.group);
  expect(opponentRiver.motion!.arcHeight).toBeCloseTo(.58, 3);
  expect(opponentRiver.motion!.duration).toBe(340);
  expect(Math.abs(opponentRiver.motion!.target.yaw - expectedRiverYaw(opponentRiver.side))).toBeLessThan(.07);
});

test('hover lifts in world-up, refreshes the cached shadow, then settles back to the table', async ({ page }) => {
  await boot3d(page);
  const before = await audit(page);
  const actor = before.actors.find((candidate) => candidate.zone === 'hand' && candidate.selectable && candidate.screen);
  expect(actor?.screen).toBeTruthy();

  await page.mouse.move(actor!.screen!.x, actor!.screen!.y);
  const lifted = await waitForAudit(page, (snapshot) => {
    const current = snapshot.actors.find((candidate) => candidate.key === actor!.key);
    return snapshot.hoveredKey === actor!.key && (current?.visual.worldOffset.y ?? 0) > .035;
  });
  const liftedActor = actorByKey(lifted, actor!.key);
  expect(Math.abs(liftedActor.visual.worldOffset.x)).toBeLessThan(.004);
  expect(Math.abs(liftedActor.visual.worldOffset.z)).toBeLessThan(.004);
  expect(liftedActor.visual.worldOffset.y).toBeGreaterThan(.035);
  expect(lifted.shadowRefreshSerial).toBeGreaterThan(before.shadowRefreshSerial);
  await expect(page.locator('.mahjong-table')).toHaveClass(/table-3d-tile-hover/);

  const serialAtLift = lifted.shadowRefreshSerial;
  await page.mouse.move(2, 2);
  const settled = await waitForAudit(page, (snapshot) => {
    const current = snapshot.actors.find((candidate) => candidate.key === actor!.key);
    if (!current) return false;
    const offset = current.visual.worldOffset;
    return snapshot.hoveredKey === null
      && Math.abs(offset.x) < .002
      && Math.abs(offset.y) < .002
      && Math.abs(offset.z) < .002;
  }, 2200);
  expect(settled.shadowRefreshSerial).toBeGreaterThan(serialAtLift);
  await expect(page.locator('.mahjong-table')).not.toHaveClass(/table-3d-tile-hover/);
});
