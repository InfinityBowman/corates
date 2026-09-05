/**
 * ROB-2 Skipped Question Derivation
 *
 * A question is skipped when no way of answering the domain's open questions
 * can bring it onto the scoring path and it has no stored answer. A question
 * further down a branch that is still pending is not skipped.
 *
 * Skipped state is derived, never stored. The official scales only offer NA
 * on the conditional (WITH_NA) questions, so a null answer plus this
 * derivation is the canonical representation of an off-path STANDARD question.
 */

import { getActiveDomainKeys, getDomainQuestions } from './schema.js';
import type { ChecklistState, DomainAnswers, DomainState } from './scoring-helpers.js';
import { getReachableQuestions } from './scoring.js';

/** Only questions whose official scale offers NA may be stamped with a stored 'NA'. */
export function questionHasNaOption(domainKey: string, questionKey: string): boolean {
  return getDomainQuestions(domainKey)[questionKey]?.responseType === 'WITH_NA';
}

export function getSkippedDomainQuestions(
  domainKey: string,
  answers: DomainAnswers | undefined,
): Set<string> {
  const skipped = new Set<string>();
  if (!answers) return skipped;

  const reachable = getReachableQuestions(domainKey, answers);
  for (const qKey of Object.keys(getDomainQuestions(domainKey))) {
    if (!reachable.has(qKey) && answers[qKey]?.answer == null) {
      skipped.add(qKey);
    }
  }
  return skipped;
}

/** Active domains only. Question keys are unique across domains, so a flat set is safe. */
export function getSkippedQuestions(checklist: ChecklistState | null): Set<string> {
  const skipped = new Set<string>();
  if (!checklist) return skipped;

  const isAdhering = checklist.preliminary?.aim === 'ADHERING';
  for (const domainKey of getActiveDomainKeys(isAdhering)) {
    const domain = checklist[domainKey] as DomainState | undefined;
    for (const qKey of getSkippedDomainQuestions(domainKey, domain?.answers)) {
      skipped.add(qKey);
    }
  }
  return skipped;
}

/**
 * An explicit NA and a derived skip both mean "not applicable", so a reviewer
 * who clicked NA agrees with one who left the question off-path.
 */
export function isEffectivelyNotApplicable(
  questionKey: string,
  answer: string | null | undefined,
  skippedQuestions: Set<string>,
): boolean {
  if (answer === 'NA') return true;
  return answer == null && skippedQuestions.has(questionKey);
}
