/**
 * ROB-2 Smart Scoring Engine
 *
 * Public entry point that re-exports all scoring sub-modules and provides
 * the top-level dispatcher and aggregation functions.
 */

import { JUDGEMENTS, type DomainKey } from './schema.js';
import type {
  ScoringResult,
  DomainAnswers,
  DomainState,
  ChecklistState,
  DomainScoringInfo,
  AllDomainsResult,
} from './scoring-helpers.js';
import {
  scoreDomain1,
  scoreDomain2a,
  scoreDomain2b,
  scoreDomain3,
  scoreDomain4,
  scoreDomain5,
} from './scoring-domains.js';

// Re-export everything from sub-modules so the public API stays unchanged
export * from './scoring-helpers.js';
export * from './scoring-domains.js';
export * from './scoring-required.js';

/**
 * Main entry point: score a ROB-2 domain
 */
export function scoreRob2Domain(
  domainKey: string,
  answers: DomainAnswers | undefined,
): ScoringResult {
  if (!answers) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  switch (domainKey) {
    case 'domain1':
      return scoreDomain1(answers);
    case 'domain2a':
      return scoreDomain2a(answers);
    case 'domain2b':
      return scoreDomain2b(answers);
    case 'domain3':
      return scoreDomain3(answers);
    case 'domain4':
      return scoreDomain4(answers);
    case 'domain5':
      return scoreDomain5(answers);
    default:
      return { judgement: null, isComplete: false, ruleId: null };
  }
}

/**
 * Score all active domains and return a summary
 */
export function scoreAllDomains(checklistState: ChecklistState | null): AllDomainsResult {
  if (!checklistState) {
    return { domains: {}, overall: null, isComplete: false };
  }

  const isAdhering = checklistState.preliminary?.aim === 'ADHERING';
  const activeDomainKeys: DomainKey[] =
    isAdhering ?
      ['domain1', 'domain2b', 'domain3', 'domain4', 'domain5']
    : ['domain1', 'domain2a', 'domain3', 'domain4', 'domain5'];

  const domains: Record<string, DomainScoringInfo> = {};
  const judgements: (typeof JUDGEMENTS)[keyof typeof JUDGEMENTS][] = [];

  for (const domainKey of activeDomainKeys) {
    const domainState = checklistState[domainKey] as DomainState | undefined;
    const auto = scoreRob2Domain(domainKey, domainState?.answers);

    domains[domainKey] = {
      auto,
      judgement: auto.judgement,
    };

    if (auto.judgement) {
      judgements.push(auto.judgement);
    }
  }

  // Calculate overall judgement
  let overall: (typeof JUDGEMENTS)[keyof typeof JUDGEMENTS] | null = null;
  if (judgements.length === activeDomainKeys.length) {
    // All domains complete
    if (judgements.includes(JUDGEMENTS.HIGH)) {
      overall = JUDGEMENTS.HIGH;
    } else if (judgements.includes(JUDGEMENTS.SOME_CONCERNS)) {
      overall = JUDGEMENTS.SOME_CONCERNS;
    } else {
      overall = JUDGEMENTS.LOW;
    }
  }

  return {
    domains,
    overall,
    isComplete: judgements.length === activeDomainKeys.length,
  };
}
