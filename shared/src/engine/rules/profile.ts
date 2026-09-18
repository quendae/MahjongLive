export type RuleProfileId = 'standard';

export interface RuleProfile {
  id: RuleProfileId;
  /** When a completed Kan exposes the next Dora indicator. */
  kanDoraTiming: 'immediate' | 'after-discard';
  /** Whether qualifying terminal/honour-only rivers settle as Nagashi Mangan. */
  nagashiMangan: boolean;
  /** Tenhou-style tobi: negative points end the match; exactly zero continues. */
  bankruptcyBelowZero: boolean;
  /** Allow the leading last dealer to stop on a repeat at/above target. */
  dealerYame: boolean;
  /** Continue into West when South 4 rotates without a target-point leader. */
  westRoundExtension: boolean;
}

export const STANDARD_RULE_PROFILE: RuleProfile = Object.freeze({
  id: 'standard',
  kanDoraTiming: 'immediate',
  nagashiMangan: true,
  bankruptcyBelowZero: true,
  dealerYame: true,
  westRoundExtension: true,
});

export const DEFAULT_RULE_PROFILE_ID: RuleProfileId = STANDARD_RULE_PROFILE.id;

export function resolveRuleProfile(ruleProfileId?: RuleProfileId | string): RuleProfile {
  if (ruleProfileId === undefined || ruleProfileId === STANDARD_RULE_PROFILE.id) {
    return STANDARD_RULE_PROFILE;
  }
  throw new Error(`Unknown rule profile: ${ruleProfileId}`);
}

export function normalizeRuleProfileId(ruleProfileId?: RuleProfileId | string): RuleProfileId {
  return resolveRuleProfile(ruleProfileId).id;
}
