/**
 * ROBINS-I V2 Smart Scoring Engine
 *
 * Public entry point -- re-exports helpers, types, and domain scorers from
 * sub-modules and provides the dispatcher and aggregation functions.
 */

// Re-export everything from sub-modules so the public API is unchanged
export {
  JUDGEMENTS,
  type Judgement,
  type ScoringResult,
  type DomainAnswers,
} from './scoring-helpers.js';

export {
  scoreDomain1A,
  scoreDomain1B,
  scoreDomain2,
  scoreDomain3,
  scoreDomain4,
  scoreDomain5,
  scoreDomain6,
} from './scoring-domains.js';

import {
  type DomainAnswers,
  type Judgement,
  type ScoringResult,
  JUDGEMENTS,
} from './scoring-helpers.js';
import {
  scoreDomain1A,
  scoreDomain1B,
  scoreDomain2,
  scoreDomain3,
  scoreDomain4,
  scoreDomain5,
  scoreDomain6,
} from './scoring-domains.js';

/**
 * Main entry point: score a ROBINS-I domain
 */
export function scoreRobinsDomain(
  domainKey: string,
  answers: DomainAnswers | undefined,
  _options: { isPerProtocol?: boolean } = {},
): ScoringResult {
  if (!answers) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  switch (domainKey) {
    case 'domain1a':
      return scoreDomain1A(answers);
    case 'domain1b':
      return scoreDomain1B(answers);
    case 'domain2':
      return scoreDomain2(answers);
    case 'domain3':
      return scoreDomain3(answers);
    case 'domain4':
      return scoreDomain4(answers);
    case 'domain5':
      return scoreDomain5(answers);
    case 'domain6':
      return scoreDomain6(answers);
    default:
      return { judgement: null, isComplete: false, ruleId: null };
  }
}

interface DomainState {
  answers?: DomainAnswers;
  direction?: string | null;
}

interface ChecklistState {
  sectionC?: { isPerProtocol?: boolean };
  [domainKey: string]: DomainState | unknown;
}

interface DomainScoringInfo {
  auto: ScoringResult;
  judgement: Judgement | null;
}

interface AllDomainsResult {
  domains: Record<string, DomainScoringInfo>;
  overall: Judgement | null;
  isComplete: boolean;
}

/**
 * Score all active domains and return a summary. Domain judgements are always
 * derived from the signalling answers -- there is no manual override.
 */
export function scoreAllDomains(checklistState: ChecklistState | null): AllDomainsResult {
  if (!checklistState) {
    return { domains: {}, overall: null, isComplete: false };
  }

  const isPerProtocol = checklistState.sectionC?.isPerProtocol || false;
  const activeDomainKeys =
    isPerProtocol ?
      ['domain1b', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6']
    : ['domain1a', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6'];

  const domains: Record<string, DomainScoringInfo> = {};
  const judgements: Judgement[] = [];

  for (const domainKey of activeDomainKeys) {
    const domainState = checklistState[domainKey] as DomainState | undefined;
    const auto = scoreRobinsDomain(domainKey, domainState?.answers, { isPerProtocol });

    domains[domainKey] = { auto, judgement: auto.judgement };

    if (auto.judgement) {
      judgements.push(auto.judgement);
    }
  }

  let overall: Judgement | null = null;
  if (judgements.length === activeDomainKeys.length) {
    if (judgements.includes(JUDGEMENTS.CRITICAL)) {
      overall = JUDGEMENTS.CRITICAL;
    } else if (judgements.includes(JUDGEMENTS.SERIOUS)) {
      overall = JUDGEMENTS.SERIOUS;
    } else if (judgements.includes(JUDGEMENTS.MODERATE)) {
      overall = JUDGEMENTS.MODERATE;
    } else {
      overall = JUDGEMENTS.LOW;
    }
  }

  return { domains, overall, isComplete: judgements.length === activeDomainKeys.length };
}

// Overall risk of bias display strings for UI
export const OVERALL_DISPLAY = {
  LOW_EXCEPT_CONFOUNDING: 'Low risk of bias except for concerns about uncontrolled confounding',
  MODERATE: 'Moderate risk',
  SERIOUS: 'Serious risk',
  CRITICAL: 'Critical risk',
} as const;

/**
 * Map internal overall judgement to the OVERALL_ROB_JUDGEMENTS display strings
 */
export function mapOverallJudgementToDisplay(judgement: Judgement | null): string | null {
  switch (judgement) {
    case JUDGEMENTS.LOW:
    case JUDGEMENTS.LOW_EXCEPT_CONFOUNDING:
      return OVERALL_DISPLAY.LOW_EXCEPT_CONFOUNDING;
    case JUDGEMENTS.MODERATE:
      return OVERALL_DISPLAY.MODERATE;
    case JUDGEMENTS.SERIOUS:
      return OVERALL_DISPLAY.SERIOUS;
    case JUDGEMENTS.CRITICAL:
      return OVERALL_DISPLAY.CRITICAL;
    default:
      return null;
  }
}
