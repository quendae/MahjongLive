import { readFile, writeFile } from 'node:fs/promises';

const path = 'client/src/main.ts';
let source = await readFile(path, 'utf8');

function replaceExact(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

if (!source.includes("from './claim-choice'")) {
  replaceExact(
    `import { presentationCaption } from './presentation';\nimport { tileAssetUrlForLabel } from './table-3d-faces';`,
    `import { presentationCaption } from './presentation';\nimport { buildClaimChoices, describeClaimAction } from './claim-choice';\nimport { tileAssetUrlForLabel } from './table-3d-faces';`,
    'claim-choice import',
  );
}

if (!source.includes('function activeClaimTile(): Tile | undefined')) {
  replaceExact(
    `function actionDescription(action: RoundAction): string {\n  if (!current) return action.type;\n  const hand = current.state.match.round.players[current.state.humanSeat].concealed;\n  const byId = (id: number) => hand.find((tile) => tile.id === id);\n  const names = (ids: readonly number[]) => ids.map(byId).filter((tile): tile is Tile => Boolean(tile)).map(tileLabel).join(' · ');\n  switch (action.type) {\n    case 'chi':\n    case 'pon':\n    case 'daiminkan':\n    case 'ankan':\n      return names(action.tileIds);\n    case 'shouminkan': {\n      const tile = byId(action.tileId);\n      return tile ? \`${'${tileLabel(tile)}'} · meld ${'${action.meldIndex + 1}'}\` : \`meld ${'${action.meldIndex + 1}'}\`;\n    }`,
    `function activeClaimTile(): Tile | undefined {\n  if (!current) return undefined;\n  const round = current.state.match.round;\n  if (round.phase.kind !== 'reactions') return undefined;\n  return round.players[round.phase.discarder].discards[round.phase.discardIndex]?.tile;\n}\n\nfunction actionDescription(action: RoundAction): string {\n  if (!current) return action.type;\n  const hand = current.state.match.round.players[current.state.humanSeat].concealed;\n  const byId = (id: number) => hand.find((tile) => tile.id === id);\n  switch (action.type) {\n    case 'chi':\n    case 'pon':\n    case 'daiminkan':\n    case 'ankan':\n      return describeClaimAction(action, hand, activeClaimTile(), tileLabel);\n    case 'shouminkan': {\n      const tile = byId(action.tileId);\n      return tile ? \`${'${tileLabel(tile)}'} · meld ${'${action.meldIndex + 1}'}\` : \`meld ${'${action.meldIndex + 1}'}\`;\n    }`,
    'claim description',
  );
}

replaceExact(
  `  // Tile IDs can create several mechanically identical Pon/Kan options. Collapse choices that\n  // look identical to the player, but preserve meaningful alternatives (for example red-five use).\n  const uniqueByDescription = new Map<string, RoundAction>();\n  for (const action of actions) {\n    const description = actionDescription(action);\n    if (!uniqueByDescription.has(description)) uniqueByDescription.set(description, action);\n  }\n  const uniqueActions = [...uniqueByDescription.values()];`,
  `  // Physical tile IDs can produce duplicate-looking claim options. Normalize them by the same\n  // presentation model used by the popup, while preserving red-five and distinct Chi sequences.\n  const hand = current.state.match.round.players[human].concealed;\n  const uniqueActions = buildClaimChoices(actions, hand, activeClaimTile(), tileLabel)\n    .map((choice) => choice.action);`,
  'claim option normalization',
);

await writeFile(path, source, 'utf8');
console.log('Integrated claim-choice presenter into main UI.');
