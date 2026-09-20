import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Same trick as client/scripts/vite.mjs: the workspace imports TypeScript across package
// boundaries with extensionless specifiers, which bare Node cannot resolve. Vite is already
// in the tree as a Vitest dependency, so reuse it rather than adding a second toolchain.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(scriptDir, '..');
const repoRoot = resolve(serverRoot, '..');

const vitestPackage = realpathSync(resolve(repoRoot, 'shared/node_modules/vitest/package.json'));
const requireFromVitest = createRequire(vitestPackage);
const viteModule = await import(pathToFileURL(requireFromVitest.resolve('vite')).href);
const vite = viteModule.default ?? viteModule;

const dev = await vite.createServer({
  configFile: false,
  appType: 'custom',
  root: serverRoot,
  server: { middlewareMode: true },
});

try {
  const { startServer } = await dev.ssrLoadModule(resolve(serverRoot, 'src/server.ts'));
  const running = await startServer({ port: Number(process.env.PORT ?? 8787) });
  console.log(`mahjong-live server on http://127.0.0.1:${running.port}`);
} catch (error) {
  await dev.close();
  throw error;
}
