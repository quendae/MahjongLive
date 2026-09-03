import './table-3d.css';
import { createFaceCanvas } from './table-3d-faces';
import type { TileFaceMode } from './table-3d-faces';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';
const MODE_KEY = 'mahjong-live:table-3d:v1';
const TILE_MODE_KEY = 'mahjong-live:tile-face-mode:v1';
// ExtrudeGeometry's bevel extends slightly beyond the nominal 0.16 tile thickness.
// Keep the printed/rear planes clearly outside that shell so upright racks show their faces.
const TILE_FACE_OFFSET = .128;
const TILE_BACK_OFFSET = .124;
const OPPONENT_RACK_LEAN = .17;
const DEV_TUNING_KEY = 'mahjong-live:dev-tuning:v1';

type DevRotation = { x: number; y: number; z: number };
type DevTuning = {
  camera: { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number; fov: number };
  left: DevRotation;
  right: DevRotation;
  top: DevRotation;
  bottom: DevRotation;
  tiles: {
    faceOffset: number;
    faceRotateX: number;
    faceScale: number;
    faceTextureRotation: number;
    bodyColor: string;
    bodyRoughness: number;
    faceTint: string;
    ownScale: number;
    opponentScale: number;
    riverScale: number;
    meldScale: number;
    riverDepth: number;
    riverRowGap: number;
    riverColumnGap: number;
  };
  tableGeometry: { frameTopY: number; feltTopY: number; frameWidth: number; frameThickness: number; feltThickness: number };
  ui: {
    playerCardScale: number;
    playerInsetTB: number;
    playerInsetSides: number;
    doraScale: number;
    doraX: number;
    doraY: number;
    centerScale: number;
    centerOffsetX: number;
    centerOffsetY: number;
    centerWidth: number;
    centerHeight: number;
    reactionScale: number;
    gameLogWidth: number;
  };
  tableColor: string;
  tableImage: string | null;
  woodColor: string;
  backColor: string;
};

