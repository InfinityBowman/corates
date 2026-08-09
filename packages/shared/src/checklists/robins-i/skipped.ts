/**
 * ROBINS-I Skipped Question Derivation
 *
 * ROBINS-I has no explicit required-question tree; the completion UI lets
 * reviewers stop answering a domain once its judgement is determined by the
 * decision table ("early complete"), and skips all domain questions when
 * Section B rates the result Critical (B2 or B3 = Y/PY). This module mirrors
 * those rules so reading surfaces (reconciliation, summaries) can distinguish
 * a legitimately skipped question from an unanswered one.
 *
 * Skipped state is derived, never stored. Only questions whose official
 * response scale includes NA (the WITH_NA_* response types) may carry a
 * stored 'NA' answer.
 */

import { RESPONSE_TYPES, getActiveDomainKeys, getDomainQuestions } from './schema.js';
import type { DomainAnswers } from './scoring-helpers.js';
import { scoreRobinsDomain } from './scoring.js';

interface QuestionAnswerState {
  answer?: string | null;
}

interface ChecklistState {
  sectionB?: Record<string, QuestionAnswerState | undefined>;
  sectionC?: { isPerProtocol?: boolean };
  [domainKey: string]: unknown;
}

interface DomainState {
  answers?: DomainAnswers;
}

/**
 * Whether the official instrument offers NA as a response for this question.
 * Only these questions may be stamped with a stored 'NA' answer.
 */
export function questionHasNaOption(domainKey: string, questionKey: string): boolean {
  const responseType = getDomainQuestions(domainKey)[questionKey]?.responseType;
  if (!responseType) return false;
  return (RESPONSE_TYPES[responseType] as readonly string[]).includes('NA');
}

/**
 * Whether Section B rates the result Critical (B2 or B3 = Y/PY), which ends
 * the assessment before the domain questions.
 */
export function isSectionBCritical(
  sectionB: Record<string, QuestionAnswerState | undefined> | undefined,
): boolean {
  const b2 = sectionB?.b2?.answer;
  const b3 = sectionB?.b3?.answer;
  return b2 === 'Y' || b2 === 'PY' || b3 === 'Y' || b3 === 'PY';
}

/**
 * Derive the skipped questions of one domain from its stored answers.
 */
export function getSkippedDomainQuestions(
  domainKey: string,
  answers: DomainAnswers | undefined,
): Set<string> {
  const skipped = new Set<string>();
  if (!answers) return skipped;

  const scoring = scoreRobinsDomain(domainKey, answers);
  if (!scoring.isComplete || scoring.judgement === null) return skipped;

  for (const qKey of Object.keys(getDomainQuestions(domainKey))) {
    if (answers[qKey]?.answer == null) {
      skipped.add(qKey);
    }
  }
  return skipped;
}

/**
 * Derive all skipped questions of a checklist (active domains only).
 * When Section B is Critical every unanswered domain question is skipped;
 * otherwise each domain contributes its early-complete skips.
 * Question keys are unique across domains, so a flat set is safe.
 */
export function getSkippedQuestions(checklist: ChecklistState | null): Set<string> {
  const skipped = new Set<string>();
  if (!checklist) return skipped;

  const isPerProtocol = checklist.sectionC?.isPerProtocol || false;
  const activeDomains = getActiveDomainKeys(isPerProtocol);
  const sectionBCritical = isSectionBCritical(checklist.sectionB);

  for (const domainKey of activeDomains) {
    const domain = checklist[domainKey] as DomainState | undefined;
    if (sectionBCritical) {
      for (const qKey of Object.keys(getDomainQuestions(domainKey))) {
        if (domain?.answers?.[qKey]?.answer == null) {
          skipped.add(qKey);
        }
      }
    } else {
      for (const qKey of getSkippedDomainQuestions(domainKey, domain?.answers)) {
        skipped.add(qKey);
      }
    }
  }
  return skipped;
}

/**
 * Whether a question's stored state means "not applicable" for comparison
 * purposes: an explicit NA answer, or a derived skip. Two reviewers where one
 * clicked NA and the other left the question off-path are in agreement.
 */
export function isEffectivelyNotApplicable(
  questionKey: string,
  answer: string | null | undefined,
  skippedQuestions: Set<string>,
): boolean {
  if (answer === 'NA') return true;
  return answer == null && skippedQuestions.has(questionKey);
}
