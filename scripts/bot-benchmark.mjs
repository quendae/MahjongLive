import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SEEDS = [20260916, 20260917];
const DEFAULT_ROTATIONS = [0, 1, 2, 3];

function listArgument(value, name) {
  if (!value) throw new Error(`${name} requires a comma-separated value`);
  const values = value.split(',').map((part) => Number(part.trim()));
  if (values.length === 0 || values.some((entry) => !Number.isFinite(entry))) {
    throw new Error(`${name} must contain only numbers`);
  }
  return values.map((entry) => Math.trunc(entry));
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function parseBenchmarkArgs(args) {
  const config = {
    seeds: [...DEFAULT_SEEDS],
    rotations: [...DEFAULT_ROTATIONS],
    maxRounds: 64,
    maxActionsPerRound: 2048,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      config.help = true;
    } else if (argument === '--seeds') {
      config.seeds = listArgument(args[++index], '--seeds');
    } else if (argument === '--rotations') {
      const rotations = listArgument(args[++index], '--rotations');
      if (rotations.some((rotation) => rotation < 0 || rotation > 3)) {
        throw new Error('--rotations accepts only 0,1,2,3');
      }
      config.rotations = [...new Set(rotations)];
    } else if (argument === '--max-rounds') {
      config.maxRounds = positiveInteger(args[++index], '--max-rounds');
    } else if (argument === '--max-actions') {
      config.maxActionsPerRound = positiveInteger(args[++index], '--max-actions');
    } else {
      throw new Error(`Unknown benchmark option: ${argument}`);
    }
  }

  return config;
}

export function benchmarkHelp() {
  return [
    'Mahjong Live bot calibration benchmark',
    '',
    'Usage:',
    '  pnpm bot:benchmark [-- --seeds 11,22 --rotations 0,1,2,3]',
    '',
    'The benchmark rotates the Casual / Standard / Expert / Expert lineup between seats.',
    'Defaults: two deterministic seeds and all four rotations (8 complete Hanchan matches).',
    '',
    'Options:',
    '  --seeds <a,b,...>      Deterministic match seeds',
    '  --rotations <0,1,2,3> Seat rotations to execute',
    '  --max-rounds <n>       Safety limit per Hanchan (default 64)',
    '  --max-actions <n>      Safety limit per round (default 2048)',
    '  -h, --help             Show this help without running matches',
  ].join('\n');
}

function runBenchmark(config) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = [
    '--filter', '@mahjong-live/shared',
    'exec', 'vitest', 'run',
    'src/engine/bot/calibration-benchmark.test.ts',
    '--reporter=verbose',
  ];
  const env = {
    ...process.env,
    BOT_BENCHMARK_RUN: '1',
    BOT_BENCHMARK_SEEDS: config.seeds.join(','),
    BOT_BENCHMARK_ROTATIONS: config.rotations.join(','),
    BOT_BENCHMARK_MAX_ROUNDS: String(config.maxRounds),
    BOT_BENCHMARK_MAX_ACTIONS: String(config.maxActionsPerRound),
  };
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  try {
    const config = parseBenchmarkArgs(process.argv.slice(2));
    if (config.help) {
      console.log(benchmarkHelp());
      return;
    }
    console.log(`Bot calibration: ${config.seeds.length} seed(s) × ${config.rotations.length} rotation(s)`);
    process.exitCode = runBenchmark(config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Use --help for benchmark options.');
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) main();
