import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SEEDS = [20260916, 20260917, 20260918, 20260919, 20260920, 20260921];

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

export function parseRulesAuditArgs(args) {
  const config = {
    seeds: [...DEFAULT_SEEDS],
    maxRounds: 64,
    maxActionsPerRound: 2048,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') {
      continue;
    } else if (argument === '--help' || argument === '-h') {
      config.help = true;
    } else if (argument === '--seeds') {
      config.seeds = listArgument(args[++index], '--seeds');
    } else if (argument === '--max-rounds') {
      config.maxRounds = positiveInteger(args[++index], '--max-rounds');
    } else if (argument === '--max-actions') {
      config.maxActionsPerRound = positiveInteger(args[++index], '--max-actions');
    } else {
      throw new Error(`Unknown rules audit option: ${argument}`);
    }
  }

  return config;
}

export function rulesAuditHelp() {
  return [
    'Mahjong Live deterministic rules regression audit',
    '',
    'Usage:',
    '  pnpm rules:audit [-- --seeds 11,22 --max-rounds 64 --max-actions 2048]',
    '',
    'Replays deterministic full-match regression seeds through the production engine and checks cross-round invariants.',
    '',
    'Options:',
    '  --seeds <a,b,...>  Deterministic regression match seeds',
    '  --max-rounds <n>   Safety limit per Hanchan (default 64)',
    '  --max-actions <n>  Safety limit per round (default 2048)',
    '  -h, --help         Show this help without running matches',
  ].join('\n');
}

function runRulesAudit(config) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = [
    '--filter', '@mahjong-live/shared',
    'exec', 'vitest', 'run',
    'src/engine/bot/rulesAudit.test.ts',
    '--reporter=verbose',
  ];
  const env = {
    ...process.env,
    RULE_AUDIT_RUN: '1',
    RULE_AUDIT_SEEDS: config.seeds.join(','),
    RULE_AUDIT_MAX_ROUNDS: String(config.maxRounds),
    RULE_AUDIT_MAX_ACTIONS: String(config.maxActionsPerRound),
  };
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function main() {
  try {
    const config = parseRulesAuditArgs(process.argv.slice(2));
    if (config.help) {
      console.log(rulesAuditHelp());
      return;
    }
    console.log(`Rules audit: ${config.seeds.length} deterministic regression seed(s)`);
    process.exitCode = runRulesAudit(config);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Use --help for rules audit options.');
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) main();
