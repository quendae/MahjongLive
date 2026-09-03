import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from, to);
}

function patchFile(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No changes made to ${path}`);
  fs.writeFileSync(path, after);
}

patchFile('client/src/table-3d-faces.ts', (input) => replaceOnce(
  input,
`  ctx.fillStyle = back ? '#ffffff' : '#fffdf8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = back ? 'rgba(28,54,43,.52)' : '#d5cec0';
  ctx.lineWidth = 5;
  roundRectStroke(ctx, 5, 5, 150, 206, 12);

  if (back) {
    ctx.strokeStyle = 'rgba(29,59,46,.28)';`,
`  ctx.fillStyle = back ? '#ffffff' : '#fffdf8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Fronts should read like a single porcelain/ivory surface. Keep the decorative border only
  // on tile backs; the old grey rounded front outline made every face look like an inset sticker.
  if (back) {
    ctx.strokeStyle = 'rgba(28,54,43,.52)';
    ctx.lineWidth = 5;
    roundRectStroke(ctx, 5, 5, 150, 206, 12);
    ctx.strokeStyle = 'rgba(29,59,46,.28)';`,
  'remove grey front frame',
));

patchFile('client/src/table-3d.ts', (input) => {
  let text = input;
  text = replaceOnce(text,
`    riverDepth: number;
    riverRowGap: number;
    riverColumnGap: number;
  };`,
`    riverDepth: number;
    riverRowGap: number;
    riverColumnGap: number;
    riverJitter: number;
    riverYawJitter: number;
    riverTiltJitter: number;
  };`, 'table tile tuning type');

  text = replaceOnce(text,
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
};`,
`const DEFAULT_DEV_TUNING: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: -.65, targetZ: .15, fov: 27 },
  left: { x: -90, y: 0, z: -90 },
  right: { x: -90, y: 0, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 90, y: 0, z: 0 },
  tiles: {
    faceOffset: .128,
    faceRotateX: -90,
    faceScale: 1.1,
    faceTextureRotation: 0,
    bodyColor: '#ffffff',
    bodyRoughness: .46,
    faceTint: '#ffffff',
    ownScale: 1,
    opponentScale: 1,
    riverScale: 1,
    meldScale: 1,
    riverDepth: 2.14,
    riverRowGap: .55,
    riverColumnGap: .45,
    riverJitter: .028,
    riverYawJitter: 3.2,
    riverTiltJitter: .7,
  },
  tableGeometry: { frameTopY: .25, feltTopY: .11, frameWidth: .22, frameThickness: .45, feltThickness: .10 },
  ui: {
    playerCardScale: 1.5,
    playerInsetTB: 10,
    playerInsetSides: 57,
    doraScale: 1.29,
    doraX: 24,
    doraY: 24,
    centerScale: .92,
    centerOffsetX: 0,
    centerOffsetY: -10,
    centerWidth: 309,
    centerHeight: 265,
    reactionScale: 1,
    gameLogWidth: 290,
  },
  tableColor: '#370f53',
  tableImage: null,
  woodColor: '#3a2b20',
  backColor: '#315c49',
};`, 'user-approved defaults');

  text = replaceOnce(text,
`      riverDepth: finiteNumber(raw.tiles?.riverDepth, DEFAULT_DEV_TUNING.tiles.riverDepth),
      riverRowGap: finiteNumber(raw.tiles?.riverRowGap, DEFAULT_DEV_TUNING.tiles.riverRowGap),
      riverColumnGap: finiteNumber(raw.tiles?.riverColumnGap, DEFAULT_DEV_TUNING.tiles.riverColumnGap),`,
`      riverDepth: finiteNumber(raw.tiles?.riverDepth, DEFAULT_DEV_TUNING.tiles.riverDepth),
      riverRowGap: finiteNumber(raw.tiles?.riverRowGap, DEFAULT_DEV_TUNING.tiles.riverRowGap),
      riverColumnGap: finiteNumber(raw.tiles?.riverColumnGap, DEFAULT_DEV_TUNING.tiles.riverColumnGap),
      riverJitter: finiteNumber(raw.tiles?.riverJitter, DEFAULT_DEV_TUNING.tiles.riverJitter),
      riverYawJitter: finiteNumber(raw.tiles?.riverYawJitter, DEFAULT_DEV_TUNING.tiles.riverYawJitter),
      riverTiltJitter: finiteNumber(raw.tiles?.riverTiltJitter, DEFAULT_DEV_TUNING.tiles.riverTiltJitter),`, 'table tuning loader');

  text = replaceOnce(text,
`function signedHash(key: string, salt: string): number {
  return hash01(\`${'${key}:${salt}'}\`) * 2 - 1;
}

function baseTransform(spec: TileSpec): Transform {`,
`function signedHash(key: string, salt: string): number {
  return hash01(\`${'${key}:${salt}'}\`) * 2 - 1;
}

function reactionClaimAvailable(): boolean {
  const dock = app.querySelector<HTMLElement>('.action-dock:not(.presentation-dock)');
  if (!dock) return false;
  return [...dock.querySelectorAll<HTMLElement>('[data-ui-action]')].some((button) =>
    ['ron', 'pon', 'chi', 'daiminkan'].includes(button.dataset.uiAction ?? ''));
}

function rackSlot(spec: TileSpec): { slot: number; drawn: boolean } {
  // A normal riichi concealed hand has 1 (mod 3) tiles; the just-drawn tile makes it 2 (mod 3).
  // Keep the resting tiles in the exact same slots and reserve a separated end slot for the draw,
  // so receiving a tile never makes the whole hand shuffle sideways.
  const hasDrawnSlot = spec.total > 1 && spec.total % 3 === 2;
  const baseCount = Math.max(1, hasDrawnSlot ? spec.total - 1 : spec.total);
  const drawn = hasDrawnSlot && (spec.drawn || spec.index >= baseCount);
  const slot = drawn ? (baseCount - 1) / 2 + 1.35 : spec.index - (baseCount - 1) / 2;
  return { slot, drawn };
}

function baseTransform(spec: TileSpec): Transform {`, 'reaction and stable rack helpers');

  text = replaceOnce(text,
`  if (spec.zone === 'hand') {
    const spacing = Math.min(.50, 6.45 / Math.max(1, spec.total - 1));
    transform.x = (spec.index - (spec.total - 1) / 2) * spacing + (spec.drawn ? .15 : 0);
    transform.z = 4.24;
    // The human rack stands on the narrow edge. The tile face points toward the bottom player.
    transform.y = .42;
    setConfiguredRotation(transform, tuning.bottom);
    transform.scale = 1.03 * tuning.tiles.ownScale;
  } else if (spec.zone === 'river') {`,
`  if (spec.zone === 'hand') {
    const { slot } = rackSlot(spec);
    transform.x = slot * .50;
    transform.z = 4.24;
    // The human rack stands on the narrow edge. The tile face points toward the bottom player.
    transform.y = .42;
    setConfiguredRotation(transform, tuning.bottom);
    transform.scale = 1.03 * tuning.tiles.ownScale;
  } else if (spec.zone === 'river') {`, 'stable human rack');

  text = replaceOnce(text,
`    if (spec.side === 'bottom') {
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
  } else {`,
`    if (spec.side === 'bottom') {
      transform.x = cross;
      transform.z = depth;
    } else if (spec.side === 'top') {
      transform.x = -cross;
      transform.z = -depth;
      // Discards are oriented toward the player who threw them, not toward table centre.
      transform.yaw = 0;
    } else if (spec.side === 'left') {
      transform.x = -depth;
      transform.z = cross;
      transform.yaw = -Math.PI / 2;
    } else {
      transform.x = depth;
      transform.z = -cross;
      transform.yaw = Math.PI / 2;
    }
    // The latest discard stays in its row. A conditional halo is enough feedback.
    transform.scale = .88 * tuning.tiles.riverScale;
  } else if (spec.zone === 'rack') {
    const { slot } = rackSlot(spec);
    const spacing = .39;
    transform.y = .37;
    transform.scale = .84 * tuning.tiles.opponentScale;
    if (spec.side === 'top') {
      transform.x = slot * spacing;
      transform.z = -4.28;
      setConfiguredRotation(transform, tuning.top);
    } else if (spec.side === 'left') {
      transform.x = -5.28;
      transform.z = slot * spacing;
      setConfiguredRotation(transform, tuning.left);
    } else {
      transform.x = 5.28;
      transform.z = -slot * spacing;
      setConfiguredRotation(transform, tuning.right);
    }
  } else {`, 'discard orientation and stable opponent racks');

  text = replaceOnce(text,
`    if (spec.side === 'bottom') {
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
    }`,
`    // Every player's open sets start in that player's lower-right corner and grow away from it.
    if (spec.side === 'bottom') {
      transform.x = 5.20 - col * .44;
      transform.z = 3.72 - row * .58;
    } else if (spec.side === 'top') {
      transform.x = -5.20 + col * .44;
      transform.z = -3.72 + row * .58;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -5.20 + row * .58;
      transform.z = 3.72 - col * .44;
      transform.yaw = Math.PI / 2;
    } else {
      transform.x = 5.20 - row * .58;
      transform.z = -3.72 + col * .44;
      transform.yaw = -Math.PI / 2;
    }`, 'meld lower-right corners');

  text = replaceOnce(text,
`function humanizeTransform(spec: TileSpec, input: Transform): Transform {
  const out = { ...input };
  let position = 0;
  let yaw = 0;
  let tilt = 0;
  if (spec.zone === 'river') {
    position = spec.latest ? .005 : .010;
    yaw = .018;
    tilt = .003;`,
`function humanizeTransform(spec: TileSpec, input: Transform): Transform {
  const out = { ...input };
  const tuning = readDevTuning();
  let position = 0;
  let yaw = 0;
  let tilt = 0;
  if (spec.zone === 'river') {
    position = tuning.tiles.riverJitter;
    yaw = radians(tuning.tiles.riverYawJitter);
    tilt = radians(tuning.tiles.riverTiltJitter);`, 'restore discard variation');

  text = replaceOnce(text,
`  latestHalo.position.y = -.106;
  latestHalo.visible = spec.latest;`,
`  latestHalo.position.y = -.106;
  latestHalo.visible = spec.latest && reactionClaimAvailable();`, 'conditional latest halo create');

  text = replaceOnce(text,
`  actor.indicator.visible = spec.advised;
  actor.latestHalo.visible = spec.latest;`,
`  actor.indicator.visible = spec.advised;
  actor.latestHalo.visible = spec.latest && reactionClaimAvailable();`, 'conditional latest halo refresh');

  text = replaceOnce(text,
`function syntheticDrawOrigin(draws: number): Transform {
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

function syncActors(rt: TableRuntime, table: HTMLElement): void {`,
`function syntheticDrawOrigin(draws: number): Transform {
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

function rackInsertOrigin(spec: TileSpec, target: Transform): Transform {
  const initial = { ...target };
  const distance = spec.zone === 'hand' ? .72 : .58;
  // Slide the new tile in from just beyond the free end of that player's rack.
  if (spec.side === 'left') initial.z += distance;
  else if (spec.side === 'right') initial.z -= distance;
  else initial.x += distance;
  initial.y += .045;
  return initial;
}

function syncActors(rt: TableRuntime, table: HTMLElement): void {`, 'rack insertion origin');

  text = replaceOnce(text,
`    if (!actor) {
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
    }`,
`    if (!actor) {
      let initial = target;
      if (rt.initialized && (spec.zone === 'hand' || spec.zone === 'rack')) {
        // Keep every existing tile fixed; only the newly received tile slides into its reserved slot.
        initial = rackInsertOrigin(spec, target);
      } else if (rt.initialized && spec.zone === 'river' && spec.side !== 'bottom') {
        initial = baseTransform({ ...spec, zone: 'rack', index: 0, total: 1, back: true, latest: false });
      }
      actor = createActor(rt, spec, initial);
      rt.actors.set(spec.key, actor);
      const shouldTravel = rt.initialized && transformsDiffer(initial, target);
      const rackInsert = spec.zone === 'hand' || spec.zone === 'rack';
      beginMotion(actor, target, now, shouldTravel ? (rackInsert ? .04 : .62) : 0, shouldTravel ? (rackInsert ? 260 : 350) : 0);
      refreshActor(rt, actor, spec);
      continue;
    }`, 'animate only received tile');

  text = replaceOnce(text,
`    texture.colorSpace = rt.THREE.SRGBColorSpace;
    rt.tableTexture = texture;`,
`    texture.colorSpace = rt.THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(2, rt.renderer.capabilities.getMaxAnisotropy());
    texture.generateMipmaps = true;
    texture.minFilter = rt.THREE.LinearMipmapLinearFilter;
    texture.magFilter = rt.THREE.LinearFilter;
    rt.tableTexture = texture;`, 'lighter table texture sampling');

  text = replaceOnce(text,
`function frameRuntime(rt: TableRuntime, time: number): void {
  if (rt.disposed || !enabled || !rt.table || !stage.classList.contains('is-active')) return;

  for (const actor of rt.actors.values()) {`,
`function frameRuntime(rt: TableRuntime, time: number): void {
  if (rt.disposed || !enabled || !rt.table || !stage.classList.contains('is-active')) return;

  const hoverOffset = new rt.THREE.Vector3();
  const inverseRotation = new rt.THREE.Quaternion();
  for (const actor of rt.actors.values()) {`, 'hover world-space helpers');

  text = replaceOnce(text,
`    const hovered = rt.hoveredKey === actor.key && actor.spec.selectable;
    const pressed = rt.pressedKey === actor.key && hovered;
    const hoverY = hovered ? (pressed ? .10 : .19) : 0;
    actor.visual.position.y += (hoverY - actor.visual.position.y) * .22;
    const targetTiltX = hovered ? -.06 : 0;`,
`    const hovered = rt.hoveredKey === actor.key && actor.spec.selectable;
    const pressed = rt.pressedKey === actor.key && hovered;
    const hoverY = hovered ? (pressed ? .08 : .16) : 0;
    // Lift in world Y regardless of how the tile itself is rotated. Previously local-Y pushed
    // standing tiles toward the camera instead of visibly raising them above the rack.
    hoverOffset.set(0, hoverY, 0).applyQuaternion(inverseRotation.copy(actor.group.quaternion).invert());
    actor.visual.position.lerp(hoverOffset, .22);
    const targetTiltX = hovered ? -.04 : 0;`, 'hover rises vertically');

  text = replaceOnce(text,
`    actor.indicator.visible = actor.spec.advised || hovered;
    actor.latestHalo.visible = actor.spec.latest;
    if (actor.spec.latest && !reducedMotion) {`,
`    actor.indicator.visible = actor.spec.advised || hovered;
    const claimableLatest = actor.spec.latest && reactionClaimAvailable();
    actor.latestHalo.visible = claimableLatest;
    if (claimableLatest && !reducedMotion) {`, 'conditional latest halo frame');

  return text;
});

