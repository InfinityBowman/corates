/**
 * ROB-2 Skipped Question Derivation
 *
 * A question counts as "skipped" when no way of answering the domain's open
 * questions can bring it onto the scoring path, and it has no stored answer.
 * A question further down a branch that is still pending is not skipped.
 *
 * Skipped state is derived, never stored. The official RoB 2 response scales
 * only include NA for the conditional signalling questions (responseType
 * WITH_NA); off-path STANDARD questions have no NA option in the instrument,
 * so a null answer plus this derivation is their canonical representation.
 */

import { getActiveDomainKeys, getDomainQuestions } from './schema.js';
import type { ChecklistState, DomainAnswers, DomainState } from './scoring-helpers.js';
import { getReachableQuestions } from './scoring.js';

/**
 * Whether the official instrument offers NA as a response for this question.
 * Only these questions may be stamped with a stored 'NA' answer.
 */
export function questionHasNaOption(domainKey: string, questionKey: string): boolean {
  return getDomainQuestions(domainKey)[questionKey]?.responseType === 'WITH_NA';
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

  const reachable = getReachableQuestions(domainKey, answers);
  for (const qKey of Object.keys(getDomainQuestions(domainKey))) {
    if (!reachable.has(qKey) && answers[qKey]?.answer == null) {
      skipped.add(qKey);
    }
  }
  return skipped;
}

/**
 * Derive all skipped questions of a checklist (active domains only).
 * Question keys are unique across domains, so a flat set is safe.
 */
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
