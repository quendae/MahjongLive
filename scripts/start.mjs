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
const windowsCommandHost = process.env.ComSpec || 'cmd.exe';

function portableInvocation(command, args) {
  if (isWindows && /\.(?:cmd|bat)$/i.test(command)) {
    return {
      command: windowsCommandHost,
      args: ['/d', '/c', command, ...args],
    };
  }
  return { command, args };
}

function spawnSyncPortable(command, args, stdio = 'ignore') {
  const invocation = portableInvocation(command, args);
  return spawnSync(invocation.command, invocation.args, {
    cwd: root,
    stdio,
    shell: false,
  });
}

function available(command, args = ['--version']) {
  const result = spawnSyncPortable(command, args, 'ignore');
  return !result.error && result.status === 0;
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
  packageRunner = { command: pnpmBin, prefix: [], label: 'pnpm' };
} else if (available(corepackBin, ['pnpm', '--version'])) {
  packageRunner = { command: corepackBin, prefix: ['pnpm'], label: 'Corepack / pnpm' };
} else if (available(npxBin, ['--version'])) {
  packageRunner = { command: npxBin, prefix: ['--yes', 'pnpm@11.24.0'], label: 'npx / pnpm' };
} else {
  console.error('\nMahjong Live could not find pnpm, Corepack, or npx.');
  console.error(`Node.js detected: ${process.version}`);
  console.error('Reinstall the current Node.js LTS release with npm included, then try again.\n');
  process.exit(1);
}

const dependenciesReady = existsSync(resolve(root, 'shared/node_modules/vitest/package.json'));
if (!dependenciesReady) {
  console.log('\nMahjong Live: first start — installing project dependencies...');
  console.log(`Package runner: ${packageRunner.label}\n`);

  const install = spawnSyncPortable(
    packageRunner.command,
    [...packageRunner.prefix, 'install', '--frozen-lockfile'],
    'inherit',
  );

  if (install.error) {
    console.error(`\nCould not launch ${packageRunner.label}: ${install.error.message}`);
    console.error(`Node.js: ${process.version}`);
    console.error('If this persists, reinstall the current Node.js LTS release and try again.');
    process.exit(1);
  }

  if (install.status !== 0) {
    console.error(`\nDependency installation failed with exit code ${install.status ?? 'unknown'}.`);
    console.error(`Package runner: ${packageRunner.label}`);
    console.error('The package-manager error printed above contains the actual cause.');
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
