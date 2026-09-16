import { readFile, writeFile } from 'node:fs/promises';

const typesPath = 'shared/src/engine/rules/types.ts';
const roundPath = 'shared/src/engine/rules/round.ts';
let types = await readFile(typesPath, 'utf8');
let round = await readFile(roundPath, 'utf8');

function replaceExact(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

if (!types.includes('riichiDeclaration?: boolean')) {
  types = replaceExact(
    types,
    `  /** This discard followed the final normal live-wall draw, so a Ron on it is Houtei. */\n  wasLastLiveDraw: boolean;\n  /** Set when this discard is consumed by a Chi/Pon/Daiminkan. */`,
    `  /** This discard followed the final normal live-wall draw, so a Ron on it is Houtei. */\n  wasLastLiveDraw: boolean;\n  /** This physical discard was used to declare Riichi / Double Riichi. */\n  riichiDeclaration?: boolean;\n  /** Set when this discard is consumed by a Chi/Pon/Daiminkan. */`,
    'RoundDiscard riichi marker',
  );
}

if (!round.includes('riichiDeclaration: true')) {
  round = replaceExact(
    round,
    `    tsumogiri: phase.drawnTileId !== null && physicalId === phase.drawnTileId,\n    wasLastLiveDraw: phase.isRinshan !== true && phase.wasLastLiveDraw,\n  } as const;`,
    `    tsumogiri: phase.drawnTileId !== null && physicalId === phase.drawnTileId,\n    wasLastLiveDraw: phase.isRinshan !== true && phase.wasLastLiveDraw,\n    ...(pendingRiichi ? { riichiDeclaration: true } : {}),\n  } as const;`,
    'performDiscard marker',
  );
}

await writeFile(typesPath, types, 'utf8');
await writeFile(roundPath, round, 'utf8');
console.log('Applied authoritative Riichi declaration discard marker.');
