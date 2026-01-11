/**
 * ROB-2 Answer Utilities
 *
 * Functions for getting and manipulating ROB-2 checklist answers.
 */

import type { ROB2Checklist } from './create.js';
import { getActiveDomainKeys, getDomainQuestions } from './schema.js';
import { scoreAllDomains } from './scoring.js';

/**
 * Score the overall checklist based on domain judgements
 */
export function scoreROB2Checklist(state: ROB2Checklist): string {
  if (!state || typeof state !== 'object') return 'Error';

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
  state: ROB2Checklist,
): string | null {
  const domain = state?.[domainKey as keyof ROB2Checklist];
  if (!domain || typeof domain !== 'object') return null;
  const typedDomain = domain as { answers?: Record<string, { answer: string | null }> };
  return typedDomain.answers?.[questionKey]?.answer || null;
}

/**
 * Get all answers in a flat format for export/display
 */
export function getAnswers(checklist: ROB2Checklist): {
  metadata: {
    name: string;
    reviewerName: string;
    createdAt: string;
    id: string;
  };
  preliminary: ROB2Checklist['preliminary'];
  domains: Record<
    string,
    {
      judgement: string | null;
      direction: string | null;
      questions: Record<string, string | null>;
    }
  >;
  overall: ROB2Checklist['overall'];
} | null {
  if (!checklist || typeof checklist !== 'object') return null;

  const result = {
    metadata: {
      name: checklist.name,
      reviewerName: checklist.reviewerName,
      createdAt: checklist.createdAt,
      id: checklist.id,
    },
    preliminary: checklist.preliminary,
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

  // Domains
  const isAdhering = checklist.preliminary?.aim === 'ADHERING';
  const activeDomains = getActiveDomainKeys(isAdhering);

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
export function getDomainSummary(checklist: ROB2Checklist): Record<
  string,
  {
    judgement: string | null;
    direction: string | null;
    complete: boolean;
  }
> | null {
  if (!checklist) return null;

  const isAdhering = checklist.preliminary?.aim === 'ADHERING';
  const activeDomains = getActiveDomainKeys(isAdhering);

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
 * Check if a ROB-2 checklist is complete (all active domains have judgements and overall is set)
 */
export function isROB2Complete(checklist: ROB2Checklist): boolean {
  if (!checklist || typeof checklist !== 'object') return false;

  // Check if aim is selected
  if (!checklist.preliminary?.aim) {
    return false;
  }

  // All active domains must have judgements (from auto-scoring)
  const { isComplete } = scoreAllDomains(
    checklist as unknown as Parameters<typeof scoreAllDomains>[0],
  );

  return isComplete;
}
