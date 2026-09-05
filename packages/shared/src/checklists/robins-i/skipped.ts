/**
 * ROBINS-I Skipped Question Derivation
 *
 * A question is skipped when no way of answering the domain's open questions
 * can bring it onto the decision table's path and it has no stored answer. A
 * question further down a branch that is still pending is not skipped. A
 * Critical rating in Section B (B2 or B3 = Y/PY) skips every domain question.
 *
 * Skipped state is derived, never stored. Only the WITH_NA_* scales offer NA,
 * so a null answer plus this derivation is the canonical representation of
 * every other off-path question.
 */

import { RESPONSE_TYPES, getActiveDomainKeys, getDomainQuestions } from './schema.js';
import type { DomainAnswers } from './scoring-helpers.js';
import { scoreRobinsDomain } from './scoring.js';

/**
 * Questions on the active path of a domain's decision table: the ones the
 * scorer consults given the current answers. Derived by recording reads, so
 * the table lives only in the scorers. Defined here rather than in scoring.ts
 * because schema.ts imports scoring.ts.
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
  scoreRobinsDomain(domainKey, tracked);
  return read;
}

/**
 * Questions required now or under any way of answering the open required
 * questions. The complement of getRequiredQuestions mixes questions pruned off
 * the path with questions further down a branch that is still pending; this
 * separates them.
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

/** Only questions whose official scale offers NA may be stamped with a stored 'NA'. */
export function questionHasNaOption(domainKey: string, questionKey: string): boolean {
  const responseType = getDomainQuestions(domainKey)[questionKey]?.responseType;
  if (!responseType) return false;
  return (RESPONSE_TYPES[responseType] as readonly string[]).includes('NA');
}

/** B2 or B3 = Y/PY rates the result Critical and ends the assessment before the domains. */
export function isSectionBCritical(
  sectionB: Record<string, QuestionAnswerState | undefined> | undefined,
): boolean {
  const b2 = sectionB?.b2?.answer;
  const b3 = sectionB?.b3?.answer;
  return b2 === 'Y' || b2 === 'PY' || b3 === 'Y' || b3 === 'PY';
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
