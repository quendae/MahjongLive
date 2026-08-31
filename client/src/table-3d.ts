import './table-3d.css';
import { createFaceCanvas } from './table-3d-faces';
import type { TileFaceMode } from './table-3d-faces';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';
const MODE_KEY = 'mahjong-live:table-3d:v1';
const TILE_MODE_KEY = 'mahjong-live:tile-face-mode:v1';

const appRoot = document.querySelector<HTMLDivElement>('#app');
const stageRoot = document.querySelector<HTMLDivElement>('#table-3d-stage');
if (!appRoot) throw new Error('Missing #app root');
if (!stageRoot) throw new Error('Missing #table-3d-stage root');
const app = appRoot;
const stage = stageRoot;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let enabled = localStorage.getItem(MODE_KEY) !== '0';
let threePromise: Promise<any> | null = null;
let loadError = false;
let runtime: TableRuntime | null = null;
let reconcileScheduled = false;
let reconcileGeneration = 0;

type Side = 'bottom' | 'top' | 'left' | 'right';
type TileZone = 'hand' | 'river' | 'rack' | 'meld';

type TileSpec = {
  key: string;
  zone: TileZone;
  side: Side;
  player: string;
  index: number;
  total: number;
  label: string | null;
  back: boolean;
  selectable: boolean;
  advised: boolean;
  drawn: boolean;
  latest: boolean;
  tileId: number | null;
  element: HTMLElement | null;
};

type Transform = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  scale: number;
};

type Motion = {
  start: Transform;
  target: Transform;
  startedAt: number;
  duration: number;
  arcHeight: number;
};

type TileActor = {
  key: string;
  group: any;
  visual: any;
  body: any;
  face: any;
  indicator: any;
  latestHalo: any;
  spec: TileSpec;
  target: Transform;
  motion: Motion | null;
};

type TableRuntime = {
  THREE: any;
  renderer: any;
  scene: any;
  camera: any;
  actorRoot: any;
  tileGeometry: any;
  faceGeometry: any;
  ivoryMaterial: any;
  backMaterial: any;
  faceMaterials: Map<string, any>;
  actors: Map<string, TileActor>;
  raycaster: any;
  pointer: any;
  table: HTMLElement | null;
  previousTable: HTMLElement | null;
  initialized: boolean;
  disposed: boolean;
  hoveredKey: string | null;
  pressedKey: string | null;
  drawOrigin: Transform | null;
  lastRemainingDraws: number;
  faceMode: TileFaceMode;
};

function readFaceMode(): TileFaceMode {
  return localStorage.getItem(TILE_MODE_KEY) === 'beginner' ? 'beginner' : 'classic';
}

function loadThree(): Promise<any> {
  if (!threePromise) {
    threePromise = import(/* @vite-ignore */ THREE_URL).catch((error) => {
      threePromise = null;
      loadError = true;
      throw error;
    });
  }
  return threePromise;
}

function modeButton(): HTMLButtonElement | null {
  return app.querySelector<HTMLButtonElement>('.table-3d-toggle');
}

function updateModeButton(button = modeButton()): void {
  if (!button) return;
  button.classList.toggle('is-2d', !enabled);
  button.classList.toggle('is-error', loadError);
  button.classList.toggle('is-loading', enabled && !runtime && !loadError);
  button.setAttribute('aria-pressed', String(enabled && !loadError));
  if (loadError) {
    button.innerHTML = '<span class="mode-dot" aria-hidden="true"></span><span>2D · 3D unavailable</span>';
    button.title = '3D could not load. Click to retry.';
  } else if (enabled) {
    button.innerHTML = '<span class="mode-dot" aria-hidden="true"></span><span>3D Table</span>';
    button.title = 'Switch to the lightweight 2D table';
  } else {
    button.innerHTML = '<span class="mode-dot" aria-hidden="true"></span><span>2D Table</span>';
    button.title = 'Switch to the 3D table';
  }
}

