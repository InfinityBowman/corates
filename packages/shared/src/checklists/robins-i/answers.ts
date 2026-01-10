/**
 * ROBINS-I Answer Utilities
 *
 * Functions for getting and manipulating ROBINS-I checklist answers.
 */

import type { ROBINSIChecklist } from '../types.js';
import { ROBINS_I_CHECKLIST, getActiveDomainKeys, getDomainQuestions } from './schema.js';
import { scoreAllDomains } from './scoring.js';

/**
 * Determines if assessment should stop based on Section B answers
 */
export function shouldStopAssessment(sectionB: ROBINSIChecklist['sectionB'] | undefined): boolean {
  if (!sectionB) return false;

  const b2Answer = sectionB.b2?.answer;
  const b3Answer = sectionB.b3?.answer;

  // Stop if B2 or B3 is Yes or Probably Yes
  return b2Answer === 'Y' || b2Answer === 'PY' || b3Answer === 'Y' || b3Answer === 'PY';
}

/**
 * Score the overall checklist based on domain judgements
 */
export function scoreROBINSIChecklist(state: ROBINSIChecklist): string {
  if (!state || typeof state !== 'object') return 'Error';

  if (shouldStopAssessment(state.sectionB)) {
    return 'Critical';
  }

  const { overall, isComplete } = scoreAllDomains(
    state as unknown as Parameters<typeof scoreAllDomains>[0],
  );

  if (!isComplete) {
    return 'Incomplete';
  }

  return overall || 'Incomplete';
}

/**
 * Get the selected answer for a specific question
 */
export function getSelectedAnswer(
  domainKey: string,
  questionKey: string,
  state: ROBINSIChecklist,
): string | null {
  const domain = state?.[domainKey as keyof ROBINSIChecklist];
  if (!domain || typeof domain !== 'object') return null;
  const typedDomain = domain as { answers?: Record<string, { answer: string | null }> };
  return typedDomain.answers?.[questionKey]?.answer || null;
}

/**
 * Get all answers in a flat format for export/display
 */
export function getAnswers(checklist: ROBINSIChecklist): {
  metadata: {
    name: string;
    reviewerName: string;
    createdAt: string;
    id: string;
  };
  sectionB: Record<string, string | null>;
  domains: Record<
    string,
    {
      judgement: string | null;
      direction: string | null;
      questions: Record<string, string | null>;
    }
  >;
  overall: ROBINSIChecklist['overall'];
} | null {
  if (!checklist || typeof checklist !== 'object') return null;

  const result = {
    metadata: {
      name: checklist.name,
      reviewerName: checklist.reviewerName,
      createdAt: checklist.createdAt,
      id: checklist.id,
    },
    sectionB: {} as Record<string, string | null>,
    domains: {} as Record<
      string,
      {
        judgement: string | null;
        direction: string | null;
        questions: Record<string, string | null>;
      }
    >,
    overall: checklist.overall,
  };

  // Section B
  Object.keys(ROBINS_I_CHECKLIST.sectionB).forEach(key => {
    const sectionBItem = checklist.sectionB?.[key as keyof typeof checklist.sectionB];
    if (typeof sectionBItem === 'object' && sectionBItem !== null && 'answer' in sectionBItem) {
      result.sectionB[key] = sectionBItem.answer || null;
    } else {
      result.sectionB[key] = null;
    }
  });

  // Domains
  const isPerProtocol = checklist.sectionC?.isPerProtocol || false;
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  activeDomains.forEach(domainKey => {
    const domain = checklist[domainKey];
    if (!domain) return;

    result.domains[domainKey] = {
      judgement: domain.judgement || null,
      direction: domain.direction || null,
      questions: {},
    };

    Object.keys(domain.answers || {}).forEach(qKey => {
      result.domains[domainKey].questions[qKey] = domain.answers[qKey]?.answer || null;
    });
  });

  return result;
}

/**
 * Get a summary of domain judgements
 */
export function getDomainSummary(checklist: ROBINSIChecklist): Record<
  string,
  {
    judgement: string | null;
    direction: string | null;
    complete: boolean;
  }
> | null {
  if (!checklist) return null;

  const isPerProtocol = checklist.sectionC?.isPerProtocol || false;
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  const summary: Record<
    string,
    {
      judgement: string | null;
      direction: string | null;
      complete: boolean;
    }
  > = {};

  activeDomains.forEach(domainKey => {
    const domain = checklist[domainKey];
    summary[domainKey] = {
      judgement: domain?.judgement || null,
      direction: domain?.direction || null,
      complete: isQuestionnaireComplete(domainKey, domain?.answers),
    };
  });

  return summary;
}

/**
 * Check if all questions in a domain are answered
 */
function isQuestionnaireComplete(
  domainKey: string,
  answers: Record<string, { answer: string | null }> | undefined,
): boolean {
  if (!answers) return false;

  const questions = getDomainQuestions(domainKey);
  const requiredKeys = Object.keys(questions);

  return requiredKeys.every(key => answers[key]?.answer !== null);
}

/**
 * Check if a ROBINS-I checklist is complete (all active domains have judgements and overall is set)
 */
export function isROBINSIComplete(checklist: ROBINSIChecklist): boolean {
  if (!checklist || typeof checklist !== 'object') return false;

  // If assessment stopped early, it's complete with Critical rating
  if (shouldStopAssessment(checklist.sectionB)) {
    return true;
  }

  const isPerProtocol = checklist.sectionC?.isPerProtocol || false;
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  // All active domains must have judgements
  const domainsComplete = activeDomains.every(domainKey => {
    const domain = checklist[domainKey];
    return domain?.judgement !== null && domain?.judgement !== undefined;
  });

  // Overall judgement must be set (either auto-calculated or manually selected)
  const overallComplete =
    checklist.overall?.judgement !== null && checklist.overall?.judgement !== undefined;

  return domainsComplete && overallComplete;
}