patchFile('client/src/dev-tuning.ts', (input) => {
  let text = input;
  text = replaceOnce(text,
`    riverDepth: number;
    riverRowGap: number;
    riverColumnGap: number;
  };`,
`    riverDepth: number;
    riverRowGap: number;
    riverColumnGap: number;
    riverJitter: number;
    riverYawJitter: number;
    riverTiltJitter: number;
  };`, 'dev tile tuning type');

  text = replaceOnce(text,
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
};`,
`const DEFAULTS: DevTuning = {
  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: -.65, targetZ: .15, fov: 27 },
  left: { x: -90, y: 0, z: -90 },
  right: { x: -90, y: 0, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 90, y: 0, z: 0 },
  tiles: {
    faceOffset: .128,
    faceRotateX: -90,
    faceScale: 1.1,
    faceTextureRotation: 0,
    bodyColor: '#ffffff',
    bodyRoughness: .46,
    faceTint: '#ffffff',
    ownScale: 1,
    opponentScale: 1,
    riverScale: 1,
    meldScale: 1,
    riverDepth: 2.14,
    riverRowGap: .55,
    riverColumnGap: .45,
    riverJitter: .028,
    riverYawJitter: 3.2,
    riverTiltJitter: .7,
  },
  tableGeometry: { frameTopY: .25, feltTopY: .11, frameWidth: .22, frameThickness: .45, feltThickness: .10 },
  ui: {
    playerCardScale: 1.5,
    playerInsetTB: 10,
    playerInsetSides: 57,
    doraScale: 1.29,
    doraX: 24,
    doraY: 24,
    centerScale: .92,
    centerOffsetX: 0,
    centerOffsetY: -10,
    centerWidth: 309,
    centerHeight: 265,
    reactionScale: 1,
    gameLogWidth: 290,
  },
  tableColor: '#370f53',
  tableImage: null,
  woodColor: '#3a2b20',
  backColor: '#315c49',
};`, 'dev user-approved defaults');

  text = replaceOnce(text,
`      riverDepth: finite(raw.tiles?.riverDepth, DEFAULTS.tiles.riverDepth),
      riverRowGap: finite(raw.tiles?.riverRowGap, DEFAULTS.tiles.riverRowGap),
      riverColumnGap: finite(raw.tiles?.riverColumnGap, DEFAULTS.tiles.riverColumnGap),`,
`      riverDepth: finite(raw.tiles?.riverDepth, DEFAULTS.tiles.riverDepth),
      riverRowGap: finite(raw.tiles?.riverRowGap, DEFAULTS.tiles.riverRowGap),
      riverColumnGap: finite(raw.tiles?.riverColumnGap, DEFAULTS.tiles.riverColumnGap),
      riverJitter: finite(raw.tiles?.riverJitter, DEFAULTS.tiles.riverJitter),
      riverYawJitter: finite(raw.tiles?.riverYawJitter, DEFAULTS.tiles.riverYawJitter),
      riverTiltJitter: finite(raw.tiles?.riverTiltJitter, DEFAULTS.tiles.riverTiltJitter),`, 'dev tuning loader');

  text = replaceOnce(text,
`function rotationSection(parent: HTMLElement, title: string, target: Rotation, defaults: Rotation): void {`,
`async function optimizedTableImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create image canvas');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', .82);
  } finally {
    bitmap.close?.();
  }
}

