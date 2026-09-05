/**
 * Completion-time NA stamping
 *
 * Marking a ROB-2 or ROBINS-I checklist complete, or finalizing a
 * reconciliation, writes the official 'NA' response into off-path questions
 * whose scale offers it. The rest stay null and read as skipped by derivation.
 *
 * Stamping at completion rather than live during editing means a changing
 * upstream answer never leaves stale NA values behind.
 */

import {
  getActiveDomainKeys as rob2GetActiveDomainKeys,
  getDomainQuestions as rob2GetDomainQuestions,
  getSkippedDomainQuestions as rob2GetSkippedDomainQuestions,
  questionHasNaOption as rob2QuestionHasNaOption,
  type DomainAnswers as Rob2DomainAnswers,
} from '@corates/shared/checklists/rob2';
import {
  getActiveDomainKeys as robinsGetActiveDomainKeys,
  getDomainQuestions as robinsGetDomainQuestions,
  getSkippedDomainQuestions as robinsGetSkippedDomainQuestions,
  isSectionBCritical,
  questionHasNaOption as robinsQuestionHasNaOption,
  type DomainAnswers as RobinsDomainAnswers,
} from '@corates/shared/checklists/robins-i';

export interface NaStamp {
  domainKey: string;
  questionKey: string;
}

type AnswerGetter = (flatKey: string) => unknown;

function buildDomainAnswers(
  questionKeys: string[],
  getValue: AnswerGetter,
): Rob2DomainAnswers | RobinsDomainAnswers {
  const answers: Rob2DomainAnswers = {};
  for (const qKey of questionKeys) {
    answers[qKey] = { answer: (getValue(qKey) as string | null) ?? null };
  }
  return answers;
}

function getRob2Stamps(getValue: AnswerGetter): NaStamp[] {
  const stamps: NaStamp[] = [];
  const isAdhering = getValue('preliminary.aim') === 'ADHERING';

  for (const domainKey of rob2GetActiveDomainKeys(isAdhering)) {
    const questionKeys = Object.keys(rob2GetDomainQuestions(domainKey));
    const answers = buildDomainAnswers(questionKeys, getValue);
    for (const questionKey of rob2GetSkippedDomainQuestions(domainKey, answers)) {
      if (rob2QuestionHasNaOption(domainKey, questionKey)) {
        stamps.push({ domainKey, questionKey });
      }
    }
  }
  return stamps;
}

function getRobinsIStamps(getValue: AnswerGetter): NaStamp[] {
  // A Critical rating in Section B ends the assessment before the domain
  // questions; they stay untouched rather than being stamped NA.
  const sectionB = {
    b2: { answer: (getValue('sectionB.b2') as string | null) ?? null },
    b3: { answer: (getValue('sectionB.b3') as string | null) ?? null },
  };
  if (isSectionBCritical(sectionB)) return [];

  const stamps: NaStamp[] = [];
  const isPerProtocol = getValue('sectionC.isPerProtocol') === true;

  for (const domainKey of robinsGetActiveDomainKeys(isPerProtocol)) {
    const questionKeys = Object.keys(robinsGetDomainQuestions(domainKey));
    const answers = buildDomainAnswers(questionKeys, getValue);
    for (const questionKey of robinsGetSkippedDomainQuestions(domainKey, answers)) {
      if (robinsQuestionHasNaOption(domainKey, questionKey)) {
        stamps.push({ domainKey, questionKey });
      }
    }
  }
  return stamps;
}

/** Empty for checklist types without conditional NA semantics, such as AMSTAR2. */
export function getCompletionNaStamps(
  checklistType: string | null | undefined,
  getValue: AnswerGetter,
): NaStamp[] {
  switch (checklistType) {
    case 'ROB2':
      return getRob2Stamps(getValue);
    case 'ROBINS_I':
      return getRobinsIStamps(getValue);
    default:
      return [];
  }
}
