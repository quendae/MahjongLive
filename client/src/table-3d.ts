import './table-3d.css';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';
const MODE_KEY = 'mahjong-live:table-3d:v1';
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let enabled = localStorage.getItem(MODE_KEY) !== '0';
let threePromise: Promise<any> | null = null;
let loadError = false;
let runtime: TableRuntime | null = null;
let reconcileScheduled = false;
let reconcileGeneration = 0;

type TableRuntime = {
  THREE: any;
  table: HTMLElement;
  renderer: any;
  scene: any;
  camera: any;
  tileRoot: any;
  fxRoot: any;
  tileGeometry: any;
  faceGeometry: any;
  ivoryMaterial: any;
  backMaterial: any;
  faceMaterials: Map<string, any>;
  resizeObserver: ResizeObserver;
  disposed: boolean;
};

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
    if (!enabled) disposeRuntime();
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

function createFaceCanvas(label: string | null, back = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 216;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = back ? '#315c49' : '#f7f1df';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = back ? '#8fb39f' : '#c8bea9';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 150, 206);

  if (back) {
    ctx.strokeStyle = 'rgba(232,244,236,.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, 124, 180);
    for (let y = 28; y < 195; y += 18) {
      for (let x = 25; x < 145; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x, y - 5);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 5);
        ctx.closePath();
        ctx.stroke();
      }
    }
    return canvas;
  }

  const text = label?.trim() ?? '';
  const suited = /^(red )?([1-9])([mps])$/.exec(text);
  if (suited) {
    const red = Boolean(suited[1]);
    const rank = Number(suited[2]);
    const suit = suited[3];
    if (suit === 'm') drawMan(ctx, rank, red);
    else if (suit === 'p') drawPin(ctx, rank, red);
    else drawSou(ctx, rank, red);
    return canvas;
  }

  const glyphs: Record<string, { glyph: string; color: string }> = {
    east: { glyph: '東', color: '#26372f' },
    south: { glyph: '南', color: '#26372f' },
    west: { glyph: '西', color: '#26372f' },
    north: { glyph: '北', color: '#26372f' },
    'red dragon': { glyph: '中', color: '#bb3a34' },
    'green dragon': { glyph: '發', color: '#26744e' },
  };
  if (text === 'white dragon') {
    ctx.strokeStyle = '#38749a';
    ctx.lineWidth = 9;
    ctx.strokeRect(39, 36, 82, 144);
    ctx.lineWidth = 3;
    ctx.strokeRect(49, 48, 62, 120);
    return canvas;
  }
  const honor = glyphs[text];
  if (honor) {
    ctx.fillStyle = honor.color;
    ctx.font = 'bold 112px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(honor.glyph, 80, 111);
  }
  return canvas;
}

function drawMan(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 82px Georgia, "Times New Roman", serif';
  ctx.fillStyle = red ? '#c23b34' : '#26362f';
  ctx.fillText(numerals[rank - 1] ?? String(rank), 80, 76);
  ctx.font = 'bold 70px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#b63b34';
  ctx.fillText('萬', 80, 158);
}

function pinLayout(rank: number): readonly [number, number][] {
  const layouts: Record<number, readonly [number, number][]> = {
    1: [[80, 108]],
    2: [[55, 62], [105, 154]],
    3: [[52, 54], [80, 108], [108, 162]],
    4: [[53, 57], [107, 57], [53, 159], [107, 159]],
    5: [[53, 52], [107, 52], [80, 108], [53, 164], [107, 164]],
    6: [[53, 43], [107, 43], [53, 108], [107, 108], [53, 173], [107, 173]],
    7: [[42, 42], [80, 42], [118, 42], [55, 105], [105, 105], [55, 166], [105, 166]],
    8: [[53, 34], [107, 34], [53, 83], [107, 83], [53, 133], [107, 133], [53, 182], [107, 182]],
    9: [[40, 39], [80, 39], [120, 39], [40, 108], [80, 108], [120, 108], [40, 177], [80, 177], [120, 177]],
  };
  return layouts[rank] ?? [];
}

