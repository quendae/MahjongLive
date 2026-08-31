import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const noOpen = process.argv.includes('--no-open');
const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0);

if (nodeMajor < 20) {
  console.error('\nMahjong Live requires Node.js 20 or newer.');
  console.error('Install the current Node.js LTS release, then run this launcher again.\n');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const pnpmBin = isWindows ? 'pnpm.cmd' : 'pnpm';
const corepackBin = isWindows ? 'corepack.cmd' : 'corepack';
const npxBin = isWindows ? 'npx.cmd' : 'npx';

function available(command, args = ['--version']) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'ignore', shell: false });
  return result.status === 0;
}

function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (error) => {
    console.error(`Unable to start ${command}:`, error.message);
    process.exit(1);
  });
}

let packageRunner;
if (available(pnpmBin)) {
  packageRunner = { command: pnpmBin, prefix: [] };
} else if (available(corepackBin, ['pnpm', '--version'])) {
  packageRunner = { command: corepackBin, prefix: ['pnpm'] };
} else {
  packageRunner = { command: npxBin, prefix: ['--yes', 'pnpm@11.24.0'] };
}

const dependenciesReady = existsSync(resolve(root, 'shared/node_modules/vitest/package.json'));
if (!dependenciesReady) {
  console.log('\nMahjong Live: first start — installing project dependencies...\n');
  const install = spawnSync(
    packageRunner.command,
    [...packageRunner.prefix, 'install', '--frozen-lockfile'],
    { cwd: root, stdio: 'inherit', shell: false },
  );
  if (install.status !== 0) {
    console.error('\nDependency installation failed. Check your internet connection and try again.');
    process.exit(install.status ?? 1);
  }
}

console.log('\nMahjong Live is starting...');
console.log('The browser will open automatically. Press Ctrl+C here to stop the local server.\n');

run(process.execPath, [
  resolve(root, 'client/scripts/vite.mjs'),
  'dev',
  ...(noOpen ? ['--no-open'] : ['--open']),
]);