const DEFAULT_DEV_TUNING: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },
  tiles: {
    faceOffset: .128,
    faceRotateX: -90,
    faceScale: 1,
    faceTextureRotation: 0,
    bodyColor: '#fffdf5',
    bodyRoughness: .46,
    faceTint: '#ffffff',
    ownScale: 1,
    opponentScale: 1,
    riverScale: 1,
    meldScale: 1,
    riverDepth: 2.05,
    riverRowGap: .55,
    riverColumnGap: .48,
  },
  tableGeometry: { frameTopY: .25, feltTopY: .11, frameWidth: .39, frameThickness: .34, feltThickness: .10 },
  ui: {
    playerCardScale: 1,
    playerInsetTB: 10,
    playerInsetSides: 10,
    doraScale: 1,
    doraX: 24,
    doraY: 24,
    centerScale: 1,
    centerOffsetX: 0,
    centerOffsetY: 0,
    centerWidth: 242,
    centerHeight: 242,
    reactionScale: 1,
    gameLogWidth: 290,
  },
  tableColor: '#174a36',
  tableImage: null,
  woodColor: '#3a2b20',
  backColor: '#315c49',
};

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
  rear: any;
  rearShell: any;
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
  frame: any;
  underlay: any;
  felt: any;
  tableBoxGeometry: any;
  woodMaterial: any;
  tileGeometry: any;
  faceGeometry: any;
  backGeometry: any;
  backShellGeometry: any;
  ivoryMaterial: any;
  feltMaterial: any;
  backMaterial: any;
  backShellMaterial: any;
  tableTexture: any | null;
  tableTextureSource: string | null;
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

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readDevTuning(): DevTuning {
  let raw: any = {};
  try { raw = JSON.parse(localStorage.getItem(DEV_TUNING_KEY) ?? '{}'); } catch { raw = {}; }
  const readRotation = (value: any, fallback: DevRotation): DevRotation => ({
    x: finiteNumber(value?.x, fallback.x),
    y: finiteNumber(value?.y, fallback.y),
    z: finiteNumber(value?.z, fallback.z),
  });
  return {
    camera: {
      x: finiteNumber(raw.camera?.x, DEFAULT_DEV_TUNING.camera.x),
      y: finiteNumber(raw.camera?.y, DEFAULT_DEV_TUNING.camera.y),
      z: finiteNumber(raw.camera?.z, DEFAULT_DEV_TUNING.camera.z),
      targetX: finiteNumber(raw.camera?.targetX, DEFAULT_DEV_TUNING.camera.targetX),
      targetY: finiteNumber(raw.camera?.targetY, DEFAULT_DEV_TUNING.camera.targetY),
      targetZ: finiteNumber(raw.camera?.targetZ, DEFAULT_DEV_TUNING.camera.targetZ),
      fov: finiteNumber(raw.camera?.fov, DEFAULT_DEV_TUNING.camera.fov),
    },
    left: readRotation(raw.left, DEFAULT_DEV_TUNING.left),
    right: readRotation(raw.right, DEFAULT_DEV_TUNING.right),
    top: readRotation(raw.top, DEFAULT_DEV_TUNING.top),
    bottom: readRotation(raw.bottom, DEFAULT_DEV_TUNING.bottom),
    tiles: {
      faceOffset: finiteNumber(raw.tiles?.faceOffset, DEFAULT_DEV_TUNING.tiles.faceOffset),
      faceRotateX: finiteNumber(raw.tiles?.faceRotateX, DEFAULT_DEV_TUNING.tiles.faceRotateX),
      faceScale: finiteNumber(raw.tiles?.faceScale, DEFAULT_DEV_TUNING.tiles.faceScale),
      faceTextureRotation: finiteNumber(raw.tiles?.faceTextureRotation, DEFAULT_DEV_TUNING.tiles.faceTextureRotation),
      bodyColor: typeof raw.tiles?.bodyColor === 'string' ? raw.tiles.bodyColor : DEFAULT_DEV_TUNING.tiles.bodyColor,
      bodyRoughness: finiteNumber(raw.tiles?.bodyRoughness, DEFAULT_DEV_TUNING.tiles.bodyRoughness),
      faceTint: typeof raw.tiles?.faceTint === 'string' ? raw.tiles.faceTint : DEFAULT_DEV_TUNING.tiles.faceTint,
      ownScale: finiteNumber(raw.tiles?.ownScale, DEFAULT_DEV_TUNING.tiles.ownScale),
      opponentScale: finiteNumber(raw.tiles?.opponentScale, DEFAULT_DEV_TUNING.tiles.opponentScale),
      riverScale: finiteNumber(raw.tiles?.riverScale, DEFAULT_DEV_TUNING.tiles.riverScale),
      meldScale: finiteNumber(raw.tiles?.meldScale, DEFAULT_DEV_TUNING.tiles.meldScale),
      riverDepth: finiteNumber(raw.tiles?.riverDepth, DEFAULT_DEV_TUNING.tiles.riverDepth),
      riverRowGap: finiteNumber(raw.tiles?.riverRowGap, DEFAULT_DEV_TUNING.tiles.riverRowGap),
      riverColumnGap: finiteNumber(raw.tiles?.riverColumnGap, DEFAULT_DEV_TUNING.tiles.riverColumnGap),
    },
    tableGeometry: {
      frameTopY: finiteNumber(raw.tableGeometry?.frameTopY, DEFAULT_DEV_TUNING.tableGeometry.frameTopY),
      feltTopY: finiteNumber(raw.tableGeometry?.feltTopY, DEFAULT_DEV_TUNING.tableGeometry.feltTopY),
      frameWidth: finiteNumber(raw.tableGeometry?.frameWidth, DEFAULT_DEV_TUNING.tableGeometry.frameWidth),
      frameThickness: finiteNumber(raw.tableGeometry?.frameThickness, DEFAULT_DEV_TUNING.tableGeometry.frameThickness),
      feltThickness: finiteNumber(raw.tableGeometry?.feltThickness, DEFAULT_DEV_TUNING.tableGeometry.feltThickness),
    },
    ui: {
      playerCardScale: finiteNumber(raw.ui?.playerCardScale, DEFAULT_DEV_TUNING.ui.playerCardScale),
      playerInsetTB: finiteNumber(raw.ui?.playerInsetTB, finiteNumber(raw.ui?.playerInset, DEFAULT_DEV_TUNING.ui.playerInsetTB)),
      playerInsetSides: finiteNumber(raw.ui?.playerInsetSides, finiteNumber(raw.ui?.playerInset, DEFAULT_DEV_TUNING.ui.playerInsetSides)),
      doraScale: finiteNumber(raw.ui?.doraScale, DEFAULT_DEV_TUNING.ui.doraScale),
      doraX: finiteNumber(raw.ui?.doraX, DEFAULT_DEV_TUNING.ui.doraX),
      doraY: finiteNumber(raw.ui?.doraY, DEFAULT_DEV_TUNING.ui.doraY),
      centerScale: finiteNumber(raw.ui?.centerScale, DEFAULT_DEV_TUNING.ui.centerScale),
      centerOffsetX: finiteNumber(raw.ui?.centerOffsetX, DEFAULT_DEV_TUNING.ui.centerOffsetX),
      centerOffsetY: finiteNumber(raw.ui?.centerOffsetY, DEFAULT_DEV_TUNING.ui.centerOffsetY),
      centerWidth: finiteNumber(raw.ui?.centerWidth, DEFAULT_DEV_TUNING.ui.centerWidth),
      centerHeight: finiteNumber(raw.ui?.centerHeight, DEFAULT_DEV_TUNING.ui.centerHeight),
      reactionScale: finiteNumber(raw.ui?.reactionScale, DEFAULT_DEV_TUNING.ui.reactionScale),
      gameLogWidth: finiteNumber(raw.ui?.gameLogWidth, DEFAULT_DEV_TUNING.ui.gameLogWidth),
    },
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULT_DEV_TUNING.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
    woodColor: typeof raw.woodColor === 'string' ? raw.woodColor : DEFAULT_DEV_TUNING.woodColor,
    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULT_DEV_TUNING.backColor,
  };
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function setConfiguredRotation(transform: Transform, rotation: DevRotation): void {
  transform.pitch = radians(rotation.x);
  transform.yaw = radians(rotation.y);
  transform.roll = radians(rotation.z);
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
  const tuning = readDevTuning();
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
    transform.z = 4.24;
    // The human rack stands on the narrow edge. The tile face points toward the bottom player.
    transform.y = .42;
    setConfiguredRotation(transform, tuning.bottom);
    transform.scale = 1.03 * tuning.tiles.ownScale;
  } else if (spec.zone === 'river') {
    const row = Math.floor(spec.index / 6);
    const col = spec.index % 6;
    // Keep the organic placement, but anchor every discard to a predictable outer row so
    // the centre counter never covers the river.
    const cross = (col - 2.5) * tuning.tiles.riverColumnGap;
    const depth = tuning.tiles.riverDepth + row * tuning.tiles.riverRowGap;
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
    transform.scale = .88 * tuning.tiles.riverScale;
    if (spec.latest) {
      transform.y += .09;
      transform.scale = .94 * tuning.tiles.riverScale;
      if (spec.side === 'bottom') transform.z -= .15;
      if (spec.side === 'top') transform.z += .15;
      if (spec.side === 'left') transform.x += .15;
      if (spec.side === 'right') transform.x -= .15;
    }
  } else if (spec.zone === 'rack') {
    const centered = spec.index - (spec.total - 1) / 2;
    const spacing = .39;
    transform.y = .37;
    transform.scale = .84 * tuning.tiles.opponentScale;
    if (spec.side === 'top') {
      transform.x = centered * spacing;
      transform.z = -4.28;
      setConfiguredRotation(transform, tuning.top);
    } else if (spec.side === 'left') {
      transform.x = -5.28;
      transform.z = centered * spacing;
      setConfiguredRotation(transform, tuning.left);
    } else {
      transform.x = 5.28;
      transform.z = -centered * spacing;
      setConfiguredRotation(transform, tuning.right);
    }
  } else {
    const row = Math.floor(spec.index / 8);
    const col = spec.index % 8;
    transform.scale = .80 * tuning.tiles.meldScale;
    if (spec.side === 'bottom') {
      // Own open melds live in the lower-right corner and grow leftward.
      transform.x = 5.05 - col * .44;
      transform.z = 3.48 - row * .58;
    } else if (spec.side === 'top') {
      transform.x = -5.05 + col * .44;
      transform.z = -3.58 + row * .58;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -4.98 + row * .58;
      transform.z = 3.72 - col * .44;
      transform.yaw = Math.PI / 2;
    } else {
      transform.x = 4.98 - row * .58;
      transform.z = -3.72 + col * .44;
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
    position = spec.latest ? .005 : .010;
    yaw = .018;
    tilt = .003;
  } else if (spec.zone === 'meld') {
    position = .008;
    yaw = .015;
    tilt = .004;
  } else if (spec.zone === 'hand') {
    position = .004;
    yaw = 0;
    tilt = 0;
  } else {
    position = .002;
    yaw = 0;
    tilt = 0;
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

function roundedBackShellGeometry(THREE: any): any {
  const width = .448;
  const depth = .588;
  const height = .040;
  const radius = .058;
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
    depth: height, steps: 1, curveSegments: 6, bevelEnabled: true,
    bevelSegments: 2, bevelSize: .009, bevelThickness: .009,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.center();
  return geometry;
}

function roundedFaceGeometry(THREE: any, width: number, depth: number, radius: number): any {
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
  const geometry = new THREE.ShapeGeometry(shape, 8);
  const positions = geometry.getAttribute('position');
  const uvs = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(index, (positions.getX(index) - x0) / width, (positions.getY(index) - y0) / depth);
  }
  uvs.needsUpdate = true;
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
  const tuning = readDevTuning();
  const texture = new rt.THREE.CanvasTexture(createFaceCanvas(label, false, rt.faceMode));
  texture.colorSpace = rt.THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, rt.renderer.capabilities.getMaxAnisotropy());
  texture.center.set(.5, .5);
  texture.rotation = radians(tuning.tiles.faceTextureRotation);
  const material = new rt.THREE.MeshStandardMaterial({
    map: texture,
    color: tuning.tiles.faceTint,
    roughness: .56,
    metalness: 0,
    side: rt.THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
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

  // A shallow coloured cap overlaps the body bevel. The printed back stays inset, while the
  // back colour itself wraps onto the side/top/bottom edges like a real two-piece mahjong tile.
  const rearShell = new THREE.Mesh(rt.backShellGeometry, rt.backShellMaterial);
  rearShell.position.y = -.103;
  rearShell.castShadow = true;
  rearShell.receiveShadow = true;
  visual.add(rearShell);

  const faceTuning = readDevTuning().tiles;
  const face = new THREE.Mesh(rt.faceGeometry, materialForFace(rt, spec.label, spec.back));
  face.position.y = faceTuning.faceOffset;
  face.rotation.x = radians(faceTuning.faceRotateX);
  face.scale.setScalar(faceTuning.faceScale);
  face.renderOrder = 4;
  face.receiveShadow = true;
  visual.add(face);

  // A separate physical rear face matters once a hand stands upright: opponents' tile faces point
  // toward their owners, while the centre/camera must see the tile backs rather than bare ivory.
  const rear = new THREE.Mesh(rt.backGeometry, rt.backMaterial);
  rear.position.y = -TILE_BACK_OFFSET;
  rear.rotation.x = Math.PI / 2;
  rear.renderOrder = 2;
  rear.receiveShadow = true;
  visual.add(rear);

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
    rear,
    rearShell,
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
  actor.rear.userData.actorKey = actor.key;
  actor.rearShell.userData.actorKey = actor.key;
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
      // Until a visible wall exists, new draws appear directly in the receiving hand.
      // This avoids tiles flying in from another player's rack / the synthetic wall origin.
      if (rt.initialized && spec.zone === 'river' && spec.side !== 'bottom') {
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
  syncWorldUiAnchor(rt);
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

  const tuning = readDevTuning();
  const camera = new THREE.PerspectiveCamera(tuning.camera.fov, 1, .1, 60);
  camera.position.set(tuning.camera.x, tuning.camera.y, tuning.camera.z);
  camera.lookAt(tuning.camera.targetX, tuning.camera.targetY, tuning.camera.targetZ);

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

  const tableBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: tuning.woodColor, roughness: .72, metalness: .015,
  });
  const frame = new THREE.Group();
  for (const name of ['frame-top', 'frame-bottom', 'frame-left', 'frame-right']) {
    const rail = new THREE.Mesh(tableBoxGeometry, woodMaterial);
    rail.name = name;
    rail.castShadow = true;
    rail.receiveShadow = true;
    frame.add(rail);
  }
  scene.add(frame);

  const underlay = new THREE.Mesh(tableBoxGeometry, woodMaterial);
  underlay.castShadow = true;
  underlay.receiveShadow = true;
  scene.add(underlay);

  const feltMaterial = new THREE.MeshStandardMaterial({
    color: tuning.tableImage ? 0xffffff : tuning.tableColor,
    roughness: .96,
    metalness: 0,
  });
  const felt = new THREE.Mesh(tableBoxGeometry, feltMaterial);
  felt.receiveShadow = true;
  scene.add(felt);

  const actorRoot = new THREE.Group();
  scene.add(actorRoot);

  const tileGeometry = roundedTileGeometry(THREE);
  const faceGeometry = roundedFaceGeometry(THREE, .39, .53, .038);
  // Pattern is intentionally inset; the separate 3D shell provides the coloured edge spill.
  const backGeometry = roundedFaceGeometry(THREE, .405, .545, .043);
  const backShellGeometry = roundedBackShellGeometry(THREE);
  const ivoryMaterial = new THREE.MeshStandardMaterial({
    color: tuning.tiles.bodyColor,
    roughness: tuning.tiles.bodyRoughness,
    metalness: 0,
  });
  const backTexture = new THREE.CanvasTexture(createFaceCanvas(null, true, 'classic'));
  backTexture.colorSpace = THREE.SRGBColorSpace;
  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture, color: tuning.backColor, roughness: .58, metalness: 0,
    side: THREE.DoubleSide,
  });
  const backShellMaterial = new THREE.MeshStandardMaterial({
    color: tuning.backColor, roughness: .58, metalness: 0,
  });

  const rt: TableRuntime = {
    THREE,
    renderer,
    scene,
    camera,
    actorRoot,
    frame,
    underlay,
    felt,
    tableBoxGeometry,
    woodMaterial,
    tileGeometry,
    faceGeometry,
    backGeometry,
    backShellGeometry,
    ivoryMaterial,
    feltMaterial,
    backMaterial,
    backShellMaterial,
    tableTexture: null,
    tableTextureSource: null,
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

  applyDevTuning(rt);
  renderer.setAnimationLoop((time: number) => frameRuntime(rt, time));
  return rt;
}

function applyTableGeometry(rt: TableRuntime, tuning: DevTuning): void {
  const outerWidth = 12.25;
  const outerDepth = 9.85;
  const frameWidth = Math.max(.12, Math.min(1.2, tuning.tableGeometry.frameWidth));
  const frameThickness = Math.max(.06, tuning.tableGeometry.frameThickness);
  const feltThickness = Math.max(.02, tuning.tableGeometry.feltThickness);
  const innerWidth = Math.max(1, outerWidth - frameWidth * 2);
  const innerDepth = Math.max(1, outerDepth - frameWidth * 2);
  const railY = tuning.tableGeometry.frameTopY - frameThickness / 2;

  const top = rt.frame.getObjectByName('frame-top');
  const bottom = rt.frame.getObjectByName('frame-bottom');
  const left = rt.frame.getObjectByName('frame-left');
  const right = rt.frame.getObjectByName('frame-right');
  top?.scale.set(outerWidth, frameThickness, frameWidth);
  bottom?.scale.set(outerWidth, frameThickness, frameWidth);
  left?.scale.set(frameWidth, frameThickness, innerDepth);
  right?.scale.set(frameWidth, frameThickness, innerDepth);
  top?.position.set(0, railY, -(outerDepth / 2 - frameWidth / 2));
  bottom?.position.set(0, railY, outerDepth / 2 - frameWidth / 2);
  left?.position.set(-(outerWidth / 2 - frameWidth / 2), railY, 0);
  right?.position.set(outerWidth / 2 - frameWidth / 2, railY, 0);

  rt.felt.scale.set(innerWidth - .02, feltThickness, innerDepth - .02);
  rt.felt.position.set(0, tuning.tableGeometry.feltTopY - feltThickness / 2, 0);

  // The underlay is deliberately below both top surfaces. It gives the table visible body/depth
  // without ever intersecting the felt from above when the dev sliders are moved.
  const frameBottom = tuning.tableGeometry.frameTopY - frameThickness;
  const feltBottom = tuning.tableGeometry.feltTopY - feltThickness;
  const underlayTop = Math.min(frameBottom, feltBottom) - .025;
  const underlayThickness = .22;
  rt.underlay.scale.set(outerWidth - .04, underlayThickness, outerDepth - .04);
  rt.underlay.position.set(0, underlayTop - underlayThickness / 2, 0);
}

function syncWorldUiAnchor(rt: TableRuntime): void {
  if (!rt.table) return;
  const rect = rt.table.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  rt.camera.updateMatrixWorld(true);
  const anchor = new rt.THREE.Vector3(0, rt.felt.position.y + rt.felt.scale.y / 2, 0);
  anchor.project(rt.camera);
  const x = (anchor.x * .5 + .5) * rect.width;
  const y = (-anchor.y * .5 + .5) * rect.height;
  rt.table.style.setProperty('--table-3d-world-center-x', `${x.toFixed(2)}px`);
  rt.table.style.setProperty('--table-3d-world-center-y', `${y.toFixed(2)}px`);
}

function syncTableTexture(rt: TableRuntime, source: string | null): void {
  if (source === rt.tableTextureSource) return;
  rt.tableTextureSource = source;
  rt.tableTexture?.dispose?.();
  rt.tableTexture = null;
  rt.feltMaterial.map = null;
  rt.feltMaterial.needsUpdate = true;
  if (!source) return;
  new rt.THREE.TextureLoader().load(source, (texture: any) => {
    if (rt.disposed || rt.tableTextureSource !== source) { texture.dispose(); return; }
    texture.colorSpace = rt.THREE.SRGBColorSpace;
    rt.tableTexture = texture;
    rt.feltMaterial.map = texture;
    rt.feltMaterial.color.set(0xffffff);
    rt.feltMaterial.needsUpdate = true;
  }, undefined, () => {
    if (rt.tableTextureSource === source) {
      rt.tableTextureSource = null;
      rt.feltMaterial.map = null;
      rt.feltMaterial.color.set(readDevTuning().tableColor);
      rt.feltMaterial.needsUpdate = true;
    }
  });
}

function applyDevTuning(rt: TableRuntime): void {
  const tuning = readDevTuning();
  rt.camera.fov = tuning.camera.fov;
  rt.camera.position.set(tuning.camera.x, tuning.camera.y, tuning.camera.z);
  rt.camera.lookAt(tuning.camera.targetX, tuning.camera.targetY, tuning.camera.targetZ);
  rt.camera.updateProjectionMatrix();
  rt.woodMaterial.color.set(tuning.woodColor);
  rt.ivoryMaterial.color.set(tuning.tiles.bodyColor);
  rt.ivoryMaterial.roughness = tuning.tiles.bodyRoughness;
  rt.ivoryMaterial.needsUpdate = true;
  applyTableGeometry(rt, tuning);
  rt.backMaterial.color.set(tuning.backColor);
  rt.backShellMaterial.color.set(tuning.backColor);
  rt.feltMaterial.color.set(tuning.tableImage ? 0xffffff : tuning.tableColor);
  for (const material of rt.faceMaterials.values()) {
    material.color?.set?.(tuning.tiles.faceTint);
    if (material.map) {
      material.map.center.set(.5, .5);
      material.map.rotation = radians(tuning.tiles.faceTextureRotation);
      material.map.needsUpdate = true;
    }
  }
  for (const actor of rt.actors.values()) {
    actor.face.position.y = tuning.tiles.faceOffset;
    actor.face.rotation.x = radians(tuning.tiles.faceRotateX);
    actor.face.scale.setScalar(tuning.tiles.faceScale);
  }
  syncTableTexture(rt, tuning.tableImage);
  syncWorldUiAnchor(rt);
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
  rt.tableBoxGeometry.dispose();
  rt.woodMaterial.dispose();
  rt.tileGeometry.dispose();
  rt.faceGeometry.dispose();
  rt.backGeometry.dispose();
  rt.backShellGeometry.dispose();
  rt.ivoryMaterial.dispose();
  rt.feltMaterial.dispose();
  rt.backShellMaterial.dispose();
  rt.tableTexture?.dispose?.();
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
  applyDevTuning(rt);
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
window.addEventListener('mahjong-live:dev-tuning', scheduleReconcile);
window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
window.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
window.addEventListener('pointerup', onPointerUp, { passive: true, capture: true });
window.addEventListener('blur', onPointerLeave);
window.addEventListener('pagehide', disposeRuntime, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) onPointerLeave();
});
scheduleReconcile();