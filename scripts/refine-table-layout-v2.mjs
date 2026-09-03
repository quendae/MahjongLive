import fs from 'node:fs';

function replaceOrThrow(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing block for ${label}`);
  return source.replace(before, after);
}

// ---------------- Dev tuning UI ----------------
{
  const path = 'client/src/dev-tuning.ts';
  let s = fs.readFileSync(path, 'utf8');

  s = replaceOrThrow(s,
`  left: Rotation;
  right: Rotation;
  bottom: Rotation;`,
`  left: Rotation;
  right: Rotation;
  top: Rotation;
  bottom: Rotation;`, 'dev type top');

  s = replaceOrThrow(s,
`  camera: { x: 0, y: 7.75, z: 12.75, targetX: 0, targetY: .25, targetZ: .15, fov: 34 },
  left: { x: -90, y: 0, z: -90 },
  right: { x: -90, y: 0, z: 90 },
  bottom: { x: 90, y: 0, z: 0 },`,
`  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },`, 'dev defaults');

  s = replaceOrThrow(s,
`    left: rotation(raw.left, DEFAULTS.left),
    right: rotation(raw.right, DEFAULTS.right),
    bottom: rotation(raw.bottom, DEFAULTS.bottom),`,
`    left: rotation(raw.left, DEFAULTS.left),
    right: rotation(raw.right, DEFAULTS.right),
    top: rotation(raw.top, DEFAULTS.top),
    bottom: rotation(raw.bottom, DEFAULTS.bottom),`, 'dev load top');

  s = s.replace(/function applyDomPreview\(\): void \{[\s\S]*?\n\}\n\nfunction numberSlider/, `function applyDomPreview(): void {
  document.querySelectorAll<HTMLElement>('.mahjong-table').forEach((table) => {
    // In 3D the uploaded image belongs only to the felt mesh. Never paint it onto the whole
    // DOM table container, otherwise it visually spills into the frame/background around the mesh.
    if (table.classList.contains('table-3d-active')) {
      table.style.backgroundImage = 'none';
      table.style.backgroundSize = '';
      table.style.backgroundPosition = '';
      table.style.backgroundColor = '';
      return;
    }
    table.style.backgroundColor = settings.tableColor;
    table.style.backgroundImage = settings.tableImage ? \`url("\${settings.tableImage}")\` : 'none';
    table.style.backgroundSize = settings.tableImage ? 'cover' : '';
    table.style.backgroundPosition = settings.tableImage ? 'center' : '';
  });
  document.querySelectorAll<HTMLElement>('.tile-back').forEach((tile) => {
    tile.style.background = settings.backColor;
  });
}

function numberSlider`);

  s = s.replace(/function numberSlider\([\s\S]*?\n\}\n\nfunction hexToRgb/, `function numberSlider(
  parent: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  get: () => number,
  set: (value: number) => void,
  suffix = '',
  defaultValue = get(),
): void {
  const row = document.createElement('div');
  row.className = 'dev-tuning-control';
  const name = document.createElement('label');
  name.textContent = label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);

  const numeric = document.createElement('input');
  numeric.type = 'number';
  numeric.min = String(min);
  numeric.max = String(max);
  numeric.step = String(step);
  numeric.className = 'dev-tuning-number';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'dev-tuning-reset';
  reset.textContent = '↺';
  reset.title = \`Reset \${label} to \${defaultValue}\${suffix}\`;

  const format = (value: number) => step < 1 ? value.toFixed(2) : String(Math.round(value));
  const sync = (value: number) => {
    slider.value = String(value);
    numeric.value = format(value);
    numeric.title = suffix ? \`\${format(value)}\${suffix}\` : format(value);
  };
  const commit = (value: number) => {
    if (!Number.isFinite(value)) return;
    const bounded = Math.max(min, Math.min(max, value));
    set(bounded);
    sync(bounded);
    saveAndBroadcast();
  };

  sync(get());
  slider.addEventListener('input', () => commit(Number(slider.value)));
  numeric.addEventListener('change', () => commit(Number(numeric.value)));
  numeric.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commit(Number(numeric.value));
  });
  reset.addEventListener('click', () => commit(defaultValue));

  row.append(name, slider, numeric, reset);
  parent.append(row);
}

function hexToRgb`);

  s = s.replace(/function colorControl\([\s\S]*?\n\}\n\nfunction rotationSection/, `function colorControl(
  parent: HTMLElement,
  label: string,
  get: () => string,
  set: (value: string) => void,
  defaultValue: string,
): void {
  const row = document.createElement('div');
  row.className = 'dev-tuning-color';
  const name = document.createElement('label');
  name.textContent = label;
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = get();
  const nums = [0, 1, 2].map(() => {
    const input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.max = '255'; input.step = '1';
    return input;
  });
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'dev-tuning-reset';
  reset.textContent = '↺';
  reset.title = \`Reset \${label}\`;
  const syncNums = () => {
    const rgb = hexToRgb(picker.value);
    nums.forEach((input, index) => { input.value = String(rgb[index]); });
  };
  const commit = (value: string) => {
    picker.value = value;
    set(value);
    syncNums();
    saveAndBroadcast();
  };
  syncNums();
  picker.addEventListener('input', () => commit(picker.value));
  nums.forEach((input) => input.addEventListener('change', () => {
    commit(rgbToHex(Number(nums[0].value), Number(nums[1].value), Number(nums[2].value)));
  }));
  reset.addEventListener('click', () => commit(defaultValue));
  row.append(name, picker, ...nums, reset);
  parent.append(row);
}

function rotationSection`);

  s = s.replace(/function rotationSection\(parent: HTMLElement, title: string, target: Rotation\): void \{[\s\S]*?\n\}/, `function rotationSection(parent: HTMLElement, title: string, target: Rotation, defaults: Rotation): void {
  const section = document.createElement('section');
  section.className = 'dev-tuning-section';
  section.innerHTML = \`<h3>\${title}</h3>\`;
  numberSlider(section, 'Rotate X', -180, 180, 1, () => target.x, (v) => { target.x = v; }, '°', defaults.x);
  numberSlider(section, 'Rotate Y', -180, 180, 1, () => target.y, (v) => { target.y = v; }, '°', defaults.y);
  numberSlider(section, 'Rotate Z', -180, 180, 1, () => target.z, (v) => { target.z = v; }, '°', defaults.z);
  parent.append(section);
}`);

  const oldCamera = `  numberSlider(camera, 'Position X', -20, 20, .05, () => settings.camera.x, (v) => { settings.camera.x = v; });
  numberSlider(camera, 'Position Y', .5, 20, .05, () => settings.camera.y, (v) => { settings.camera.y = v; });
  numberSlider(camera, 'Position Z', -20, 25, .05, () => settings.camera.z, (v) => { settings.camera.z = v; });
  numberSlider(camera, 'Target X', -6, 6, .05, () => settings.camera.targetX, (v) => { settings.camera.targetX = v; });
  numberSlider(camera, 'Target Y', -2, 5, .05, () => settings.camera.targetY, (v) => { settings.camera.targetY = v; });
  numberSlider(camera, 'Target Z', -6, 6, .05, () => settings.camera.targetZ, (v) => { settings.camera.targetZ = v; });
  numberSlider(camera, 'FOV', 20, 70, 1, () => settings.camera.fov, (v) => { settings.camera.fov = v; }, '°');`;
  const newCamera = `  numberSlider(camera, 'Position X', -20, 20, .05, () => settings.camera.x, (v) => { settings.camera.x = v; }, '', DEFAULTS.camera.x);
  numberSlider(camera, 'Position Y', .5, 20, .05, () => settings.camera.y, (v) => { settings.camera.y = v; }, '', DEFAULTS.camera.y);
  numberSlider(camera, 'Position Z', -20, 25, .05, () => settings.camera.z, (v) => { settings.camera.z = v; }, '', DEFAULTS.camera.z);
  numberSlider(camera, 'Target X', -6, 6, .05, () => settings.camera.targetX, (v) => { settings.camera.targetX = v; }, '', DEFAULTS.camera.targetX);
  numberSlider(camera, 'Target Y', -2, 5, .05, () => settings.camera.targetY, (v) => { settings.camera.targetY = v; }, '', DEFAULTS.camera.targetY);
  numberSlider(camera, 'Target Z', -6, 6, .05, () => settings.camera.targetZ, (v) => { settings.camera.targetZ = v; }, '', DEFAULTS.camera.targetZ);
  numberSlider(camera, 'FOV', 20, 70, 1, () => settings.camera.fov, (v) => { settings.camera.fov = v; }, '°', DEFAULTS.camera.fov);`;
  s = replaceOrThrow(s, oldCamera, newCamera, 'camera controls');

  s = replaceOrThrow(s,
`  rotationSection(root, 'Left opponent tiles', settings.left);
  rotationSection(root, 'Right opponent tiles', settings.right);
  rotationSection(root, 'Your tiles', settings.bottom);`,
`  rotationSection(root, 'Left opponent tiles', settings.left, DEFAULTS.left);
  rotationSection(root, 'Right opponent tiles', settings.right, DEFAULTS.right);
  rotationSection(root, 'Top opponent tiles', settings.top, DEFAULTS.top);
  rotationSection(root, 'Your tiles', settings.bottom, DEFAULTS.bottom);`, 'rotation sections');

  s = replaceOrThrow(s,
`  colorControl(surfaces, 'Table RGB', () => settings.tableColor, (v) => { settings.tableColor = v; });`,
`  colorControl(surfaces, 'Table RGB', () => settings.tableColor, (v) => { settings.tableColor = v; }, DEFAULTS.tableColor);`, 'table color reset');

  s = replaceOrThrow(s,
`  colorControl(surfaces, 'Back RGB', () => settings.backColor, (v) => { settings.backColor = v; preset.value = ''; });`,
`  colorControl(surfaces, 'Back RGB', () => settings.backColor, (v) => { settings.backColor = v; preset.value = ''; }, DEFAULTS.backColor);`, 'back color reset');

  fs.writeFileSync(path, s);
}

// ---------------- 3D renderer ----------------
{
  const path = 'client/src/table-3d.ts';
  let s = fs.readFileSync(path, 'utf8');

  s = replaceOrThrow(s, `const TILE_FACE_OFFSET = .112;`, `const TILE_FACE_OFFSET = .128;`, 'face offset');

  s = replaceOrThrow(s,
`  left: DevRotation;
  right: DevRotation;
  bottom: DevRotation;`,
`  left: DevRotation;
  right: DevRotation;
  top: DevRotation;
  bottom: DevRotation;`, 'renderer type top');

  s = replaceOrThrow(s,
`  camera: { x: 0, y: 7.75, z: 12.75, targetX: 0, targetY: .25, targetZ: .15, fov: 34 },
  left: { x: -90, y: 0, z: -90 },
  right: { x: -90, y: 0, z: 90 },
  bottom: { x: 90, y: 0, z: 0 },`,
`  camera: { x: 0, y: 10, z: 12.75, targetX: 0, targetY: .25, targetZ: 1.30, fov: 27 },
  left: { x: -90, y: 0, z: 90 },
  right: { x: -90, y: -180, z: 90 },
  top: { x: -90, y: 180, z: 0 },
  bottom: { x: 73, y: 0, z: 0 },`, 'renderer defaults');

  s = replaceOrThrow(s,
`    left: readRotation(raw.left, DEFAULT_DEV_TUNING.left),
    right: readRotation(raw.right, DEFAULT_DEV_TUNING.right),
    bottom: readRotation(raw.bottom, DEFAULT_DEV_TUNING.bottom),`,
`    left: readRotation(raw.left, DEFAULT_DEV_TUNING.left),
    right: readRotation(raw.right, DEFAULT_DEV_TUNING.right),
    top: readRotation(raw.top, DEFAULT_DEV_TUNING.top),
    bottom: readRotation(raw.bottom, DEFAULT_DEV_TUNING.bottom),`, 'renderer load top');

  s = replaceOrThrow(s, `    transform.z = 4.02;`, `    transform.z = 4.24;`, 'human hand edge');
  s = replaceOrThrow(s,
`    const cross = (col - 2.5) * .52;
    const depth = 1.16 + row * .67;`,
`    // Keep the organic placement, but anchor every discard to a predictable outer row so
    // the centre counter never covers the river.
    const cross = (col - 2.5) * .48;
    const depth = 2.05 + row * .55;`, 'river rows');

  const oldRack = `    const centered = spec.index - (spec.total - 1) / 2;
    const spacing = .39;
    transform.y = .37;
    transform.scale = .84;
    const tuning = readDevTuning();
    if (spec.side === 'top') {
      transform.x = centered * spacing;
      transform.z = -4.08;
      transform.pitch = Math.PI / 2 + OPPONENT_RACK_LEAN;
      transform.yaw = Math.PI;
    } else if (spec.side === 'left') {
      transform.x = -5.10;
      transform.z = centered * spacing;
      setConfiguredRotation(transform, tuning.left);
    } else {
      transform.x = 5.10;
      transform.z = -centered * spacing;
      setConfiguredRotation(transform, tuning.right);
    }`;
  const newRack = `    const centered = spec.index - (spec.total - 1) / 2;
    const spacing = .39;
    transform.y = .37;
    transform.scale = .84;
    const tuning = readDevTuning();
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
    }`;
  s = replaceOrThrow(s, oldRack, newRack, 'rack placement and top rotation');

  s = replaceOrThrow(s,
`  if (spec.zone === 'river') {
    position = spec.latest ? .006 : .014;
    yaw = .025;
    tilt = .005;`,
`  if (spec.zone === 'river') {
    position = spec.latest ? .005 : .010;
    yaw = .018;
    tilt = .003;`, 'river humanize');

  const oldMeld = `    if (spec.side === 'bottom') {
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
    }`;
  const newMeld = `    if (spec.side === 'bottom') {
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
    }`;
  s = replaceOrThrow(s, oldMeld, newMeld, 'meld corner placement');

  s = replaceOrThrow(s,
`  const material = new rt.THREE.MeshStandardMaterial({
    map: texture,
    roughness: .60,
    metalness: 0,
  });`,
`  const material = new rt.THREE.MeshStandardMaterial({
    map: texture,
    roughness: .60,
    metalness: 0,
    side: rt.THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });`, 'front material visibility');

  s = replaceOrThrow(s,
`  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture, color: tuning.backColor, roughness: .58, metalness: 0,
  });`,
`  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture, color: tuning.backColor, roughness: .58, metalness: 0,
    side: THREE.DoubleSide,
  });`, 'back double side');

  s = replaceOrThrow(s, `  face.renderOrder = 2;`, `  face.renderOrder = 4;`, 'face render order');
  fs.writeFileSync(path, s);
}

// ---------------- Dev CSS ----------------
{
  const path = 'client/src/dev-tuning.css';
  let s = fs.readFileSync(path, 'utf8');
  s = replaceOrThrow(s, `  width: min(430px, calc(100vw - 24px));`, `  width: min(490px, calc(100vw - 24px));`, 'panel width');
  s = replaceOrThrow(s,
`.dev-tuning-control { display: grid; grid-template-columns: 88px minmax(0, 1fr) 58px; gap: 8px; align-items: center; margin: 5px 0; }`,
`.dev-tuning-control { display: grid; grid-template-columns: 88px minmax(0, 1fr) 74px 30px; gap: 7px; align-items: center; margin: 5px 0; }`, 'control grid');
  s = replaceOrThrow(s,
`.dev-tuning-control output { text-align: right; color: #f0e5c4; font-variant-numeric: tabular-nums; }`,
`.dev-tuning-number { width: 100%; min-width: 0; padding: 5px 6px; border: 1px solid rgba(255,255,255,.12); border-radius: 6px; color: #f0e5c4; background: rgba(255,255,255,.045); font-variant-numeric: tabular-nums; }
.dev-tuning-reset { width: 30px; height: 28px; padding: 0; border: 1px solid rgba(255,255,255,.12); border-radius: 7px; color: #d8c17e; background: rgba(255,255,255,.055); cursor: pointer; }
.dev-tuning-reset:hover { background: rgba(232,201,112,.12); }`, 'number and reset css');
  s = replaceOrThrow(s,
`.dev-tuning-color { display: grid; grid-template-columns: 88px 42px repeat(3, minmax(0, 1fr)); gap: 6px; align-items: center; margin: 7px 0; }`,
`.dev-tuning-color { display: grid; grid-template-columns: 88px 42px repeat(3, minmax(0, 1fr)) 30px; gap: 6px; align-items: center; margin: 7px 0; }`, 'color grid');
  s = replaceOrThrow(s,
`  .dev-tuning-control { grid-template-columns: 78px minmax(0, 1fr) 52px; }`,
`  .dev-tuning-control { grid-template-columns: 78px minmax(0, 1fr) 68px 30px; }`, 'mobile grid');
  fs.writeFileSync(path, s);
}