function rotationSection(parent: HTMLElement, title: string, target: Rotation, defaults: Rotation): void {`, 'optimized uploaded texture helper');

  text = replaceOnce(text,
`  numberSlider(river, 'Center distance', 1.20, 3.50, .01, () => settings.tiles.riverDepth, (v) => { settings.tiles.riverDepth = v; }, '', DEFAULTS.tiles.riverDepth);
  numberSlider(river, 'Row gap', .20, 1.00, .01, () => settings.tiles.riverRowGap, (v) => { settings.tiles.riverRowGap = v; }, '', DEFAULTS.tiles.riverRowGap);
  numberSlider(river, 'Column gap', .25, .80, .01, () => settings.tiles.riverColumnGap, (v) => { settings.tiles.riverColumnGap = v; }, '', DEFAULTS.tiles.riverColumnGap);
  river.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Discards are laid out around world-space center (0,0); the DOM center counter is projected onto that same point.</p>');`,
`  numberSlider(river, 'Center distance', 1.20, 3.50, .01, () => settings.tiles.riverDepth, (v) => { settings.tiles.riverDepth = v; }, '', DEFAULTS.tiles.riverDepth);
  numberSlider(river, 'Row gap', .20, 1.00, .01, () => settings.tiles.riverRowGap, (v) => { settings.tiles.riverRowGap = v; }, '', DEFAULTS.tiles.riverRowGap);
  numberSlider(river, 'Column gap', .25, .80, .01, () => settings.tiles.riverColumnGap, (v) => { settings.tiles.riverColumnGap = v; }, '', DEFAULTS.tiles.riverColumnGap);
  numberSlider(river, 'Position variation', 0, .10, .002, () => settings.tiles.riverJitter, (v) => { settings.tiles.riverJitter = v; }, '', DEFAULTS.tiles.riverJitter);
  numberSlider(river, 'Yaw variation', 0, 10, .1, () => settings.tiles.riverYawJitter, (v) => { settings.tiles.riverYawJitter = v; }, '°', DEFAULTS.tiles.riverYawJitter);
  numberSlider(river, 'Tilt variation', 0, 4, .1, () => settings.tiles.riverTiltJitter, (v) => { settings.tiles.riverTiltJitter = v; }, '°', DEFAULTS.tiles.riverTiltJitter);
  river.insertAdjacentHTML('beforeend', '<p class="dev-tuning-note">Rows stay rigid enough to read, while deterministic position/angle variation keeps discards from looking computer-perfect.</p>');`, 'discard variation controls');

  text = replaceOnce(text,
`  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > 3_000_000) {
      setStatus('Image is over 3 MB. Use a smaller texture for localStorage.');
      file.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      settings.tableImage = typeof reader.result === 'string' ? reader.result : null;
      saveAndBroadcast(\`Loaded ${'${selected.name}'}\`);
    };
    reader.readAsDataURL(selected);
  });`,
`  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > 12_000_000) {
      setStatus('Image is over 12 MB. Choose a smaller source image.');
      file.value = '';
      return;
    }
    setStatus(\`Optimizing ${'${selected.name}'} for the 3D felt…\`);
    try {
      settings.tableImage = await optimizedTableImage(selected);
      saveAndBroadcast(\`Loaded optimized texture: ${'${selected.name}'}\`);
    } catch {
      setStatus('Could not decode/optimize that image.');
      file.value = '';
    }
  });`, 'optimize custom felt upload');

  return text;
});

console.log('Table UX pass applied.');
