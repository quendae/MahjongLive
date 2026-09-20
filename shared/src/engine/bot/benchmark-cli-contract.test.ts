import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type BenchmarkConfig = {
  seeds: number[];
  rotations: number[];
  maxRounds: number;
  maxActionsPerRound: number;
  help: boolean;
};
type CliModule = {
  parseBenchmarkArgs: (args: readonly string[]) => BenchmarkConfig;
  benchmarkHelp: () => string;
};

async function loadCli(): Promise<CliModule | null> {
  // fileURLToPath, not the file:// href: a checkout path containing a space stays
  // percent-encoded through the vitest loader and fails to resolve.
  const path = fileURLToPath(new URL('../../../../scripts/bot-benchmark.mjs', import.meta.url));
  try {
    return await import(path) as CliModule;
  } catch {
    return null;
  }
}

describe('bot benchmark CLI contract', () => {
  it('parses deterministic seed/rotation limits and exposes useful help', async () => {
    const cli = await loadCli();
    expect(cli, 'scripts/bot-benchmark.mjs should exist and be importable').not.toBeNull();
    if (!cli) return;

    const config = cli.parseBenchmarkArgs([
      '--seeds', '11,22,33',
      '--rotations', '0,2',
      '--max-rounds', '48',
      '--max-actions', '1600',
    ]);
    expect(config).toEqual({
      seeds: [11, 22, 33],
      rotations: [0, 2],
      maxRounds: 48,
      maxActionsPerRound: 1600,
      help: false,
    });

    expect(cli.parseBenchmarkArgs(['--help']).help).toBe(true);
    expect(cli.parseBenchmarkArgs(['--', '--help']).help).toBe(true);
    expect(cli.parseBenchmarkArgs(['--', '--seeds', '44,55']).seeds).toEqual([44, 55]);

    const help = cli.benchmarkHelp();
    expect(help).toContain('pnpm bot:benchmark');
    expect(help).toContain('--seeds');
    expect(help).toContain('--rotations');
    expect(help).toContain('Casual / Standard / Expert / Expert');
  });
});
