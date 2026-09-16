import { readFile, writeFile } from 'node:fs/promises';

const mainPath = 'client/src/main.ts';
const clarityPath = 'client/src/clarity.ts';
const cssPath = 'client/src/clarity.css';
const table3dPath = 'client/src/table-3d.ts';
let main = await readFile(mainPath, 'utf8');
let clarity = await readFile(clarityPath, 'utf8');
let css = await readFile(cssPath, 'utf8');
let table3d = await readFile(table3dPath, 'utf8');

function replaceExact(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function replaceAllExact(text, before, after, expected, label) {
  const count = text.split(before).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} patch anchors for ${label}, found ${count}`);
  return text.split(before).join(after);
}

if (!main.includes('riichiDeclaration?: boolean;')) {
  main = replaceExact(
    main,
    `    called?: boolean;\n    meldCalled?: boolean;`,
    `    called?: boolean;\n    riichiDeclaration?: boolean;\n    meldCalled?: boolean;`,
    'tileMarkup option',
  );
}
if (!main.includes('const riichiDeclarationAttr')) {
  main = replaceExact(
    main,
    `  const calledFromAttr = options.calledFrom !== undefined ? \` data-called-from="\${options.calledFrom}"\` : '';\n  const title = options.adviceText ? \` title="\${options.adviceText}"\` : '';\n  return \`<div class="\${classes.join(' ')}" aria-label="\${tileLabel(tile)}"\${engineAttr}\${actionAttr}\${calledFromAttr}\${title}>\${tileFace(tile)}</div>\`;`,
    `  const calledFromAttr = options.calledFrom !== undefined ? \` data-called-from="\${options.calledFrom}"\` : '';\n  const riichiDeclarationAttr = options.riichiDeclaration ? ' data-riichi-declaration="true"' : '';\n  const title = options.adviceText ? \` title="\${options.adviceText}"\` : '';\n  return \`<div class="\${classes.join(' ')}" aria-label="\${tileLabel(tile)}"\${engineAttr}\${actionAttr}\${calledFromAttr}\${riichiDeclarationAttr}\${title}>\${tileFace(tile)}</div>\`;`,
    'tileMarkup attribute',
  );
}
if ((main.match(/riichiDeclaration: discard\.riichiDeclaration === true/g) ?? []).length === 0) {
  main = replaceAllExact(
    main,
    `    compact: true,\n    called: discard.calledBy !== undefined,\n  })).join('');`,
    `    compact: true,\n    called: discard.calledBy !== undefined,\n    riichiDeclaration: discard.riichiDeclaration === true,\n  })).join('');`,
    2,
    'river discard markup',
  );
}

if (!clarity.includes('function markRiichiDiscards(')) {
  clarity = replaceExact(
    clarity,
    `type LatestDiscard = {`,
    `function markRiichiDiscards(table: HTMLElement): void {\n  let changed = false;\n  for (const river of table.querySelectorAll<HTMLElement>('.discard-river')) {\n    const tiles = [...river.querySelectorAll<HTMLElement>(':scope > .tile[data-engine-tile-id]')];\n    let declarationSeen = false;\n    let marker: HTMLElement | null = null;\n    for (const tile of tiles) {\n      if (tile.dataset.riichiDeclaration === 'true') declarationSeen = true;\n      if (declarationSeen && !tile.classList.contains('tile-called')) {\n        marker = tile;\n        break;\n      }\n    }\n    for (const tile of tiles) {\n      const wanted = tile === marker;\n      if (tile.classList.contains('tile-riichi-discard') !== wanted) {\n        tile.classList.toggle('tile-riichi-discard', wanted);\n        changed = true;\n      }\n    }\n  }\n  if (changed) window.dispatchEvent(new Event('mahjong-live:riichi-marker'));\n}\n\ntype LatestDiscard = {`,
    'Riichi marker enhancer',
  );
}
if (!clarity.includes('  markRiichiDiscards(table);')) {
  clarity = replaceExact(
    clarity,
    `  ensureDoraTray(table);\n  enhanceCenterCounter(table);\n  const latest = markLatestDiscard(table);`,
    `  ensureDoraTray(table);\n  enhanceCenterCounter(table);\n  markRiichiDiscards(table);\n  const latest = markLatestDiscard(table);`,
    'enhance Riichi marker',
  );
}

