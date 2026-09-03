import fs from 'node:fs';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing block: ${label}`);
  return source.replace(before, after);
}

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No changes made to ${path}`);
  fs.writeFileSync(path, after);
}

update('client/src/dev-tuning.ts', (input) => {
  let s = input;

  s = replaceRequired(s,
`type DevTuning = {
  camera: CameraSettings;
  left: Rotation;
  right: Rotation;
  top: Rotation;
  bottom: Rotation;
  tableColor: string;
  tableImage: string | null;
  backColor: string;
};`,
`type DevTuning = {
  camera: CameraSettings;
  left: Rotation;
  right: Rotation;
  top: Rotation;
  bottom: Rotation;
  tiles: {
    faceOffset: number;
    faceRotateX: number;
    faceScale: number;
    ownScale: number;
    opponentScale: number;
    riverScale: number;
    meldScale: number;
  };
  tableGeometry: {
    woodY: number;
    feltY: number;
  };
  ui: {
    playerCardScale: number;
    playerInset: number;
    doraScale: number;
    doraX: number;
    doraY: number;
    centerScale: number;
    reactionScale: number;
    gameLogWidth: number;
  };
  tableColor: string;
  tableImage: string | null;
  backColor: string;
};`, 'dev tuning type');

  s = replaceRequired(s,
`const DEFAULTS: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },
  tableColor: '#174a36',
  tableImage: null,
  backColor: '#315c49',
};`,
`const DEFAULTS: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },
  tiles: {
    faceOffset: .128,
    faceRotateX: -90,
    faceScale: 1,
    ownScale: 1,
    opponentScale: 1,
    riverScale: 1,
    meldScale: 1,
  },
  tableGeometry: { woodY: -.04, feltY: .02 },
  ui: {
    playerCardScale: 1,
    playerInset: 10,
    doraScale: 1,
    doraX: 24,
    doraY: 24,
    centerScale: 1,
    reactionScale: 1,
    gameLogWidth: 290,
  },
  tableColor: '#174a36',
  tableImage: null,
  backColor: '#315c49',
};`, 'dev defaults');

  s = replaceRequired(s,
`    left: rotation(raw.left, DEFAULTS.left),
    right: rotation(raw.right, DEFAULTS.right),
    top: rotation(raw.top, DEFAULTS.top),
    bottom: rotation(raw.bottom, DEFAULTS.bottom),
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULTS.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,`,
`    left: rotation(raw.left, DEFAULTS.left),
    right: rotation(raw.right, DEFAULTS.right),
    top: rotation(raw.top, DEFAULTS.top),
    bottom: rotation(raw.bottom, DEFAULTS.bottom),
    tiles: {
      faceOffset: finite(raw.tiles?.faceOffset, DEFAULTS.tiles.faceOffset),
      faceRotateX: finite(raw.tiles?.faceRotateX, DEFAULTS.tiles.faceRotateX),
      faceScale: finite(raw.tiles?.faceScale, DEFAULTS.tiles.faceScale),
      ownScale: finite(raw.tiles?.ownScale, DEFAULTS.tiles.ownScale),
      opponentScale: finite(raw.tiles?.opponentScale, DEFAULTS.tiles.opponentScale),
      riverScale: finite(raw.tiles?.riverScale, DEFAULTS.tiles.riverScale),
      meldScale: finite(raw.tiles?.meldScale, DEFAULTS.tiles.meldScale),
    },
    tableGeometry: {
      woodY: finite(raw.tableGeometry?.woodY, DEFAULTS.tableGeometry.woodY),
      feltY: finite(raw.tableGeometry?.feltY, DEFAULTS.tableGeometry.feltY),
    },
    ui: {
      playerCardScale: finite(raw.ui?.playerCardScale, DEFAULTS.ui.playerCardScale),
      playerInset: finite(raw.ui?.playerInset, DEFAULTS.ui.playerInset),
      doraScale: finite(raw.ui?.doraScale, DEFAULTS.ui.doraScale),
      doraX: finite(raw.ui?.doraX, DEFAULTS.ui.doraX),
      doraY: finite(raw.ui?.doraY, DEFAULTS.ui.doraY),
      centerScale: finite(raw.ui?.centerScale, DEFAULTS.ui.centerScale),
      reactionScale: finite(raw.ui?.reactionScale, DEFAULTS.ui.reactionScale),
      gameLogWidth: finite(raw.ui?.gameLogWidth, DEFAULTS.ui.gameLogWidth),
    },
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULTS.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,`, 'dev load nested settings');

  s = replaceRequired(s,
`function applyDomPreview(): void {
  document.querySelectorAll<HTMLElement>('.mahjong-table').forEach((table) => {`,
`function applyDomPreview(): void {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--dev-player-card-scale', String(settings.ui.playerCardScale));
  rootStyle.setProperty('--dev-player-inset', \`${'${settings.ui.playerInset}'}px\`);
  rootStyle.setProperty('--dev-dora-scale', String(settings.ui.doraScale));
  rootStyle.setProperty('--dev-dora-x', \`${'${settings.ui.doraX}'}px\`);
  rootStyle.setProperty('--dev-dora-y', \`${'${settings.ui.doraY}'}px\`);
  rootStyle.setProperty('--dev-center-scale', String(settings.ui.centerScale));
  rootStyle.setProperty('--dev-reaction-scale', String(settings.ui.reactionScale));
  rootStyle.setProperty('--dev-game-log-width', \`${'${settings.ui.gameLogWidth}'}px\`);

  document.querySelectorAll<HTMLElement>('.mahjong-table').forEach((table) => {`, 'DOM preview CSS vars');

  s = replaceRequired(s,
`  rotationSection(root, 'Left opponent tiles', settings.left, DEFAULTS.left);
  rotationSection(root, 'Right opponent tiles', settings.right, DEFAULTS.right);
  rotationSection(root, 'Top opponent tiles', settings.top, DEFAULTS.top);
  rotationSection(root, 'Your tiles', settings.bottom, DEFAULTS.bottom);

  const surfaces = document.createElement('section');`,
`  rotationSection(root, 'Left opponent tiles', settings.left, DEFAULTS.left);
  rotationSection(root, 'Right opponent tiles', settings.right, DEFAULTS.right);
  rotationSection(root, 'Top opponent tiles', settings.top, DEFAULTS.top);
  rotationSection(root, 'Your tiles', settings.bottom, DEFAULTS.bottom);

  const tileSection = document.createElement('section');
  tileSection.className = 'dev-tuning-section';
  tileSection.innerHTML = '<h3>Tiles & front diagnostic</h3>';
  numberSlider(tileSection, 'Front offset', -.30, .30, .002, () => settings.tiles.faceOffset, (v) => { settings.tiles.faceOffset = v; }, '', DEFAULTS.tiles.faceOffset);
  numberSlider(tileSection, 'Front rotate X', -180, 180, 1, () => settings.tiles.faceRotateX, (v) => { settings.tiles.faceRotateX = v; }, '°', DEFAULTS.tiles.faceRotateX);
  numberSlider(tileSection, 'Front scale', .50, 1.50, .01, () => settings.tiles.faceScale, (v) => { settings.tiles.faceScale = v; }, '×', DEFAULTS.tiles.faceScale);
  numberSlider(tileSection, 'Your tile size', .60, 1.50, .01, () => settings.tiles.ownScale, (v) => { settings.tiles.ownScale = v; }, '×', DEFAULTS.tiles.ownScale);
  numberSlider(tileSection, 'Opponent size', .60, 1.50, .01, () => settings.tiles.opponentScale, (v) => { settings.tiles.opponentScale = v; }, '×', DEFAULTS.tiles.opponentScale);
  numberSlider(tileSection, 'Discard size', .50, 1.40, .01, () => settings.tiles.riverScale, (v) => { settings.tiles.riverScale = v; }, '×', DEFAULTS.tiles.riverScale);
  numberSlider(tileSection, 'Meld size', .50, 1.40, .01, () => settings.tiles.meldScale, (v) => { settings.tiles.meldScale = v; }, '×', DEFAULTS.tiles.meldScale);
  tileSection.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Front offset moves the printed face along the tile local depth. Rotate X is intentionally exposed so we can find the correct face plane orientation without another code change.</p>');
  root.append(tileSection);

  const geometry = document.createElement('section');
  geometry.className = 'dev-tuning-section';
  geometry.innerHTML = '<h3>Table geometry</h3>';
  numberSlider(geometry, 'Wood Y', -.40, .30, .005, () => settings.tableGeometry.woodY, (v) => { settings.tableGeometry.woodY = v; }, '', DEFAULTS.tableGeometry.woodY);
  numberSlider(geometry, 'Felt Y', -.20, .30, .005, () => settings.tableGeometry.feltY, (v) => { settings.tableGeometry.feltY = v; }, '', DEFAULTS.tableGeometry.feltY);
  geometry.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Default now puts the wooden frame top above the felt surface.</p>');
  root.append(geometry);

  const ui = document.createElement('section');
  ui.className = 'dev-tuning-section';
  ui.innerHTML = '<h3>UI overlays</h3>';
  numberSlider(ui, 'Player badges', .50, 2.00, .01, () => settings.ui.playerCardScale, (v) => { settings.ui.playerCardScale = v; }, '×', DEFAULTS.ui.playerCardScale);
  numberSlider(ui, 'Badge inset', 0, 80, 1, () => settings.ui.playerInset, (v) => { settings.ui.playerInset = v; }, 'px', DEFAULTS.ui.playerInset);
  numberSlider(ui, 'Dora window', .50, 2.50, .01, () => settings.ui.doraScale, (v) => { settings.ui.doraScale = v; }, '×', DEFAULTS.ui.doraScale);
  numberSlider(ui, 'Dora X', 0, 300, 1, () => settings.ui.doraX, (v) => { settings.ui.doraX = v; }, 'px', DEFAULTS.ui.doraX);
  numberSlider(ui, 'Dora Y', 0, 250, 1, () => settings.ui.doraY, (v) => { settings.ui.doraY = v; }, 'px', DEFAULTS.ui.doraY);
  numberSlider(ui, 'Center panel', .50, 2.00, .01, () => settings.ui.centerScale, (v) => { settings.ui.centerScale = v; }, '×', DEFAULTS.ui.centerScale);
  numberSlider(ui, 'Reaction popup', .50, 2.00, .01, () => settings.ui.reactionScale, (v) => { settings.ui.reactionScale = v; }, '×', DEFAULTS.ui.reactionScale);
  numberSlider(ui, 'Game log width', 180, 600, 1, () => settings.ui.gameLogWidth, (v) => { settings.ui.gameLogWidth = v; }, 'px', DEFAULTS.ui.gameLogWidth);
  root.append(ui);

  const surfaces = document.createElement('section');`, 'grouped diagnostic sections');

  return s;
});

