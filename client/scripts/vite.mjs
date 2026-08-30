import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(scriptDir, '..');
const repoRoot = resolve(clientRoot, '..');

// Vite is already a dependency of shared's Vitest. Resolve it from Vitest's real pnpm
// location so the single-player client does not add a second frontend dependency graph yet.
const vitestPackage = realpathSync(resolve(repoRoot, 'shared/node_modules/vitest/package.json'));
const requireFromVitest = createRequire(vitestPackage);
const viteEntry = requireFromVitest.resolve('vite');
const vite = await import(pathToFileURL(viteEntry).href);

const alias = [
  { find: '@mahjong-live/shared/single', replacement: resolve(repoRoot, 'shared/src/engine/single/index.ts') },
  { find: '@mahjong-live/shared/rules', replacement: resolve(repoRoot, 'shared/src/engine/rules/index.ts') },
  { find: '@mahjong-live/shared/match', replacement: resolve(repoRoot, 'shared/src/engine/match/index.ts') },
  { find: '@mahjong-live/shared/tile-types', replacement: resolve(repoRoot, 'shared/src/engine/tiles/types.ts') },
];

const config = {
  root: clientRoot,
  resolve: { alias },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
};

const command = process.argv[2] ?? 'dev';
if (command === 'build') {
  await vite.build(config);
} else if (command === 'preview') {
  const server = await vite.preview(config);
  server.printUrls();
} else {
  const server = await vite.createServer(config);
  await server.listen();
  server.printUrls();
}