if (!css.includes('.tile-riichi-discard')) {
  css += `\n\n/* A Riichi declaration is placed sideways in the river. If that physical discard was called,\n   clarity.ts transfers this class to the next uncalled discard. Scale keeps the rotated long edge\n   inside the existing river track instead of colliding with neighbouring tiles. */\n.mahjong-table:not(.table-3d-active) .discard-river .tile-riichi-discard {\n  z-index: 6;\n  transform: rotate(90deg) scale(.82) !important;\n  transform-origin: center center !important;\n}\n\n.mahjong-table:not(.table-3d-active) .discard-river .tile-riichi-discard.tile-latest-discard {\n  transform: rotate(90deg) scale(.82) translateX(-5px) !important;\n}\n`;
}

if (!table3d.includes('riichiMarker?: boolean;')) {
  table3d = replaceExact(
    table3d,
    `  latest: boolean;\n  tileId: number | null;`,
    `  latest: boolean;\n  riichiMarker?: boolean;\n  tileId: number | null;`,
    'TileSpec riichi marker',
  );
}
if (!table3d.includes("riichiMarker: element.classList.contains('tile-riichi-discard')")) {
  table3d = replaceExact(
    table3d,
    `        latest: element.classList.contains('tile-latest-discard'),\n        tileId,`,
    `        latest: element.classList.contains('tile-latest-discard'),\n        riichiMarker: element.classList.contains('tile-riichi-discard'),\n        tileId,`,
    'gather river marker',
  );
}
if (!table3d.includes('if (spec.riichiMarker) transform.yaw += Math.PI / 2;')) {
  table3d = replaceExact(
    table3d,
    `    // The latest discard stays in its row. A conditional halo is enough feedback.\n    transform.scale = .88 * tuning.tiles.riverScale;`,
    `    // Riichi uses the standard sideways declaration tile. Keep the rotation exact relative to\n    // the owner's seat; random river yaw is disabled for this marker in humanizeTransform().\n    if (spec.riichiMarker) transform.yaw += Math.PI / 2;\n    // The latest discard stays in its row. A conditional halo is enough feedback.\n    transform.scale = .88 * tuning.tiles.riverScale;`,
    '3D river Riichi rotation',
  );
}
if (!table3d.includes("yaw = spec.riichiMarker ? 0 : radians(tuning.tiles.riverYawJitter);")) {
  table3d = replaceExact(
    table3d,
    `    position = tuning.tiles.riverJitter;\n    yaw = radians(tuning.tiles.riverYawJitter);\n    tilt = radians(tuning.tiles.riverTiltJitter);`,
    `    position = tuning.tiles.riverJitter;\n    yaw = spec.riichiMarker ? 0 : radians(tuning.tiles.riverYawJitter);\n    tilt = radians(tuning.tiles.riverTiltJitter);`,
    '3D river yaw jitter',
  );
}
if (!table3d.includes("window.addEventListener('mahjong-live:riichi-marker', scheduleReconcile);")) {
  table3d = replaceExact(
    table3d,
    `window.addEventListener('mahjong-live:tile-face-mode', scheduleReconcile);`,
    `window.addEventListener('mahjong-live:tile-face-mode', scheduleReconcile);\nwindow.addEventListener('mahjong-live:riichi-marker', scheduleReconcile);`,
    '3D Riichi marker reconcile',
  );
}

await writeFile(mainPath, main, 'utf8');
await writeFile(clarityPath, clarity, 'utf8');
await writeFile(cssPath, css, 'utf8');
await writeFile(table3dPath, table3d, 'utf8');
console.log('Applied 2D/3D Riichi declaration discard presentation.');
