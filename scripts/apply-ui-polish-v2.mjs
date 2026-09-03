import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from, to);
}

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No changes made to ${path}`);
  fs.writeFileSync(path, after);
}

patch('client/src/clarity.ts', (input) => {
  let text = input;
  text = replaceOnce(
    text,
    "  if (suited) return `${suited[1]}${suited[2].toUpperCase()}`;\n  if (label === 'east') return 'E';\n  if (label === 'south') return 'S';\n  if (label === 'west') return 'W';\n  if (label === 'north') return 'N';\n  if (label === 'white dragon') return 'WHITE';\n  if (label === 'green dragon') return 'GREEN';\n  if (label === 'red dragon') return 'RED';",
    "  if (suited) return suited[1];\n  if (label === 'east') return 'E';\n  if (label === 'south') return 'S';\n  if (label === 'west') return 'W';\n  if (label === 'north') return 'N';\n  if (label === 'white dragon') return 'W';\n  if (label === 'green dragon') return 'G';\n  if (label === 'red dragon') return 'R';",
    'beginner learning labels',
  );
  return text;
});

patch('client/src/table-3d-faces.ts', (input) => {
  let text = input;
  text = replaceOnce(
    text,
    "    if (mode === 'beginner') drawBeginnerBadge(ctx, `${rank}${suit.toUpperCase()}`, suitColor(suit, red));",
    "    if (mode === 'beginner') drawBeginnerBadge(ctx, String(rank), suitColor(suit, red));",
    'suited beginner label',
  );
  text = replaceOnce(text, "    'red dragon': { glyph: '中', color: '#bb3a34', beginner: 'RED' },\n    'green dragon': { glyph: '發', color: '#26744e', beginner: 'GREEN' },", "    'red dragon': { glyph: '中', color: '#bb3a34', beginner: 'R' },\n    'green dragon': { glyph: '發', color: '#26744e', beginner: 'G' },", 'dragon badges');
  text = replaceOnce(text, "    if (mode === 'beginner') drawBeginnerBadge(ctx, 'WHITE', '#38749a', true);", "    if (mode === 'beginner') drawBeginnerBadge(ctx, 'W', '#38749a');", 'white dragon badge');
  text = replaceOnce(
    text,
`function drawBeginnerBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  wide = false,
): void {
  const width = wide ? 98 : 60;
  const height = 43;
  const x = 160 - width - 8;
  const y = 8;
  ctx.save();
  ctx.fillStyle = 'rgba(255,253,245,.97)';
  ctx.strokeStyle = 'rgba(35,48,40,.24)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = \`850 ${wide ? 18 : 24}px Inter, Arial, sans-serif\`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + height / 2 + .5);
  ctx.restore();
}`,
`function drawBeginnerBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
): void {
  // Small corner cue: enough for learning without covering the traditional artwork.
  const size = 38;
  const x = 160 - size - 9;
  const y = 216 - size - 9;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,251,.94)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '800 23px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2 + .5);
  ctx.restore();
}`,
    'beginner badge design',
  );
  text = replaceOnce(
    text,
`function drawMan(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 82px Georgia, "Times New Roman", serif';
  ctx.fillStyle = red ? '#c23b34' : '#26362f';
  ctx.fillText(numerals[rank - 1] ?? String(rank), 80, 76);
  ctx.font = 'bold 70px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#b63b34';
  ctx.fillText('萬', 80, 158);
}`,
`function drawMan(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = red ? '#c53b33' : '#22352e';
  ctx.font = '700 86px "Noto Serif CJK JP", "Yu Mincho", Georgia, serif';
  ctx.fillText(numerals[rank - 1] ?? String(rank), 80, 74);
  ctx.fillStyle = '#b93430';
  ctx.font = '700 67px "Noto Serif CJK JP", "Yu Mincho", Georgia, serif';
  ctx.fillText('萬', 80, 157);
  ctx.restore();
}`,
    'modern man front',
  );
  text = replaceOnce(
    text,
`function drawPin(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
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
}`,
`function drawPin(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  const palette = red ? ['#c43c35'] : ['#2f6f98', '#c43c35', '#2d7751'];
  pinLayout(rank).forEach(([x, y], index) => {
    const color = palette[index % palette.length];
    const radius = rank === 1 ? 35 : 15.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = rank === 1 ? 7 : 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = rank === 1 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * .58, 0, Math.PI * 2);
    ctx.stroke();
    for (let petal = 0; petal < 6; petal += 1) {
      const angle = petal * Math.PI / 3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(Math.cos(angle) * radius * .42, Math.sin(angle) * radius * .42, radius * .13, radius * .25, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius * .13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}`,
    'modern pin front',
  );
  text = replaceOnce(
    text,
`function drawSou(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
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
}`,
`function drawSou(ctx: CanvasRenderingContext2D, rank: number, red: boolean): void {
  if (rank === 1) {
    // A compact peacock/bamboo-bird motif inspired by traditional 1-sou tiles.
    ctx.save();
    ctx.strokeStyle = red ? '#c43c35' : '#2b7750';
    ctx.fillStyle = red ? '#c43c35' : '#2f7096';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(78, 182);
    ctx.quadraticCurveTo(73, 125, 82, 76);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(85, 63, 24, 33, .34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2b7750';
    ctx.lineWidth = 5;
    for (const [dx, dy] of [[-32, -5], [-22, -29], [25, -26], [34, 1]]) {
      ctx.beginPath();
      ctx.moveTo(80, 96);
      ctx.quadraticCurveTo(80 + dx * .55, 82 + dy * .45, 80 + dx, 77 + dy);
      ctx.stroke();
    }
    ctx.fillStyle = '#c43c35';
    ctx.beginPath();
    ctx.arc(95, 53, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const green = red ? '#c43c35' : '#2d7952';
  souLayout(rank).forEach(([x, y, angle], index) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.roundRect(-8.5, -25, 17, 50, 7);
    ctx.fill();
    ctx.fillStyle = !red && index % 5 === 2 ? '#c43c35' : '#f8f3de';
    ctx.beginPath();
    ctx.roundRect(-7, -3, 14, 6, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(26,74,49,.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();
  });
}`,
    'modern sou front',
  );
  return text;
});

patch('client/src/main.ts', (input) => {
  let text = input;
  text = replaceOnce(
    text,
`  if (actions.length === 1) {
    submitHumanAction(actions[0]);
    return;
  }
  choiceState = { title: type === 'chi' ? 'Chi' : type === 'pon' ? 'Pon' : 'Kan', actions };`,
`  // Tile IDs can create several mechanically identical Pon/Kan options. Collapse choices that
  // look identical to the player, but preserve meaningful alternatives (for example red-five use).
  const uniqueByDescription = new Map<string, RoundAction>();
  for (const action of actions) {
    const description = actionDescription(action);
    if (!uniqueByDescription.has(description)) uniqueByDescription.set(description, action);
  }
  const uniqueActions = [...uniqueByDescription.values()];
  if (uniqueActions.length === 1) {
    submitHumanAction(uniqueActions[0]);
    return;
  }
  choiceState = { title: type === 'chi' ? 'Chi' : type === 'pon' ? 'Pon' : 'Kan', actions: uniqueActions };`,
    'dedupe call options',
  );
  return text;
});

patch('client/src/dev-tuning.ts', (input) => {
  let text = input;
  text = replaceOnce(text, "  backColor: string;\n};", "  backColor: string;\n  sceneColor: string;\n};", 'dev scene type');
  text = replaceOnce(text, "    riverRowGap: .55,", "    riverRowGap: .60,", 'dev row gap default');
  text = replaceOnce(text, "  backColor: '#315c49',\n};", "  backColor: '#315c49',\n  sceneColor: '#071b13',\n};", 'dev scene default');
  text = replaceOnce(text, "    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,\n  };", "    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULTS.backColor,\n    sceneColor: typeof raw.sceneColor === 'string' ? raw.sceneColor : DEFAULTS.sceneColor,\n  };", 'dev scene loader');
  text = replaceOnce(text, "let settings = loadSettings();\nlet panel: HTMLElement | null = null;", "let settings = loadSettings();\nif (Math.abs(settings.tiles.riverRowGap - .55) < .0001) settings.tiles.riverRowGap = .60;\nlet panel: HTMLElement | null = null;\n\nfunction syncDevOpenClass(): void {\n  document.body.classList.toggle('dev-tuning-open', Boolean(panel && !panel.hidden));\n}", 'dev open state');
  text = replaceOnce(text, "  rootStyle.setProperty('--dev-game-log-width', `${settings.ui.gameLogWidth}px`);", "  rootStyle.setProperty('--dev-game-log-width', `${settings.ui.gameLogWidth}px`);\n  rootStyle.setProperty('--dev-scene-bg', settings.sceneColor);", 'scene css variable');
  text = replaceOnce(text, "    const maxDimension = 1600;", "    const maxDimension = 1280;", 'image max dimension');
  text = replaceOnce(text, "    return canvas.toDataURL('image/webp', .82);", "    return canvas.toDataURL('image/webp', .78);", 'image quality');
  text = replaceOnce(
    text,
`  const surfaces = document.createElement('section');
  surfaces.className = 'dev-tuning-section';
  surfaces.innerHTML = '<h3>Felt & tile backs</h3>';`,
`  const sceneSection = document.createElement('section');
  sceneSection.className = 'dev-tuning-section';
  sceneSection.innerHTML = '<h3>Scene background</h3>';
  const scenePresetRow = document.createElement('div');
  scenePresetRow.className = 'dev-tuning-presets';
  const scenePresetLabel = document.createElement('label'); scenePresetLabel.textContent = 'Background';
  const scenePreset = document.createElement('select');
  const scenePresets: [string, string][] = [
    ['Deep green', '#071b13'], ['Charcoal', '#111513'], ['Midnight', '#101825'],
    ['Burgundy', '#251317'], ['Warm dark', '#211a14'], ['Custom RGB', ''],
  ];
  scenePresets.forEach(([name, value]) => {
    const option = document.createElement('option'); option.textContent = name; option.value = value; scenePreset.append(option);
  });
  scenePreset.value = scenePresets.find(([, value]) => value === settings.sceneColor)?.[1] ?? '';
  scenePreset.addEventListener('change', () => {
    if (!scenePreset.value) return;
    settings.sceneColor = scenePreset.value;
    saveAndBroadcast(`Scene background: ${scenePreset.selectedOptions[0]?.textContent ?? ''}`);
  });
  scenePresetRow.append(scenePresetLabel, scenePreset);
  sceneSection.append(scenePresetRow);
  colorControl(sceneSection, 'Background RGB', () => settings.sceneColor, (v) => { settings.sceneColor = v; scenePreset.value = ''; }, DEFAULTS.sceneColor);
  root.append(sceneSection);

  const surfaces = document.createElement('section');
  surfaces.className = 'dev-tuning-section';
  surfaces.innerHTML = '<h3>Felt & tile backs</h3>';`,
    'scene controls',
  );
  text = text.replaceAll("root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false;", "root.remove(); panel = buildPanel(); document.body.append(panel); panel.hidden = false; syncDevOpenClass();");
  text = replaceOnce(text, "  root.querySelector<HTMLButtonElement>('.dev-tuning-close')?.addEventListener('click', () => { root.hidden = true; });", "  root.querySelector<HTMLButtonElement>('.dev-tuning-close')?.addEventListener('click', () => { root.hidden = true; document.body.classList.remove('dev-tuning-open'); });", 'dev close state');
  text = replaceOnce(text, "    button.addEventListener('click', () => { if (panel) panel.hidden = !panel.hidden; });", "    button.addEventListener('click', () => { if (panel) { panel.hidden = !panel.hidden; syncDevOpenClass(); } });", 'dev button state');
  text = replaceOnce(text, "  if (panel) panel.hidden = !panel.hidden;\n});", "  if (panel) { panel.hidden = !panel.hidden; syncDevOpenClass(); }\n});", 'dev f2 state');
  text = replaceOnce(text, "ensureUi();\nsaveAndBroadcast();", "ensureUi();\nsyncDevOpenClass();\nsaveAndBroadcast();", 'initial dev state');
  return text;
});

patch('client/src/dev-tuning.css', (input) => `${input}\n\n/* Game log is a diagnostic aid: keep it unavailable during normal play. */\nbody:not(.dev-tuning-open) .game-log { display: none !important; }\nbody:not(.dev-tuning-open) .game-layout,\nbody:not(.dev-tuning-open) .game-layout:has(.mahjong-table.table-3d-active) {\n  grid-template-columns: minmax(0, 1fr) !important;\n}\nbody.dev-tuning-open .game-log { display: block; }\n`);

patch('client/src/table-3d.ts', (input) => {
  let text = input;
  text = replaceOnce(text, "  backColor: string;\n};", "  backColor: string;\n  sceneColor: string;\n};", '3d scene type');
  text = replaceOnce(text, "    riverRowGap: .55,", "    riverRowGap: .60,", '3d row gap default');
  text = replaceOnce(text, "  backColor: '#315c49',\n};", "  backColor: '#315c49',\n  sceneColor: '#071b13',\n};", '3d scene default');
  text = replaceOnce(text, "let reconcileScheduled = false;\nlet reconcileGeneration = 0;", "let reconcileScheduled = false;\nlet reconcileGeneration = 0;\nlet devTuningCache: DevTuning | null = null;", 'tuning cache declaration');
  text = replaceOnce(text, "function readDevTuning(): DevTuning {\n  let raw: any = {};", "function readDevTuning(): DevTuning {\n  if (devTuningCache) return devTuningCache;\n  let raw: any = {};", 'tuning cache read');
  text = replaceOnce(text, "  return {\n    camera: {", "  const parsed: DevTuning = {\n    camera: {", 'parsed tuning object');
  text = replaceOnce(text, "    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULT_DEV_TUNING.backColor,\n  };\n}", "    backColor: typeof raw.backColor === 'string' ? raw.backColor : DEFAULT_DEV_TUNING.backColor,\n    sceneColor: typeof raw.sceneColor === 'string' ? raw.sceneColor : DEFAULT_DEV_TUNING.sceneColor,\n  };\n  if (Math.abs(parsed.tiles.riverRowGap - .55) < .0001) parsed.tiles.riverRowGap = .60;\n  devTuningCache = parsed;\n  return parsed;\n}", 'cache parsed tuning');
  text = replaceOnce(text, "      transform.x = 5.20 - col * .44;\n      transform.z = 3.72 - row * .58;", "      transform.x = 5.52 - col * .44;\n      transform.z = 4.34 - row * .58;", 'bottom meld edge');
  text = replaceOnce(text, "      transform.x = -5.20 + col * .44;\n      transform.z = -3.72 + row * .58;", "      transform.x = -5.52 + col * .44;\n      transform.z = -4.34 + row * .58;", 'top meld edge');
  text = replaceOnce(text, "      transform.x = -5.20 + row * .58;\n      transform.z = 3.72 - col * .44;", "      transform.x = -5.52 + row * .58;\n      transform.z = 4.34 - col * .44;", 'left meld edge');
  text = replaceOnce(text, "      transform.x = 5.20 - row * .58;\n      transform.z = -3.72 + col * .44;", "      transform.x = 5.52 - row * .58;\n      transform.z = -4.34 + col * .44;", 'right meld edge');
  text = replaceOnce(text, "  visual.add(indicator);", "  group.add(indicator);", 'indicator ground parent');
  text = replaceOnce(text, "  visual.add(latestHalo);", "  group.add(latestHalo);", 'latest halo ground parent');
  text = replaceOnce(text, "    alpha: true,", "    alpha: false,", 'opaque renderer');
  text = replaceOnce(
    text,
`  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b2017, 16, 29);

  const tuning = readDevTuning();`,
`  const tuning = readDevTuning();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(tuning.sceneColor);
  scene.fog = new THREE.Fog(tuning.sceneColor, 16, 29);`,
    'scene background',
  );
  text = replaceOnce(text, "  rt.camera.updateProjectionMatrix();\n  rt.woodMaterial.color.set(tuning.woodColor);", "  rt.camera.updateProjectionMatrix();\n  rt.scene.background?.set?.(tuning.sceneColor);\n  rt.scene.fog?.color?.set?.(tuning.sceneColor);\n  rt.woodMaterial.color.set(tuning.woodColor);", 'apply scene background');
  text = replaceOnce(
    text,
`  const hoverOffset = new rt.THREE.Vector3();
  const inverseRotation = new rt.THREE.Quaternion();`,
`  const hoverOffset = new rt.THREE.Vector3();
  const groundOffset = new rt.THREE.Vector3();
  const inverseRotation = new rt.THREE.Quaternion();
  const groundRotation = new rt.THREE.Quaternion().setFromEuler(new rt.THREE.Euler(-Math.PI / 2, 0, 0));`,
    'ground highlight helpers',
  );
  text = replaceOnce(
    text,
`    const hovered = rt.hoveredKey === actor.key && actor.spec.selectable;
    const pressed = rt.pressedKey === actor.key && hovered;
    const hoverY = hovered ? (pressed ? .08 : .16) : 0;`,
`    // Keep halos on the felt in world space. They no longer rotate/lift with the tile, so the
    // highlight reads as a pool of light underneath instead of a ring behind the face.
    const feltTop = rt.felt.position.y + rt.felt.scale.y / 2 + .008;
    inverseRotation.copy(actor.group.quaternion).invert();
    groundOffset.set(0, feltTop - actor.group.position.y, 0).applyQuaternion(inverseRotation);
    actor.indicator.position.copy(groundOffset);
    actor.latestHalo.position.copy(groundOffset);
    actor.indicator.quaternion.copy(inverseRotation).multiply(groundRotation);
    actor.latestHalo.quaternion.copy(inverseRotation).multiply(groundRotation);

    const hovered = rt.hoveredKey === actor.key && actor.spec.selectable;
    const pressed = rt.pressedKey === actor.key && hovered;
    const hoverY = hovered ? (pressed ? .08 : .16) : 0;`,
    'ground highlights',
  );
  text = replaceOnce(text, "window.addEventListener('mahjong-live:dev-tuning', scheduleReconcile);", "window.addEventListener('mahjong-live:dev-tuning', (event) => {\n  const detail = (event as CustomEvent<DevTuning>).detail;\n  devTuningCache = detail && typeof detail === 'object' ? detail : null;\n  scheduleReconcile();\n});\nwindow.addEventListener('storage', (event) => {\n  if (event.key !== DEV_TUNING_KEY) return;\n  devTuningCache = null;\n  scheduleReconcile();\n});", 'cached tuning event');
  return text;
});
