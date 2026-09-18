import { describe, expect, it } from 'vitest';

type RulesAuditCliConfig = {
  seeds: number[];
  maxRounds: number;
  maxActionsPerRound: number;
  help: boolean;
};

type RulesAuditCliModule = {
  parseRulesAuditArgs: (args: readonly string[]) => RulesAuditCliConfig;
  rulesAuditHelp: () => string;
};

async function loadCli(): Promise<RulesAuditCliModule | null> {
  const url = new URL('../../../../scripts/rules-audit.mjs', import.meta.url).href;
  try {
    return await import(url) as RulesAuditCliModule;
  } catch {
    return null;
  }
}

describe('rules audit CLI contract', () => {
  it('parses deterministic seed limits and exposes useful help', async () => {
    const cli = await loadCli();
    expect(cli, 'scripts/rules-audit.mjs should exist and be importable').not.toBeNull();
    if (!cli) return;

    const config = cli.parseRulesAuditArgs([
      '--seeds', '11,22,33',
      '--max-rounds', '48',
      '--max-actions', '1600',
    ]);
    expect(config).toEqual({
      seeds: [11, 22, 33],
      maxRounds: 48,
      maxActionsPerRound: 1600,
      help: false,
    });

    expect(cli.parseRulesAuditArgs(['--help']).help).toBe(true);
    expect(cli.parseRulesAuditArgs(['--', '--help']).help).toBe(true);
    expect(cli.parseRulesAuditArgs(['--', '--seeds', '44,55']).seeds).toEqual([44, 55]);

    const help = cli.rulesAuditHelp();
    expect(help).toContain('pnpm rules:audit');
    expect(help).toContain('--seeds');
    expect(help).toContain('--max-rounds');
    expect(help).toContain('--max-actions');
    expect(help).toContain('regression');
  });
});
