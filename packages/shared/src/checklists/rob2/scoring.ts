/**
 * ROB-2 Smart Scoring Engine
 *
 * Public entry point that re-exports all scoring sub-modules and provides
 * the top-level dispatcher and aggregation functions.
 */

import { JUDGEMENTS, RESPONSE_TYPES, getDomainQuestions, type DomainKey } from './schema.js';
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
 * Questions on the active scoring path for a domain: the ones the scorer
 * consults given the current answers. Derived by recording reads, so the
 * decision tree lives only in the scorers.
 */
export function getRequiredQuestions(
  domainKey: string,
  answers: DomainAnswers | undefined,
): Set<string> {
  const read = new Set<string>();
  if (!answers) return read;

  const tracked = new Proxy(answers, {
    get(target, prop) {
      if (typeof prop === 'string') read.add(prop);
      return target[prop as string];
    },
  });
  scoreRob2Domain(domainKey, tracked);
  return read;
}

/**
 * Questions required now or under any way of answering the open required
 * questions. The complement of getRequiredQuestions mixes questions pruned off
 * the path with questions further down a branch that is still pending; this
 * separates them. 3.2 is only off the path once 3.1 is actually Y.
 */
export function getReachableQuestions(domainKey: string, answers: DomainAnswers): Set<string> {
  const questions = getDomainQuestions(domainKey);
  const questionKeys = Object.keys(questions);
  const reachable = new Set<string>();
  const seen = new Set<string>();

  const visit = (state: DomainAnswers) => {
    const stateKey = questionKeys.map(qKey => state[qKey]?.answer ?? '').join('|');
    if (seen.has(stateKey)) return;
    seen.add(stateKey);

    for (const qKey of getRequiredQuestions(domainKey, state)) {
      reachable.add(qKey);
      if (state[qKey]?.answer != null) continue;
      for (const option of RESPONSE_TYPES[questions[qKey].responseType]) {
        visit({ ...state, [qKey]: { answer: option } });
      }
    }
  };

  visit(answers);
  return reachable;
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

  let overall: (typeof JUDGEMENTS)[keyof typeof JUDGEMENTS] | null = null;
  if (judgements.length === activeDomainKeys.length) {
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
