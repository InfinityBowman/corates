/**
 * ROBINS-I Checklist comparison utilities for reconciliation workflow
 * Compares two reviewer checklists and helps create a finalized consensus version
 */

import { ROBINS_I_CHECKLIST, getDomainQuestions, getActiveDomainKeys } from './checklist-map';
import type {
  ROBINSIChecklist,
  ROBINSIDomainState,
  ROBINSIQuestionAnswer,
} from '@corates/shared/checklists';

type ROBINSQuestion = ReturnType<typeof getDomainQuestions>[string];

type PartialChecklist = Partial<ROBINSIChecklist>;

interface QuestionComparison {
  key: string;
  questionDef?: ROBINSQuestion;
  reviewer1: { answer?: string | null; comment?: string };
  reviewer2: { answer?: string | null; comment?: string };
  isAgreement: boolean;
}

interface SectionBComparison {
  agreements: QuestionComparison[];
  disagreements: QuestionComparison[];
}

interface DomainComparison {
  questions: {
    agreements: QuestionComparison[];
    disagreements: QuestionComparison[];
  };
  judgementMatch: boolean;
  directionMatch: boolean;
  reviewer1: {
    judgement?: string | null;
    direction?: string | null;
  };
  reviewer2: {
    judgement?: string | null;
    direction?: string | null;
  };
}

interface OverallComparison {
  judgementMatch: boolean;
  directionMatch: boolean;
  reviewer1?: { judgement?: string | null; direction?: string | null };
  reviewer2?: { judgement?: string | null; direction?: string | null };
}

interface ComparisonStats {
  total: number;
  agreed: number;
  disagreed: number;
  agreementRate?: number;
}

export interface ComparisonResult {
  sectionB: SectionBComparison;
  domains: Record<string, DomainComparison>;
  overall: OverallComparison;
  stats: ComparisonStats;
}

/**
 * Get all section B question keys
 */
export function getSectionBKeys(): string[] {
  return Object.keys(ROBINS_I_CHECKLIST.sectionB);
}

/**
 * Get domain keys for comparison (uses ITT variant for domain 1 by default)
 */
export function getDomainKeysForComparison(isPerProtocol: boolean = false): string[] {
  return getActiveDomainKeys(isPerProtocol);
}

/**
 * Compare the answers of two checklists and identify differences
 */
export function compareChecklists(
  checklist1: PartialChecklist | null,
  checklist2: PartialChecklist | null,
): ComparisonResult {
  if (!checklist1 || !checklist2) {
    return {
      sectionB: { agreements: [], disagreements: [] },
      domains: {},
      overall: { judgementMatch: false, directionMatch: false },
      stats: { total: 0, agreed: 0, disagreed: 0 },
    };
  }

  const isPerProtocol = checklist1.sectionC?.isPerProtocol || false;

  const result: ComparisonResult = {
    sectionB: compareSectionB(checklist1.sectionB, checklist2.sectionB),
    domains: {},
    overall: compareOverall(checklist1.overall, checklist2.overall),
    stats: { total: 0, agreed: 0, disagreed: 0 },
  };

  // Compare each active domain
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  for (const domainKey of activeDomains) {
    result.domains[domainKey] = compareDomain(
      domainKey,
      checklist1[domainKey],
      checklist2[domainKey],
    );
  }

  // Calculate overall stats
  let totalQuestions = 0;
  let agreements = 0;

  // Section B stats
  totalQuestions += result.sectionB.agreements.length + result.sectionB.disagreements.length;
  agreements += result.sectionB.agreements.length;

  // Domain stats
  Object.values(result.domains).forEach(domain => {
    totalQuestions += domain.questions.agreements.length + domain.questions.disagreements.length;
    agreements += domain.questions.agreements.length;

    // Count judgement agreement
    if (domain.judgementMatch) {
      totalQuestions += 1;
      agreements += 1;
    } else if (domain.reviewer1?.judgement || domain.reviewer2?.judgement) {
      totalQuestions += 1;
    }
  });

  result.stats = {
    total: totalQuestions,
    agreed: agreements,
    disagreed: totalQuestions - agreements,
    agreementRate: totalQuestions > 0 ? agreements / totalQuestions : 0,
  };

  return result;
}

/**
 * Compare Section B answers
 */
function compareSectionB(
  sectionB1: ROBINSIChecklist['sectionB'] | undefined,
  sectionB2: ROBINSIChecklist['sectionB'] | undefined,
): SectionBComparison {
  const keys = getSectionBKeys();
  const agreementList: QuestionComparison[] = [];
  const disagreementList: QuestionComparison[] = [];

  for (const key of keys) {
    const qa1 = sectionB1?.[key as keyof typeof sectionB1] as ROBINSIQuestionAnswer | undefined;
    const qa2 = sectionB2?.[key as keyof typeof sectionB2] as ROBINSIQuestionAnswer | undefined;
    const ans1 = qa1?.answer;
    const ans2 = qa2?.answer;

    const comparison: Omit<QuestionComparison, 'isAgreement'> = {
      key,
      reviewer1: { answer: ans1, comment: qa1?.comment || '' },
      reviewer2: { answer: ans2, comment: qa2?.comment || '' },
    };

    if (ans1 === ans2) {
      agreementList.push({ ...comparison, isAgreement: true });
    } else {
      disagreementList.push({ ...comparison, isAgreement: false });
    }
  }

  return { agreements: agreementList, disagreements: disagreementList };
}

/**
 * Compare a domain between two checklists
 */
function compareDomain(
  domainKey: string,
  domain1: ROBINSIDomainState | undefined,
  domain2: ROBINSIDomainState | undefined,
): DomainComparison {
  const questions = getDomainQuestions(domainKey);
  const questionKeys = Object.keys(questions);

  const agreementList: QuestionComparison[] = [];
  const disagreementList: QuestionComparison[] = [];

  for (const qKey of questionKeys) {
    const ans1 = domain1?.answers?.[qKey]?.answer;
    const ans2 = domain2?.answers?.[qKey]?.answer;

    const comparison: Omit<QuestionComparison, 'isAgreement'> = {
      key: qKey,
      questionDef: questions[qKey],
      reviewer1: {
        answer: ans1,
        comment: domain1?.answers?.[qKey]?.comment || '',
      },
      reviewer2: {
        answer: ans2,
        comment: domain2?.answers?.[qKey]?.comment || '',
      },
    };

    if (ans1 === ans2) {
      agreementList.push({ ...comparison, isAgreement: true });
    } else {
      disagreementList.push({ ...comparison, isAgreement: false });
    }
  }

  const judgementMatch = domain1?.judgement === domain2?.judgement;
  const directionMatch = domain1?.direction === domain2?.direction;

  return {
    questions: { agreements: agreementList, disagreements: disagreementList },
    judgementMatch,
    directionMatch,
    reviewer1: {
      judgement: domain1?.judgement,
      direction: domain1?.direction,
    },
    reviewer2: {
      judgement: domain2?.judgement,
      direction: domain2?.direction,
    },
  };
}

/**
 * Compare overall judgements
 */
function compareOverall(
  overall1: ROBINSIChecklist['overall'] | undefined,
  overall2: ROBINSIChecklist['overall'] | undefined,
): OverallComparison {
  return {
    judgementMatch: overall1?.judgement === overall2?.judgement,
    directionMatch: overall1?.direction === overall2?.direction,
    reviewer1: overall1,
    reviewer2: overall2,
  };
}