update('client/src/table-3d.ts', (input) => {
  let s = input;

  s = replaceRequired(s,
`type DevTuning = {
  camera: { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number; fov: number };
  left: DevRotation;
  right: DevRotation;
  top: DevRotation;
  bottom: DevRotation;
  tableColor: string;
  tableImage: string | null;
  backColor: string;
};`,
`type DevTuning = {
  camera: { x: number; y: number; z: number; targetX: number; targetY: number; targetZ: number; fov: number };
  left: DevRotation;
  right: DevRotation;
  top: DevRotation;
  bottom: DevRotation;
  tiles: {
    faceOffset: number;
    faceRotateX: number;
    faceScale: number;
    ownScale: number;
    opponentScale: number;
    riverScale: number;
    meldScale: number;
  };
  tableGeometry: { woodY: number; feltY: number };
  ui: {
    playerCardScale: number;
    playerInset: number;
    doraScale: number;
    doraX: number;
    doraY: number;
    centerScale: number;
    reactionScale: number;
    gameLogWidth: number;
  };
  tableColor: string;
  tableImage: string | null;
  backColor: string;
};`, 'renderer tuning type');

  s = replaceRequired(s,
`const DEFAULT_DEV_TUNING: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },
  tableColor: '#174a36',
  tableImage: null,
  backColor: '#315c49',
};`,
`const DEFAULT_DEV_TUNING: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },
  tiles: {
    faceOffset: .128,
    faceRotateX: -90,
    faceScale: 1,
    ownScale: 1,
    opponentScale: 1,
    riverScale: 1,
    meldScale: 1,
  },
  tableGeometry: { woodY: -.04, feltY: .02 },
  ui: {
    playerCardScale: 1,
    playerInset: 10,
    doraScale: 1,
    doraX: 24,
    doraY: 24,
    centerScale: 1,
    reactionScale: 1,
    gameLogWidth: 290,
  },
  tableColor: '#174a36',
  tableImage: null,
  backColor: '#315c49',
};`, 'renderer defaults');

  s = replaceRequired(s,
`    left: readRotation(raw.left, DEFAULT_DEV_TUNING.left),
    right: readRotation(raw.right, DEFAULT_DEV_TUNING.right),
    top: readRotation(raw.top, DEFAULT_DEV_TUNING.top),
    bottom: readRotation(raw.bottom, DEFAULT_DEV_TUNING.bottom),
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULT_DEV_TUNING.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULT_DEV_TUNING.backColor,`,
`    left: readRotation(raw.left, DEFAULT_DEV_TUNING.left),
    right: readRotation(raw.right, DEFAULT_DEV_TUNING.right),
    top: readRotation(raw.top, DEFAULT_DEV_TUNING.top),
    bottom: readRotation(raw.bottom, DEFAULT_DEV_TUNING.bottom),
    tiles: {
      faceOffset: finiteNumber(raw.tiles?.faceOffset, DEFAULT_DEV_TUNING.tiles.faceOffset),
      faceRotateX: finiteNumber(raw.tiles?.faceRotateX, DEFAULT_DEV_TUNING.tiles.faceRotateX),
      faceScale: finiteNumber(raw.tiles?.faceScale, DEFAULT_DEV_TUNING.tiles.faceScale),
      ownScale: finiteNumber(raw.tiles?.ownScale, DEFAULT_DEV_TUNING.tiles.ownScale),
      opponentScale: finiteNumber(raw.tiles?.opponentScale, DEFAULT_DEV_TUNING.tiles.opponentScale),
      riverScale: finiteNumber(raw.tiles?.riverScale, DEFAULT_DEV_TUNING.tiles.riverScale),
      meldScale: finiteNumber(raw.tiles?.meldScale, DEFAULT_DEV_TUNING.tiles.meldScale),
    },
    tableGeometry: {
      woodY: finiteNumber(raw.tableGeometry?.woodY, DEFAULT_DEV_TUNING.tableGeometry.woodY),
      feltY: finiteNumber(raw.tableGeometry?.feltY, DEFAULT_DEV_TUNING.tableGeometry.feltY),
    },
    ui: {
      playerCardScale: finiteNumber(raw.ui?.playerCardScale, DEFAULT_DEV_TUNING.ui.playerCardScale),
      playerInset: finiteNumber(raw.ui?.playerInset, DEFAULT_DEV_TUNING.ui.playerInset),
      doraScale: finiteNumber(raw.ui?.doraScale, DEFAULT_DEV_TUNING.ui.doraScale),
      doraX: finiteNumber(raw.ui?.doraX, DEFAULT_DEV_TUNING.ui.doraX),
      doraY: finiteNumber(raw.ui?.doraY, DEFAULT_DEV_TUNING.ui.doraY),
      centerScale: finiteNumber(raw.ui?.centerScale, DEFAULT_DEV_TUNING.ui.centerScale),
      reactionScale: finiteNumber(raw.ui?.reactionScale, DEFAULT_DEV_TUNING.ui.reactionScale),
      gameLogWidth: finiteNumber(raw.ui?.gameLogWidth, DEFAULT_DEV_TUNING.ui.gameLogWidth),
    },
    tableColor: typeof raw.tableColor === 'string' ? raw.tableColor : DEFAULT_DEV_TUNING.tableColor,
    tableImage: typeof raw.tableImage === 'string' ? raw.tableImage : null,
    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULT_DEV_TUNING.backColor,`, 'renderer load nested settings');

  s = replaceRequired(s,
`  camera: any;
  actorRoot: any;
  tileGeometry: any;`,
`  camera: any;
  actorRoot: any;
  base: any;
  felt: any;
  tileGeometry: any;`, 'runtime table mesh refs');

  s = replaceRequired(s,
`function baseTransform(spec: TileSpec): Transform {
  const transform: Transform = {`,
`function baseTransform(spec: TileSpec): Transform {
  const tuning = readDevTuning();
  const transform: Transform = {`, 'transform tuning read');

  s = replaceRequired(s,
`    setConfiguredRotation(transform, readDevTuning().bottom);
    transform.scale = 1.03;`,
`    setConfiguredRotation(transform, tuning.bottom);
    transform.scale = 1.03 * tuning.tiles.ownScale;`, 'own tile scale');

  s = replaceRequired(s, `    transform.scale = .88;`, `    transform.scale = .88 * tuning.tiles.riverScale;`, 'river scale');
  s = replaceRequired(s, `      transform.scale = .94;`, `      transform.scale = .94 * tuning.tiles.riverScale;`, 'latest river scale');
  s = replaceRequired(s,
`    transform.y = .37;
    transform.scale = .84;
    const tuning = readDevTuning();`,
`    transform.y = .37;
    transform.scale = .84 * tuning.tiles.opponentScale;`, 'opponent scale');
  s = replaceRequired(s, `    transform.scale = .80;`, `    transform.scale = .80 * tuning.tiles.meldScale;`, 'meld scale');

  s = replaceRequired(s,
`  const face = new THREE.Mesh(rt.faceGeometry, materialForFace(rt, spec.label, spec.back));
  face.position.y = TILE_FACE_OFFSET;
  face.rotation.x = -Math.PI / 2;
  face.renderOrder = 4;`,
`  const faceTuning = readDevTuning().tiles;
  const face = new THREE.Mesh(rt.faceGeometry, materialForFace(rt, spec.label, spec.back));
  face.position.y = faceTuning.faceOffset;
  face.rotation.x = radians(faceTuning.faceRotateX);
  face.scale.setScalar(faceTuning.faceScale);
  face.renderOrder = 4;`, 'face diagnostic transform');

  s = replaceRequired(s, `  base.position.y = -.29;`, `  base.position.y = tuning.tableGeometry.woodY;`, 'wood default height');
  s = replaceRequired(s, `  felt.position.y = .02;`, `  felt.position.y = tuning.tableGeometry.feltY;`, 'felt height');

  s = replaceRequired(s,
`    camera,
    actorRoot,
    tileGeometry,`,
`    camera,
    actorRoot,
    base,
    felt,
    tileGeometry,`, 'runtime mesh assignment');

  s = replaceRequired(s,
`function applyDevTuning(rt: TableRuntime): void {
  const tuning = readDevTuning();
  rt.camera.fov = tuning.camera.fov;
  rt.camera.position.set(tuning.camera.x, tuning.camera.y, tuning.camera.z);
  rt.camera.lookAt(tuning.camera.targetX, tuning.camera.targetY, tuning.camera.targetZ);
  rt.camera.updateProjectionMatrix();
  rt.backMaterial.color.set(tuning.backColor);
  rt.backShellMaterial.color.set(tuning.backColor);
  rt.feltMaterial.color.set(tuning.tableImage ? 0xffffff : tuning.tableColor);
  syncTableTexture(rt, tuning.tableImage);
}`,
`function applyDevTuning(rt: TableRuntime): void {
  const tuning = readDevTuning();
  rt.camera.fov = tuning.camera.fov;
  rt.camera.position.set(tuning.camera.x, tuning.camera.y, tuning.camera.z);
  rt.camera.lookAt(tuning.camera.targetX, tuning.camera.targetY, tuning.camera.targetZ);
  rt.camera.updateProjectionMatrix();
  rt.base.position.y = tuning.tableGeometry.woodY;
  rt.felt.position.y = tuning.tableGeometry.feltY;
  rt.backMaterial.color.set(tuning.backColor);
  rt.backShellMaterial.color.set(tuning.backColor);
  rt.feltMaterial.color.set(tuning.tableImage ? 0xffffff : tuning.tableColor);
  for (const actor of rt.actors.values()) {
    actor.face.position.y = tuning.tiles.faceOffset;
    actor.face.rotation.x = radians(tuning.tiles.faceRotateX);
    actor.face.scale.setScalar(tuning.tiles.faceScale);
  }
  syncTableTexture(rt, tuning.tableImage);
}`, 'live renderer diagnostics');

  return s;
});