function drawPin(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  const palette = red ? ['#bd3b34'] : ['#306c97', '#bd3b34', '#2f7952'];
  pinLayout(rank).forEach(([x, y], index) => {
    const color = palette[index % palette.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = rank === 1 ? 10 : 7;
    ctx.beginPath();
    ctx.arc(x, y, rank === 1 ? 34 : 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, rank === 1 ? 20 : 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, rank === 1 ? 7 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function souLayout(rank: number): readonly [number, number, number][] {
  const layouts: Record<number, readonly [number, number, number][]> = {
    2: [[60, 68, -8], [100, 148, 8]],
    3: [[58, 54, -8], [102, 108, 8], [58, 162, -8]],
    4: [[58, 61, -7], [102, 61, 7], [58, 155, -7], [102, 155, 7]],
    5: [[58, 54, -7], [102, 54, 7], [80, 108, 0], [58, 162, -7], [102, 162, 7]],
    6: [[57, 45, -6], [103, 45, 6], [57, 108, -6], [103, 108, 6], [57, 171, -6], [103, 171, 6]],
    7: [[42, 45, -8], [80, 45, 0], [118, 45, 8], [58, 108, -6], [102, 108, 6], [58, 171, -6], [102, 171, 6]],
    8: [[57, 34, -6], [103, 34, 6], [57, 83, -6], [103, 83, 6], [57, 133, -6], [103, 133, 6], [57, 182, -6], [103, 182, 6]],
    9: [[42, 39, -7], [80, 39, 0], [118, 39, 7], [42, 108, -7], [80, 108, 0], [118, 108, 7], [42, 177, -7], [80, 177, 0], [118, 177, 7]],
  };
  return layouts[rank] ?? [];
}

function drawSou(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  if (rank === 1) {
    ctx.strokeStyle = red ? '#bd3b34' : '#287650';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(80, 184);
    ctx.quadraticCurveTo(74, 104, 81, 49);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(80, 90);
    ctx.quadraticCurveTo(48, 70, 37, 38);
    ctx.moveTo(80, 110);
    ctx.quadraticCurveTo(111, 82, 122, 49);
    ctx.stroke();
    ctx.fillStyle = red ? '#bd3b34' : '#356f96';
    ctx.beginPath();
    ctx.ellipse(93, 39, 19, 30, .45, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const green = red ? '#bd3b34' : '#2c7952';
  souLayout(rank).forEach(([x, y, angle]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.roundRect(-9, -25, 18, 50, 8);
    ctx.fill();
    ctx.strokeStyle = '#eef0df';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.restore();
  });
}

function materialForFace(rt: TableRuntime, label: string | null, back = false): any {
  if (back) return rt.backMaterial;
  const key = label ?? 'blank';
  const cached = rt.faceMaterials.get(key);
  if (cached) return cached;
  const texture = new rt.THREE.CanvasTexture(createFaceCanvas(label));
  texture.colorSpace = rt.THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, rt.renderer.capabilities.getMaxAnisotropy());
  const material = new rt.THREE.MeshStandardMaterial({
    map: texture,
    roughness: .66,
    metalness: 0,
  });
  rt.faceMaterials.set(key, material);
  return material;
}

function createTileMesh(
  rt: TableRuntime,
  element: Element | null,
  options: { back?: boolean; scale?: number; fresh?: boolean } = {},
): any {
  const THREE = rt.THREE;
  const group = new THREE.Group();
  const body = new THREE.Mesh(rt.tileGeometry, rt.ivoryMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const back = options.back === true || element?.classList.contains('tile-back') === true;
  const label = back ? null : element?.getAttribute('aria-label') ?? null;
  const face = new THREE.Mesh(rt.faceGeometry, materialForFace(rt, label, back));
  face.position.y = .071;
  face.rotation.x = -Math.PI / 2;
  face.receiveShadow = true;
  group.add(face);

  const scale = options.scale ?? 1;
  group.scale.setScalar(scale);
  group.userData.targetY = .24;
  if (options.fresh && !reducedMotion) {
    group.position.y = 1.25;
    group.rotation.x = -.28;
    group.userData.birth = performance.now();
  } else {
    group.position.y = group.userData.targetY;
  }
  return group;
}

function placeRiverTile(mesh: any, side: string, index: number): void {
  const row = Math.floor(index / 6);
  const col = index % 6;
  const spacingX = .5;
  const spacingZ = .6;
  if (side === 'bottom') {
    mesh.position.x = (col - 2.5) * spacingX;
    mesh.position.z = 1.22 + row * spacingZ;
  } else if (side === 'top') {
    mesh.position.x = (2.5 - col) * spacingX;
    mesh.position.z = -1.22 - row * spacingZ;
    mesh.rotation.y = Math.PI;
  } else if (side === 'left') {
    mesh.position.x = -1.45 - row * spacingZ;
    mesh.position.z = (col - 2.5) * spacingX;
    mesh.rotation.y = Math.PI / 2;
  } else {
    mesh.position.x = 1.45 + row * spacingZ;
    mesh.position.z = (2.5 - col) * spacingX;
    mesh.rotation.y = -Math.PI / 2;
  }
}

function placeRackTile(mesh: any, side: string, index: number, total: number): void {
  const centered = index - (total - 1) / 2;
  if (side === 'top') {
    mesh.position.x = centered * .35;
    mesh.position.z = -3.55;
    mesh.rotation.y = Math.PI;
  } else if (side === 'left') {
    mesh.position.x = -4.2;
    mesh.position.z = centered * .35;
    mesh.rotation.y = Math.PI / 2;
  } else if (side === 'right') {
    mesh.position.x = 4.2;
    mesh.position.z = -centered * .35;
    mesh.rotation.y = -Math.PI / 2;
  }
}

function placeMeldTile(mesh: any, side: string, index: number, total: number): void {
  const centered = index - (total - 1) / 2;
  if (side === 'bottom') {
    mesh.position.x = 2.2 + centered * .42;
    mesh.position.z = 3.25;
  } else if (side === 'top') {
    mesh.position.x = -2.2 - centered * .42;
    mesh.position.z = -3.18;
    mesh.rotation.y = Math.PI;
  } else if (side === 'left') {
    mesh.position.x = -3.78;
    mesh.position.z = 2.05 + centered * .42;
    mesh.rotation.y = Math.PI / 2;
  } else {
    mesh.position.x = 3.78;
    mesh.position.z = -2.05 - centered * .42;
    mesh.rotation.y = -Math.PI / 2;
  }
}

function zoneSide(zone: Element): 'bottom' | 'top' | 'left' | 'right' {
  if (zone.classList.contains('player-top')) return 'top';
  if (zone.classList.contains('player-left')) return 'left';
  if (zone.classList.contains('player-right')) return 'right';
  return 'bottom';
}

function rebuildDynamicScene(rt: TableRuntime): void {
  rt.tileRoot.clear();
  rt.fxRoot.clear();

  app.querySelectorAll<HTMLElement>('.player-zone').forEach((zone) => {
    const side = zoneSide(zone);
    const river = [...zone.querySelectorAll<HTMLElement>('.discard-river .tile')];
    river.forEach((element, index) => {
      const mesh = createTileMesh(rt, element, {
        scale: .86,
        fresh: element.classList.contains('tile-fresh'),
      });
      placeRiverTile(mesh, side, index);
      rt.tileRoot.add(mesh);
    });

    if (side !== 'bottom') {
      const concealed = [...zone.querySelectorAll<HTMLElement>('.opponent-hand .tile')];
      concealed.forEach((element, index) => {
        const mesh = createTileMesh(rt, element, { back: true, scale: .72 });
        placeRackTile(mesh, side, index, concealed.length);
        rt.tileRoot.add(mesh);
      });
    }

    const meldTiles = [...zone.querySelectorAll<HTMLElement>('.meld-row .tile')];
    meldTiles.forEach((element, index) => {
      const mesh = createTileMesh(rt, element, { scale: .72 });
      placeMeldTile(mesh, side, index, meldTiles.length);
      rt.tileRoot.add(mesh);
    });
  });

  addTurnMarker(rt);
  addWall(rt);
}

function addTurnMarker(rt: TableRuntime): void {
  const text = app.querySelector('.turn-indicator')?.textContent?.trim() ?? '';
  const actor = /^(You|Bot \d+) to act$/.exec(text)?.[1];
  if (!actor) return;
  const zone = [...app.querySelectorAll<HTMLElement>('.player-zone')].find(
    (candidate) => candidate.querySelector('.player-name')?.textContent?.trim() === actor,
  );
  if (!zone) return;
  const side = zoneSide(zone);
  const THREE = rt.THREE;
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(.25, .32, 40),
    new THREE.MeshBasicMaterial({ color: 0xe2c273, transparent: true, opacity: .8, side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = .235;
  if (side === 'bottom') marker.position.set(0, .235, 3.62);
  if (side === 'top') marker.position.set(0, .235, -3.62);
  if (side === 'left') marker.position.set(-4.18, .235, 0);
  if (side === 'right') marker.position.set(4.18, .235, 0);
  rt.fxRoot.add(marker);
}

function remainingDraws(): number {
  const parts = [...app.querySelectorAll<HTMLElement>('.center-meta span')];
  for (const part of parts) {
    const match = /^(\d+) draws$/.exec(part.textContent?.trim() ?? '');
    if (match) return Number(match[1]);
  }
  return 0;
}

function addWall(rt: TableRuntime): void {
  const draws = Math.max(0, Math.min(70, remainingDraws()));
  const stacks = Math.ceil(draws / 2);
  for (let index = 0; index < stacks; index += 1) {
    const sideIndex = index % 4;
    const slot = Math.floor(index / 4);
    const offset = (slot - 8) * .43;
    const top = createTileMesh(rt, null, { back: true, scale: .7 });
    const bottom = createTileMesh(rt, null, { back: true, scale: .7 });
    const meshes = draws % 2 === 1 && index === stacks - 1 ? [top] : [bottom, top];
    meshes.forEach((mesh, layer) => {
      mesh.position.y = .20 + layer * .10;
      if (sideIndex === 0) {
        mesh.position.x = offset;
        mesh.position.z = -4.0;
      } else if (sideIndex === 1) {
        mesh.position.x = 4.62;
        mesh.position.z = offset;
        mesh.rotation.y = Math.PI / 2;
      } else if (sideIndex === 2) {
        mesh.position.x = -offset;
        mesh.position.z = 4.0;
        mesh.rotation.y = Math.PI;
      } else {
        mesh.position.x = -4.62;
        mesh.position.z = -offset;
        mesh.rotation.y = -Math.PI / 2;
      }
      rt.tileRoot.add(mesh);
    });
  }
}

function createRuntime(THREE: any, table: HTMLElement): TableRuntime {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'table-3d-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b2017, 11, 24);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 50);
  camera.position.set(0, 9.2, 10.6);
  camera.lookAt(0, .15, 0);

  const ambient = new THREE.HemisphereLight(0xf4ead1, 0x0a1710, 1.45);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffefd0, 2.5);
  key.position.set(-4, 10, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  scene.add(key);
  const rim = new THREE.PointLight(0x7bb995, 1.2, 14, 2);
  rim.position.set(4, 3.5, -4);
  scene.add(rim);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, .46, 8.7),
    new THREE.MeshStandardMaterial({ color: 0x38291f, roughness: .72, metalness: .02 }),
  );
  base.position.y = -.28;
  base.receiveShadow = true;
  base.castShadow = true;
  scene.add(base);

  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(9.85, .18, 7.95),
    new THREE.MeshStandardMaterial({ color: 0x174a36, roughness: .94, metalness: 0 }),
  );
  felt.position.y = .02;
  felt.receiveShadow = true;
  scene.add(felt);

  const innerLine = new THREE.Mesh(
    new THREE.RingGeometry(2.8, 2.83, 64),
    new THREE.MeshBasicMaterial({ color: 0x8fad9c, transparent: true, opacity: .13, side: THREE.DoubleSide }),
  );
  innerLine.scale.set(1.55, 1.1, 1);
  innerLine.rotation.x = -Math.PI / 2;
  innerLine.position.y = .13;
  scene.add(innerLine);

  const tileRoot = new THREE.Group();
  const fxRoot = new THREE.Group();
  scene.add(tileRoot, fxRoot);

  const tileGeometry = new THREE.BoxGeometry(.42, .14, .56, 2, 1, 2);
  const faceGeometry = new THREE.PlaneGeometry(.36, .50);
  const ivoryMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9dfc8,
    roughness: .58,
    metalness: 0,
  });
  const backTexture = new THREE.CanvasTexture(createFaceCanvas(null, true));
  backTexture.colorSpace = THREE.SRGBColorSpace;
  const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture, roughness: .68, metalness: 0 });

  const rt: TableRuntime = {
    THREE,
    table,
    renderer,
    scene,
    camera,
    tileRoot,
    fxRoot,
    tileGeometry,
    faceGeometry,
    ivoryMaterial,
    backMaterial,
    faceMaterials: new Map(),
    resizeObserver: new ResizeObserver(() => {}),
    disposed: false,
  };

  const resize = () => {
    if (rt.disposed || !table.isConnected) return;
    const width = Math.max(1, table.clientWidth);
    const height = Math.max(1, table.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  rt.resizeObserver = new ResizeObserver(resize);
  rt.resizeObserver.observe(table);
  resize();

  table.prepend(renderer.domElement);
  table.classList.add('table-3d-active');
  table.dataset.threeMounted = 'true';
  removeFallbackNote(table);
  rebuildDynamicScene(rt);

  renderer.setAnimationLoop((time: number) => {
    if (rt.disposed || !table.isConnected) return;
    let moving = false;
    rt.tileRoot.traverse((object: any) => {
      const birth = object.userData?.birth as number | undefined;
      if (birth === undefined) return;
      const progress = Math.min(1, (time - birth) / 260);
      const eased = 1 - Math.pow(1 - progress, 3);
      object.position.y = 1.25 + (object.userData.targetY - 1.25) * eased;
      object.rotation.x = -.28 * (1 - eased);
      moving = moving || progress < 1;
      if (progress >= 1) delete object.userData.birth;
    });
    if (!reducedMotion && moving) {
      camera.position.x = Math.sin(time / 120) * .012;
      camera.lookAt(0, .15, 0);
    } else if (camera.position.x !== 0) {
      camera.position.x = 0;
      camera.lookAt(0, .15, 0);
    }
    renderer.render(scene, camera);
  });

  return rt;
}

function disposeRuntime(): void {
  if (!runtime) return;
  const rt = runtime;
  runtime = null;
  rt.disposed = true;
  rt.resizeObserver.disconnect();
  rt.renderer.setAnimationLoop(null);
  rt.table.classList.remove('table-3d-active');
  delete rt.table.dataset.threeMounted;
  rt.renderer.domElement.remove();
  rt.tileGeometry.dispose();
  rt.faceGeometry.dispose();
  rt.ivoryMaterial.dispose();
  rt.backMaterial.map?.dispose?.();
  rt.backMaterial.dispose();
  for (const material of rt.faceMaterials.values()) {
    material.map?.dispose?.();
    material.dispose?.();
  }
  rt.renderer.dispose();
}

async function reconcile(): Promise<void> {
  reconcileScheduled = false;
  ensureModeButton();
  updateModeButton();

  const table = app.querySelector<HTMLElement>('.mahjong-table');
  if (!enabled || !table) {
    disposeRuntime();
    return;
  }

  if (runtime && runtime.table === table && table.isConnected) {
    rebuildDynamicScene(runtime);
    updateModeButton();
    return;
  }

  disposeRuntime();
  const generation = ++reconcileGeneration;
  try {
    const THREE = await loadThree();
    if (generation !== reconcileGeneration || !enabled || !table.isConnected) return;
    runtime = createRuntime(THREE, table);
    loadError = false;
    updateModeButton();
  } catch (error) {
    console.warn('Mahjong Live 3D renderer unavailable; keeping 2D table.', error);
    if (table.isConnected) fallbackNote(table, '3D renderer unavailable — using the fully playable 2D table.');
    updateModeButton();
  }
}

function scheduleReconcile(): void {
  if (reconcileScheduled) return;
  reconcileScheduled = true;
  requestAnimationFrame(() => void reconcile());
}

const observer = new MutationObserver(() => {
  if (runtime && !runtime.table.isConnected) disposeRuntime();
  scheduleReconcile();
});
observer.observe(app, { childList: true, subtree: true });
scheduleReconcile();