function ensureModeButton(): void {
  const actions = app.querySelector<HTMLElement>('.header-actions');
  if (!actions || actions.querySelector('.table-3d-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-button table-3d-toggle';
  updateModeButton(button);
  button.addEventListener('click', () => {
    if (loadError) {
      loadError = false;
      enabled = true;
      threePromise = null;
    } else {
      enabled = !enabled;
    }
    localStorage.setItem(MODE_KEY, enabled ? '1' : '0');
    if (!enabled) deactivateStage();
    updateModeButton(button);
    scheduleReconcile();
  });
  const sound = actions.querySelector('.sound-button');
  const tutorial = actions.querySelector('[data-ui-action="tutorial"]');
  actions.insertBefore(button, sound ?? tutorial);
}

function fallbackNote(table: HTMLElement, message: string): void {
  if (table.querySelector('.table-3d-fallback-note')) return;
  const note = document.createElement('div');
  note.className = 'table-3d-fallback-note';
  note.textContent = message;
  table.appendChild(note);
}

function removeFallbackNote(table: HTMLElement): void {
  table.querySelector('.table-3d-fallback-note')?.remove();
}

function zoneSide(zone: Element): Side {
  if (zone.classList.contains('player-top')) return 'top';
  if (zone.classList.contains('player-left')) return 'left';
  if (zone.classList.contains('player-right')) return 'right';
  return 'bottom';
}

function remainingDraws(): number {
  for (const part of app.querySelectorAll<HTMLElement>('.center-meta span')) {
    const match = /^(\d+) draws$/.exec(part.textContent?.trim() ?? '');
    if (match) return Number(match[1]);
  }
  return 0;
}

function hash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function signedHash(key: string, salt: string): number {
  return hash01(`${key}:${salt}`) * 2 - 1;
}

function baseTransform(spec: TileSpec): Transform {
  const transform: Transform = {
    x: 0,
    y: .24,
    z: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
  };

  if (spec.zone === 'hand') {
    const spacing = Math.min(.50, 6.45 / Math.max(1, spec.total - 1));
    transform.x = (spec.index - (spec.total - 1) / 2) * spacing + (spec.drawn ? .15 : 0);
    transform.z = 4.02;
    transform.y = .27;
    transform.scale = 1.03;
  } else if (spec.zone === 'river') {
    const row = Math.floor(spec.index / 6);
    const col = spec.index % 6;
    const cross = (col - 2.5) * .52;
    const depth = 1.16 + row * .67;
    if (spec.side === 'bottom') {
      transform.x = cross;
      transform.z = depth;
    } else if (spec.side === 'top') {
      transform.x = -cross;
      transform.z = -depth;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -depth;
      transform.z = cross;
      transform.yaw = Math.PI / 2;
    } else {
      transform.x = depth;
      transform.z = -cross;
      transform.yaw = -Math.PI / 2;
    }
    transform.scale = .88;
    if (spec.latest) {
      transform.y += .09;
      transform.scale = .94;
      if (spec.side === 'bottom') transform.z -= .15;
      if (spec.side === 'top') transform.z += .15;
      if (spec.side === 'left') transform.x += .15;
      if (spec.side === 'right') transform.x -= .15;
    }
  } else if (spec.zone === 'rack') {
    const centered = spec.index - (spec.total - 1) / 2;
    const spacing = .35;
    transform.scale = .76;
    if (spec.side === 'top') {
      transform.x = centered * spacing;
      transform.z = -4.08;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -5.10;
      transform.z = centered * spacing;
      transform.yaw = Math.PI / 2;
    } else {
      transform.x = 5.10;
      transform.z = -centered * spacing;
      transform.yaw = -Math.PI / 2;
    }
  } else {
    const row = Math.floor(spec.index / 8);
    const col = spec.index % 8;
    transform.scale = .80;
    if (spec.side === 'bottom') {
      transform.x = 4.65 - col * .42;
      transform.z = 3.46 - row * .56;
    } else if (spec.side === 'top') {
      transform.x = -4.65 + col * .42;
      transform.z = -3.46 + row * .56;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -4.62 + row * .56;
      transform.z = 3.42 - col * .42;
      transform.yaw = Math.PI / 2;
    } else {
      transform.x = 4.62 - row * .56;
      transform.z = -3.42 + col * .42;
      transform.yaw = -Math.PI / 2;
    }
  }

  return humanizeTransform(spec, transform);
}

function humanizeTransform(spec: TileSpec, input: Transform): Transform {
  const out = { ...input };
  let position = 0;
  let yaw = 0;
  let tilt = 0;
  if (spec.zone === 'river') {
    position = spec.latest ? .006 : .014;
    yaw = .025;
    tilt = .005;
  } else if (spec.zone === 'meld') {
    position = .008;
    yaw = .015;
    tilt = .004;
  } else if (spec.zone === 'hand') {
    position = .004;
    yaw = .006;
    tilt = .002;
  } else {
    position = .005;
    yaw = .008;
    tilt = .0025;
  }
  out.x += signedHash(spec.key, 'x') * position;
  out.z += signedHash(spec.key, 'z') * position;
  out.yaw += signedHash(spec.key, 'yaw') * yaw;
  out.pitch += signedHash(spec.key, 'pitch') * tilt;
  out.roll += signedHash(spec.key, 'roll') * tilt;
  return out;
}

function transformFromActor(actor: TileActor): Transform {
  return {
    x: actor.group.position.x,
    y: actor.group.position.y,
    z: actor.group.position.z,
    yaw: actor.group.rotation.y,
    pitch: actor.group.rotation.x,
    roll: actor.group.rotation.z,
    scale: actor.group.scale.x,
  };
}

function applyTransform(actor: TileActor, transform: Transform): void {
  actor.group.position.set(transform.x, transform.y, transform.z);
  actor.group.rotation.set(transform.pitch, transform.yaw, transform.roll);
  actor.group.scale.setScalar(transform.scale);
}

function transformsDiffer(a: Transform, b: Transform): boolean {
  return Math.abs(a.x - b.x) > .002
    || Math.abs(a.y - b.y) > .002
    || Math.abs(a.z - b.z) > .002
    || Math.abs(a.yaw - b.yaw) > .002
    || Math.abs(a.pitch - b.pitch) > .002
    || Math.abs(a.roll - b.roll) > .002
    || Math.abs(a.scale - b.scale) > .002;
}

function roundedTileGeometry(THREE: any): any {
  const width = .43;
  const depth = .57;
  const height = .16;
  const radius = .055;
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -depth / 2;
  const y1 = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0 + radius, y0);
  shape.lineTo(x1 - radius, y0);
  shape.quadraticCurveTo(x1, y0, x1, y0 + radius);
  shape.lineTo(x1, y1 - radius);
  shape.quadraticCurveTo(x1, y1, x1 - radius, y1);
  shape.lineTo(x0 + radius, y1);
  shape.quadraticCurveTo(x0, y1, x0, y1 - radius);
  shape.lineTo(x0, y0 + radius);
  shape.quadraticCurveTo(x0, y0, x0 + radius, y0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    curveSegments: 4,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: .018,
    bevelThickness: .018,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.center();
  return geometry;
}

function disposeFaceMaterials(rt: TableRuntime): void {
  for (const material of rt.faceMaterials.values()) {
    material.map?.dispose?.();
    material.dispose?.();
  }
  rt.faceMaterials.clear();
}

function materialForFace(rt: TableRuntime, label: string | null, back = false): any {
  if (back) return rt.backMaterial;
  const key = `${rt.faceMode}:${label ?? 'blank'}`;
  const cached = rt.faceMaterials.get(key);
  if (cached) return cached;
  const texture = new rt.THREE.CanvasTexture(createFaceCanvas(label, false, rt.faceMode));
  texture.colorSpace = rt.THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, rt.renderer.capabilities.getMaxAnisotropy());
  const material = new rt.THREE.MeshStandardMaterial({
    map: texture,
    roughness: .60,
    metalness: 0,
  });
  rt.faceMaterials.set(key, material);
  return material;
}

function syncFaceMode(rt: TableRuntime): void {
  const next = readFaceMode();
  if (next === rt.faceMode) return;
  rt.faceMode = next;
  disposeFaceMaterials(rt);
  for (const actor of rt.actors.values()) {
    actor.face.material = materialForFace(rt, actor.spec.label, actor.spec.back);
  }
}

function createActor(rt: TableRuntime, spec: TileSpec, initial: Transform): TileActor {
  const THREE = rt.THREE;
  const group = new THREE.Group();
  const visual = new THREE.Group();
  group.add(visual);

  const body = new THREE.Mesh(rt.tileGeometry, rt.ivoryMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  visual.add(body);

  const face = new THREE.Mesh(rt.faceGeometry, materialForFace(rt, spec.label, spec.back));
  face.position.y = .096;
  face.rotation.x = -Math.PI / 2;
  face.receiveShadow = true;
  visual.add(face);

  const indicator = new THREE.Mesh(
    new THREE.RingGeometry(.235, .285, 34),
    new THREE.MeshBasicMaterial({
      color: 0xe8c96f,
      transparent: true,
      opacity: .84,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  indicator.rotation.x = -Math.PI / 2;
  indicator.position.y = -.103;
  indicator.visible = false;
  visual.add(indicator);

  const latestHalo = new THREE.Mesh(
    new THREE.RingGeometry(.29, .35, 40),
    new THREE.MeshBasicMaterial({
      color: 0xf4d47d,
      transparent: true,
      opacity: .92,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  latestHalo.rotation.x = -Math.PI / 2;
  latestHalo.position.y = -.106;
  latestHalo.visible = spec.latest;
  visual.add(latestHalo);

  const actor: TileActor = {
    key: spec.key,
    group,
    visual,
    body,
    face,
    indicator,
    latestHalo,
    spec,
    target: initial,
    motion: null,
  };
  tagActorMeshes(actor);
  applyTransform(actor, initial);
  rt.actorRoot.add(group);
  return actor;
}

function tagActorMeshes(actor: TileActor): void {
  actor.group.userData.actorKey = actor.key;
  actor.visual.userData.actorKey = actor.key;
  actor.body.userData.actorKey = actor.key;
  actor.face.userData.actorKey = actor.key;
}

function refreshActor(rt: TableRuntime, actor: TileActor, spec: TileSpec): void {
  const changedFace = actor.spec.label !== spec.label || actor.spec.back !== spec.back;
  actor.spec = spec;
  if (changedFace) actor.face.material = materialForFace(rt, spec.label, spec.back);
  actor.indicator.visible = spec.advised;
  actor.latestHalo.visible = spec.latest;
}

function rekeyActor(rt: TableRuntime, actor: TileActor, key: string): void {
  rt.actors.delete(actor.key);
  actor.key = key;
  tagActorMeshes(actor);
  rt.actors.set(key, actor);
}

function beginMotion(actor: TileActor, target: Transform, now: number, arcHeight: number, duration: number): void {
  actor.target = target;
  if (reducedMotion || duration <= 0) {
    actor.motion = null;
    applyTransform(actor, target);
    return;
  }
  actor.motion = {
    start: transformFromActor(actor),
    target,
    startedAt: now,
    duration,
    arcHeight,
  };
}

function migrationCandidate(spec: TileSpec, unused: TileActor[]): TileActor | undefined {
  const labelMatches = (actor: TileActor) => actor.spec.label === spec.label && spec.label !== null;
  if (spec.zone === 'river') {
    const fromHand = unused.find((actor) => labelMatches(actor) && actor.spec.zone === 'hand' && spec.side === 'bottom');
    if (fromHand) return fromHand;
    const fromRack = unused.find((actor) => actor.spec.zone === 'rack' && actor.spec.player === spec.player);
    if (fromRack) return fromRack;
  }
  if (spec.zone === 'meld') {
    const fromRiver = unused.find((actor) => labelMatches(actor) && actor.spec.zone === 'river');
    if (fromRiver) return fromRiver;
    const fromOwn = unused.find((actor) => actor.spec.player === spec.player
      && (actor.spec.zone === 'hand' || actor.spec.zone === 'rack')
      && (labelMatches(actor) || actor.spec.back));
    if (fromOwn) return fromOwn;
  }
  if (spec.zone === 'hand') {
    return unused.find((actor) => labelMatches(actor) && actor.spec.zone === 'hand');
  }
  return undefined;
}

function motionProfile(from: TileZone, to: TileZone): { arc: number; duration: number } {
  if (reducedMotion) return { arc: 0, duration: 0 };
  if (from === 'hand' && to === 'river') return { arc: .86, duration: 390 };
  if (from === 'rack' && to === 'river') return { arc: .58, duration: 340 };
  if (to === 'meld' && (from === 'hand' || from === 'rack' || from === 'river')) return { arc: .46, duration: 370 };
  return { arc: .10, duration: 220 };
}

function elementTileId(element: HTMLElement): number | null {
  const raw = element.dataset.engineTileId ?? element.dataset.tileId;
  if (raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function gatherSpecs(table: HTMLElement): TileSpec[] {
  const specs: TileSpec[] = [];

  for (const zone of table.querySelectorAll<HTMLElement>('.player-zone')) {
    const side = zoneSide(zone);
    const player = zone.dataset.player ?? side;

    const river = [...zone.querySelectorAll<HTMLElement>('.discard-river .tile')]
      .filter((element) => !element.classList.contains('tile-called'));
    river.forEach((element, index) => {
      const tileId = elementTileId(element);
      const label = element.getAttribute('aria-label');
      specs.push({
        key: tileId === null ? `river:${player}:${index}:${label ?? 'tile'}` : `tile:${tileId}`,
        zone: 'river',
        side,
        player,
        index,
        total: river.length,
        label,
        back: false,
        selectable: false,
        advised: false,
        drawn: false,
        latest: element.classList.contains('tile-latest-discard'),
        tileId,
        element,
      });
    });

    if (side !== 'bottom') {
      const rack = [...zone.querySelectorAll<HTMLElement>('.opponent-hand .tile')];
      rack.forEach((element, index) => {
        specs.push({
          key: `concealed:${player}:${index}`,
          zone: 'rack',
          side,
          player,
          index,
          total: rack.length,
          label: null,
          back: true,
          selectable: false,
          advised: false,
          drawn: false,
          latest: false,
          tileId: null,
          element,
        });
      });
    }

    const meld = [...zone.querySelectorAll<HTMLElement>('.meld-row .tile')];
    meld.forEach((element, index) => {
      const tileId = elementTileId(element);
      const label = element.getAttribute('aria-label');
      specs.push({
        key: tileId === null ? `meld:${player}:${index}:${label ?? 'back'}` : `tile:${tileId}`,
        zone: 'meld',
        side,
        player,
        index,
        total: meld.length,
        label,
        back: element.classList.contains('tile-back'),
        selectable: false,
        advised: false,
        drawn: false,
        latest: false,
        tileId,
        element,
      });
    });
  }

  const handElements = [...table.querySelectorAll<HTMLElement>('.human-hand .tile')];
  handElements.forEach((element, index) => {
    const tileId = elementTileId(element);
    const label = element.getAttribute('aria-label');
    specs.push({
      key: tileId === null ? `hand:${index}:${label ?? 'tile'}` : `tile:${tileId}`,
      zone: 'hand',
      side: 'bottom',
      player: zonePlayer(table, 'bottom'),
      index,
      total: handElements.length,
      label,
      back: false,
      selectable: element.classList.contains('tile-clickable') && tileId !== null,
      advised: element.classList.contains('tile-advised'),
      drawn: element.classList.contains('tile-drawn'),
      latest: false,
      tileId,
      element,
    });
  });

  return specs;
}

function zonePlayer(table: HTMLElement, side: Side): string {
  return table.querySelector<HTMLElement>(`.player-${side}`)?.dataset.player ?? side;
}

function syntheticDrawOrigin(draws: number): Transform {
  const offset = ((draws % 7) - 3) * .065;
  return {
    x: 5.22,
    y: .42,
    z: -3.68 + offset,
    yaw: -Math.PI / 2,
    pitch: -.04,
    roll: .02,
    scale: .76,
  };
}

function syncActors(rt: TableRuntime, table: HTMLElement): void {
  syncFaceMode(rt);
  const draws = remainingDraws();
  const drawJustOccurred = draws < rt.lastRemainingDraws;
  if (drawJustOccurred) rt.drawOrigin = syntheticDrawOrigin(draws);

  const specs = gatherSpecs(table);
  const desired = new Map(specs.map((spec) => [spec.key, spec]));
  const unused = [...rt.actors.values()].filter((actor) => !desired.has(actor.key));
  const now = performance.now();

  for (const spec of specs) {
    const target = baseTransform(spec);
    let actor = rt.actors.get(spec.key);
    let migratedFrom: TileZone | null = null;

    if (!actor) {
      const candidate = migrationCandidate(spec, unused);
      if (candidate) {
        const unusedIndex = unused.indexOf(candidate);
        if (unusedIndex >= 0) unused.splice(unusedIndex, 1);
        migratedFrom = candidate.spec.zone;
        rekeyActor(rt, candidate, spec.key);
        actor = candidate;
      }
    }

    if (!actor) {
      let initial = target;
      if (rt.initialized && drawJustOccurred && rt.drawOrigin && (spec.zone === 'hand' || spec.zone === 'rack')) {
        initial = { ...rt.drawOrigin };
      } else if (rt.initialized && spec.zone === 'river' && spec.side !== 'bottom') {
        initial = baseTransform({ ...spec, zone: 'rack', index: 0, total: 1, back: true, latest: false });
      }
      actor = createActor(rt, spec, initial);
      rt.actors.set(spec.key, actor);
      const shouldTravel = rt.initialized && transformsDiffer(initial, target);
      beginMotion(actor, target, now, shouldTravel ? .62 : 0, shouldTravel ? 350 : 0);
      refreshActor(rt, actor, spec);
      continue;
    }

    const previousZone = migratedFrom ?? actor.spec.zone;
    refreshActor(rt, actor, spec);
    if (transformsDiffer(actor.target, target)) {
      const profile = motionProfile(previousZone, spec.zone);
      beginMotion(actor, target, now, profile.arc, rt.initialized ? profile.duration : 0);
    }
  }

  for (const actor of unused) removeActor(rt, actor);
  rt.lastRemainingDraws = draws;
  rt.initialized = true;
}

function removeActor(rt: TableRuntime, actor: TileActor): void {
  if (rt.hoveredKey === actor.key) rt.hoveredKey = null;
  if (rt.pressedKey === actor.key) rt.pressedKey = null;
  rt.actors.delete(actor.key);
  actor.group.removeFromParent();
}

function alignStage(rt: TableRuntime, table: HTMLElement): void {
  const rect = table.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > innerHeight) {
    stage.classList.remove('is-active');
    return;
  }
  stage.style.left = `${rect.left}px`;
  stage.style.top = `${rect.top}px`;
  stage.style.width = `${rect.width}px`;
  stage.style.height = `${rect.height}px`;
  stage.classList.add('is-active');
  rt.renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  rt.camera.aspect = rect.width / rect.height;
  rt.camera.updateProjectionMatrix();
}

function createRuntime(THREE: any): TableRuntime {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'table-3d-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b2017, 16, 29);

  const camera = new THREE.PerspectiveCamera(37, 1, .1, 60);
  camera.position.set(0, 10.15, 11.55);
  camera.lookAt(0, .08, .20);

  scene.add(new THREE.HemisphereLight(0xf3ead7, 0x0b1811, 1.35));
  const key = new THREE.DirectionalLight(0xffefd2, 2.3);
  key.position.set(-4.8, 11, 7.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 28;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  scene.add(key);

  const fill = new THREE.PointLight(0x79ae92, .75, 17, 2);
  fill.position.set(4.6, 4.5, -4.5);
  scene.add(fill);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(12.25, .48, 9.85),
    new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: .74, metalness: .015 }),
  );
  base.position.y = -.29;
  base.receiveShadow = true;
  base.castShadow = true;
  scene.add(base);

  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(11.48, .18, 9.08),
    new THREE.MeshStandardMaterial({ color: 0x174a36, roughness: .96, metalness: 0 }),
  );
  felt.position.y = .02;
  felt.receiveShadow = true;
  scene.add(felt);

  const actorRoot = new THREE.Group();
  scene.add(actorRoot);

  const tileGeometry = roundedTileGeometry(THREE);
  const faceGeometry = new THREE.PlaneGeometry(.37, .51);
  const ivoryMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9dfc8,
    roughness: .54,
    metalness: 0,
  });
  const backTexture = new THREE.CanvasTexture(createFaceCanvas(null, true, 'classic'));
  backTexture.colorSpace = THREE.SRGBColorSpace;
  const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture, roughness: .65, metalness: 0 });

  const rt: TableRuntime = {
    THREE,
    renderer,
    scene,
    camera,
    actorRoot,
    tileGeometry,
    faceGeometry,
    ivoryMaterial,
    backMaterial,
    faceMaterials: new Map(),
    actors: new Map(),
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    table: null,
    previousTable: null,
    initialized: false,
    disposed: false,
    hoveredKey: null,
    pressedKey: null,
    drawOrigin: null,
    lastRemainingDraws: remainingDraws(),
    faceMode: readFaceMode(),
  };

  renderer.setAnimationLoop((time: number) => frameRuntime(rt, time));
  return rt;
}

function frameRuntime(rt: TableRuntime, time: number): void {
  if (rt.disposed || !enabled || !rt.table || !stage.classList.contains('is-active')) return;

  for (const actor of rt.actors.values()) {
    if (actor.motion) {
      const motion = actor.motion;
      const progress = Math.max(0, Math.min(1, (time - motion.startedAt) / motion.duration));
      const eased = progress * progress * (3 - 2 * progress);
      const settle = Math.sin(progress * Math.PI * 3) * .022 * (1 - progress);
      actor.group.position.x = lerp(motion.start.x, motion.target.x, eased);
      actor.group.position.z = lerp(motion.start.z, motion.target.z, eased);
      actor.group.position.y = lerp(motion.start.y, motion.target.y, eased)
        + Math.sin(progress * Math.PI) * motion.arcHeight
        + settle;
      actor.group.rotation.x = lerpAngle(motion.start.pitch, motion.target.pitch, eased);
      actor.group.rotation.y = lerpAngle(motion.start.yaw, motion.target.yaw, eased);
      actor.group.rotation.z = lerpAngle(motion.start.roll, motion.target.roll, eased);
      const scale = lerp(motion.start.scale, motion.target.scale, eased);
      actor.group.scale.setScalar(scale);
      if (progress >= 1) {
        actor.motion = null;
        applyTransform(actor, motion.target);
      }
    }

    const hovered = rt.hoveredKey === actor.key && actor.spec.selectable;
    const pressed = rt.pressedKey === actor.key && hovered;
    const hoverY = hovered ? (pressed ? .10 : .19) : 0;
    actor.visual.position.y += (hoverY - actor.visual.position.y) * .22;
    const targetTiltX = hovered ? -.06 : 0;
    const targetTiltZ = hovered ? signedHash(actor.key, 'hover') * .042 : 0;
    actor.visual.rotation.x += (targetTiltX - actor.visual.rotation.x) * .2;
    actor.visual.rotation.z += (targetTiltZ - actor.visual.rotation.z) * .2;
    actor.indicator.visible = actor.spec.advised || hovered;
    actor.latestHalo.visible = actor.spec.latest;
    if (actor.spec.latest && !reducedMotion) {
      const pulse = 1 + Math.sin(time / 180) * .055;
      actor.latestHalo.scale.setScalar(pulse);
    } else {
      actor.latestHalo.scale.setScalar(1);
    }
  }

  rt.renderer.render(rt.scene, rt.camera);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

function disposeRuntime(): void {
  if (!runtime) return;
  const rt = runtime;
  runtime = null;
  rt.disposed = true;
  rt.renderer.setAnimationLoop(null);
  stage.classList.remove('is-active');
  stage.replaceChildren();
  rt.tileGeometry.dispose();
  rt.faceGeometry.dispose();
  rt.ivoryMaterial.dispose();
  rt.backMaterial.map?.dispose?.();
  rt.backMaterial.dispose();
  disposeFaceMaterials(rt);
  rt.renderer.dispose();
  rt.renderer.forceContextLoss?.();
}

function deactivateStage(): void {
  stage.classList.remove('is-active');
  runtime?.previousTable?.classList.remove('table-3d-active', 'table-3d-tile-hover');
  runtime?.table?.classList.remove('table-3d-active', 'table-3d-tile-hover');
  if (runtime) {
    runtime.hoveredKey = null;
    runtime.pressedKey = null;
    runtime.table = null;
  }
}

async function reconcile(): Promise<void> {
  reconcileScheduled = false;
  ensureModeButton();
  updateModeButton();

  const table = app.querySelector<HTMLElement>('.mahjong-table');
  if (!enabled || !table) {
    deactivateStage();
    return;
  }

  if (!runtime) {
    const generation = ++reconcileGeneration;
    try {
      const THREE = await loadThree();
      if (generation !== reconcileGeneration || !enabled || !table.isConnected) return;
      runtime = createRuntime(THREE);
      loadError = false;
    } catch (error) {
      console.warn('Mahjong Live 3D renderer unavailable; keeping 2D table.', error);
      fallbackNote(table, '3D renderer unavailable — using the fully playable 2D table.');
      updateModeButton();
      return;
    }
  }

  const rt = runtime;
  if (!rt) return;
  if (rt.previousTable && rt.previousTable !== table && rt.previousTable.isConnected) {
    rt.previousTable.classList.remove('table-3d-active', 'table-3d-tile-hover');
  }
  rt.previousTable = table;
  rt.table = table;
  table.classList.add('table-3d-active');
  removeFallbackNote(table);
  alignStage(rt, table);
  syncActors(rt, table);
  updateModeButton();
}

function scheduleReconcile(): void {
  if (reconcileScheduled) return;
  reconcileScheduled = true;
  requestAnimationFrame(() => void reconcile());
}

function eventTargetElement(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

function isUiTarget(event: Event): boolean {
  const target = eventTargetElement(event);
  return Boolean(target?.closest(
    'button, select, input, textarea, a, [data-ui-action], .action-dock, .table-center, .reaction-popup, .table-dora-tray',
  ));
}

function pickActor(event: PointerEvent): TileActor | null {
  const rt = runtime;
  const table = rt?.table;
  if (!rt || !table || !enabled || isUiTarget(event)) return null;
  const rect = table.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;

  rt.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  rt.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  rt.raycaster.setFromCamera(rt.pointer, rt.camera);
  const pickMeshes = [...rt.actors.values()]
    .filter((actor) => actor.spec.selectable)
    .flatMap((actor) => [actor.body, actor.face]);
  const hit = rt.raycaster.intersectObjects(pickMeshes, false)[0];
  if (!hit) return null;
  const key = hit.object?.userData?.actorKey as string | undefined;
  return key ? rt.actors.get(key) ?? null : null;
}

function onPointerMove(event: PointerEvent): void {
  const rt = runtime;
  if (!rt) return;
  const actor = pickActor(event);
  rt.hoveredKey = actor?.key ?? null;
  rt.table?.classList.toggle('table-3d-tile-hover', Boolean(actor));
}

function onPointerDown(event: PointerEvent): void {
  const rt = runtime;
  if (!rt) return;
  const actor = pickActor(event);
  rt.pressedKey = actor?.key ?? null;
}

function onPointerUp(event: PointerEvent): void {
  const rt = runtime;
  if (!rt) return;
  const actor = pickActor(event);
  const shouldActivate = actor
    && rt.pressedKey === actor.key
    && actor.spec.selectable
    && actor.spec.tileId !== null;
  rt.pressedKey = null;
  if (!shouldActivate || !actor) return;
  const source = app.querySelector<HTMLElement>(`[data-tile-id="${actor.spec.tileId}"]`);
  source?.click();
}

function onPointerLeave(): void {
  if (!runtime) return;
  runtime.hoveredKey = null;
  runtime.pressedKey = null;
  runtime.table?.classList.remove('table-3d-tile-hover');
}

const observer = new MutationObserver(scheduleReconcile);
observer.observe(app, { childList: true, subtree: true });
window.addEventListener('resize', scheduleReconcile, { passive: true });
window.addEventListener('scroll', scheduleReconcile, { passive: true });
window.addEventListener('mahjong-live:tile-face-mode', scheduleReconcile);
window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
window.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
window.addEventListener('pointerup', onPointerUp, { passive: true, capture: true });
window.addEventListener('blur', onPointerLeave);
window.addEventListener('pagehide', disposeRuntime, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) onPointerLeave();
});
scheduleReconcile();