update('client/src/table-3d.css', (input) => {
  if (input.includes('/* Expanded dev diagnostic overrides */')) throw new Error('CSS diagnostics already present');
  return `${input.trimEnd()}\n\n/* Expanded dev diagnostic overrides */\n.game-layout:has(.mahjong-table.table-3d-active) {\n  grid-template-columns: minmax(0, 1fr) var(--dev-game-log-width, 290px);\n}\n\n.table-3d-active .human-card,\n.table-3d-active .opponent-card {\n  scale: var(--dev-player-card-scale, 1);\n  transform-origin: center;\n}\n\n.table-3d-active .player-top { top: var(--dev-player-inset, 10px); }\n.table-3d-active .player-bottom { bottom: var(--dev-player-inset, 10px); }\n.table-3d-active .player-left { left: var(--dev-player-inset, 10px); }\n.table-3d-active .player-right { right: var(--dev-player-inset, 10px); }\n\n.table-3d-active .table-dora-tray {\n  left: var(--dev-dora-x, 24px);\n  top: var(--dev-dora-y, 24px);\n  scale: var(--dev-dora-scale, 1);\n  transform-origin: top left;\n}\n\n.table-3d-active .table-center.classic-table-counter {\n  scale: var(--dev-center-scale, 1);\n  transform-origin: center;\n}\n\n.table-3d-active .reaction-popup {\n  scale: var(--dev-reaction-scale, 1);\n  transform-origin: center;\n}\n`;
});

update('client/src/dev-tuning.css', (input) => {
  if (input.includes('/* Expanded diagnostic grouping */')) throw new Error('Dev CSS diagnostics already present');
  return `${input.trimEnd()}\n\n/* Expanded diagnostic grouping */\n.dev-tuning-section {\n  padding-left: 9px;\n  border-left: 2px solid rgba(216,193,126,.13);\n}\n.dev-tuning-section h3 {\n  padding: 3px 5px;\n  border-radius: 5px;\n  background: rgba(216,193,126,.045);\n}\n`;
});
