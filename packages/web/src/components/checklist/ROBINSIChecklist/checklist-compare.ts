/**
 * ROBINS-I Checklist comparison utilities for reconciliation workflow
 * Compares two reviewer checklists and helps create a finalized consensus version
 */

import { ROBINS_I_CHECKLIST, getDomainQuestions, getActiveDomainKeys } from './checklist-map';
import { CHECKLIST_TYPES } from '@/checklist-registry/types';

type ROBINSQuestion = ReturnType<typeof getDomainQuestions>[string];

/**
 * Deep clone a plain object/array via JSON serialization
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

interface QuestionAnswer {
  answer?: string | null;
  comment?: string;
}

interface DomainData {
  answers?: Record<string, QuestionAnswer>;
  judgement?: string;
  direction?: string;
}

interface OverallData {
  judgement?: string;
  direction?: string;
}

interface SectionBData {
  [key: string]: QuestionAnswer;
}

interface ChecklistData {
  id?: string;
  name?: string;
  reviewerName?: string;
  createdAt?: string;
  checklistType?: string;
  sectionC?: { isPerProtocol?: boolean; [key: string]: unknown };
  sectionA?: Record<string, unknown>;
  sectionB?: SectionBData;
  sectionD?: Record<string, unknown>;
  planning?: Record<string, unknown>;
  confoundingEvaluation?: Record<string, unknown>;
  overall?: OverallData;
  [key: string]: unknown;
}

interface QuestionComparison {
  key: string;
  questionDef?: ROBINSQuestion;
  reviewer1: QuestionAnswer;
  reviewer2: QuestionAnswer;
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
    judgement?: string;
    direction?: string;
  };
  reviewer2: {
    judgement?: string;
    direction?: string;
  };
}

interface OverallComparison {
  judgementMatch: boolean;
  directionMatch: boolean;
  reviewer1?: OverallData;
  reviewer2?: OverallData;
}

interface ComparisonStats {
  total: number;
  agreed: number;
  disagreed: number;
  agreementRate?: number;
}

interface ComparisonResult {
  sectionB: SectionBComparison;
  domains: Record<string, DomainComparison>;
  overall: OverallComparison;
  stats: ComparisonStats;
}

interface ReconciliationSelections {
  sectionB?: Record<string, string | QuestionAnswer>;
  overall?: {
    judgement?: string;
    direction?: string;
  };
  [domainKey: string]:
    | Record<string, string | QuestionAnswer>
    | {
        answers?: Record<string, string | QuestionAnswer>;
        judgement?: string;
        direction?: string;
      }
    | undefined;
}

interface ReconciliationMetadata {
  name?: string;
  reviewerName?: string;
  createdAt?: string;
  id?: string;
}

export interface ReconciliationSummary {
  totalQuestions: number;
  agreementCount: number;
  disagreementCount: number;
  agreementPercentage: number;
  sectionBDisagreements: number;
  domainDisagreements: Array<{
    domain: string;
    count: number;
    questions: string[];
  }>;
  judgementDisagreements: string[];
  overallDisagreement: boolean;
  needsReconciliation: boolean;
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
  checklist1: ChecklistData | null,
  checklist2: ChecklistData | null,
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
    overall: compareOverall(
      checklist1.overall as OverallData | undefined,
      checklist2.overall as OverallData | undefined,
    ),
    stats: { total: 0, agreed: 0, disagreed: 0 },
  };

  // Compare each active domain
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  for (const domainKey of activeDomains) {
    result.domains[domainKey] = compareDomain(
      domainKey,
      checklist1[domainKey] as DomainData | undefined,
      checklist2[domainKey] as DomainData | undefined,
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
  sectionB1: SectionBData | undefined,
  sectionB2: SectionBData | undefined,
): SectionBComparison {
  const keys = getSectionBKeys();
  const agreements: QuestionComparison[] = [];
  const disagreements: QuestionComparison[] = [];

  for (const key of keys) {
    const ans1 = sectionB1?.[key]?.answer;
    const ans2 = sectionB2?.[key]?.answer;

    const comparison: Omit<QuestionComparison, 'isAgreement'> = {
      key,
      reviewer1: { answer: ans1, comment: sectionB1?.[key]?.comment || '' },
      reviewer2: { answer: ans2, comment: sectionB2?.[key]?.comment || '' },
    };

    if (ans1 === ans2) {
      agreements.push({ ...comparison, isAgreement: true });
    } else {
      disagreements.push({ ...comparison, isAgreement: false });
    }
  }

  return { agreements, disagreements };
}

/**
 * Compare a domain between two checklists
 */
export function compareDomain(
  domainKey: string,
  domain1: DomainData | undefined,
  domain2: DomainData | undefined,
): DomainComparison {
  const questions = getDomainQuestions(domainKey);
  const questionKeys = Object.keys(questions);

  const agreements: QuestionComparison[] = [];
  const disagreements: QuestionComparison[] = [];

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
      agreements.push({ ...comparison, isAgreement: true });
    } else {
      disagreements.push({ ...comparison, isAgreement: false });
    }
  }

  // Compare domain-level judgement
  const judgementMatch = domain1?.judgement === domain2?.judgement;
  const directionMatch = domain1?.direction === domain2?.direction;

  return {
    questions: { agreements, disagreements },
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
  overall1: OverallData | undefined,
  overall2: OverallData | undefined,
): OverallComparison {
  return {
    judgementMatch: overall1?.judgement === overall2?.judgement,
    directionMatch: overall1?.direction === overall2?.direction,
    reviewer1: overall1,
    reviewer2: overall2,
  };
}

/**
 * Create a merged/reconciled checklist from two source checklists
 */
export function createReconciledChecklist(
  checklist1: ChecklistData,
  checklist2: ChecklistData,
  selections: ReconciliationSelections,
  metadata: ReconciliationMetadata = {},
): Record<string, unknown> {
  const isPerProtocol = checklist1.sectionC?.isPerProtocol || false;

  const reconciled: Record<string, unknown> = {
    name: metadata.name || 'Reconciled Checklist',
    reviewerName: metadata.reviewerName || 'Consensus',
    createdAt: metadata.createdAt || new Date().toISOString().split('T')[0],
    id: metadata.id || `reconciled-${Date.now()}`,
    checklistType: CHECKLIST_TYPES.ROBINS_I,
    sourceChecklists: [checklist1.id, checklist2.id],

    // Copy structural elements from checklist1
    planning: deepClone(checklist1.planning || {}),
    sectionA: deepClone(checklist1.sectionA || {}),
    sectionC: deepClone(checklist1.sectionC || {}),
    sectionD: deepClone(checklist1.sectionD || {}),
    confoundingEvaluation: deepClone(checklist1.confoundingEvaluation || {}),
  };

  // Reconcile Section B
  reconciled.sectionB = reconcileSection(
    checklist1.sectionB,
    checklist2.sectionB,
    (selections.sectionB || {}) as Record<string, string | QuestionAnswer>,
    getSectionBKeys(),
  );

  // Reconcile domains
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  for (const domainKey of activeDomains) {
    reconciled[domainKey] = reconcileDomain(
      domainKey,
      checklist1[domainKey] as DomainData | undefined,
      checklist2[domainKey] as DomainData | undefined,
      (selections[domainKey] || {}) as {
        answers?: Record<string, string | QuestionAnswer>;
        judgement?: string;
        direction?: string;
      },
    );
  }

  // Copy inactive domain from checklist1 (for completeness)
  const inactiveDomain = isPerProtocol ? 'domain1a' : 'domain1b';
  reconciled[inactiveDomain] = deepClone(checklist1[inactiveDomain] || {});

  // Reconcile overall
  reconciled.overall = reconcileOverall(
    checklist1.overall,
    checklist2.overall,
    selections.overall || {},
  );

  return reconciled;
}

/**
 * Reconcile a section with question answers
 */
function reconcileSection(
  section1: SectionBData | undefined,
  section2: SectionBData | undefined,
  selections: Record<string, string | QuestionAnswer>,
  keys: string[],
): SectionBData {
  const reconciled: SectionBData = {};

  for (const key of keys) {
    const selection = selections[key];

    if (!selection || selection === 'reviewer1') {
      reconciled[key] = JSON.parse(
        JSON.stringify(section1?.[key] || { answer: null, comment: '' }),
      );
    } else if (selection === 'reviewer2') {
      reconciled[key] = JSON.parse(
        JSON.stringify(section2?.[key] || { answer: null, comment: '' }),
      );
    } else if (typeof selection === 'object') {
      reconciled[key] = JSON.parse(JSON.stringify(selection));
    }
  }

  return reconciled;
}

/**
 * Reconcile a domain
 */
function reconcileDomain(
  domainKey: string,
  domain1: DomainData | undefined,
  domain2: DomainData | undefined,
  selections: {
    answers?: Record<string, string | QuestionAnswer>;
    judgement?: string;
    direction?: string;
  },
): DomainData {
  const questions = getDomainQuestions(domainKey);
  const questionKeys = Object.keys(questions);

  const reconciledAnswers: Record<string, QuestionAnswer> = {};

  for (const qKey of questionKeys) {
    const selection = selections.answers?.[qKey];

    if (!selection || selection === 'reviewer1') {
      reconciledAnswers[qKey] = deepClone(
        domain1?.answers?.[qKey] || { answer: null, comment: '' },
      );
    } else if (selection === 'reviewer2') {
      reconciledAnswers[qKey] = deepClone(
        domain2?.answers?.[qKey] || { answer: null, comment: '' },
      );
    } else if (typeof selection === 'object') {
      reconciledAnswers[qKey] = deepClone(selection);
    }
  }

  // Handle judgement selection
  let judgement: string | undefined;
  if (!selections.judgement || selections.judgement === 'reviewer1') {
    judgement = domain1?.judgement;
  } else if (selections.judgement === 'reviewer2') {
    judgement = domain2?.judgement;
  } else {
    judgement = selections.judgement;
  }

  // Handle direction selection
  let direction: string | undefined;
  if (!selections.direction || selections.direction === 'reviewer1') {
    direction = domain1?.direction;
  } else if (selections.direction === 'reviewer2') {
    direction = domain2?.direction;
  } else {
    direction = selections.direction;
  }

  return {
    answers: reconciledAnswers,
    judgement,
    direction,
  };
}

/**
 * Reconcile overall judgement
 */
function reconcileOverall(
  overall1: OverallData | undefined,
  overall2: OverallData | undefined,
  selections: { judgement?: string; direction?: string },
): OverallData {
  let judgement: string | undefined;
  if (!selections.judgement || selections.judgement === 'reviewer1') {
    judgement = overall1?.judgement;
  } else if (selections.judgement === 'reviewer2') {
    judgement = overall2?.judgement;
  } else {
    judgement = selections.judgement;
  }

  let direction: string | undefined;
  if (!selections.direction || selections.direction === 'reviewer1') {
    direction = overall1?.direction;
  } else if (selections.direction === 'reviewer2') {
    direction = overall2?.direction;
  } else {
    direction = selections.direction;
  }

  return { judgement, direction };
}

/**
 * Get a summary of what needs reconciliation
 */
export function getReconciliationSummary(comparison: ComparisonResult): ReconciliationSummary {
  const { stats, sectionB, domains, overall } = comparison;

  const domainDisagreements: Array<{
    domain: string;
    count: number;
    questions: string[];
  }> = [];
  const judgementDisagreements: string[] = [];

  Object.entries(domains).forEach(([domainKey, domain]) => {
    if (domain.questions.disagreements.length > 0) {
      domainDisagreements.push({
        domain: domainKey,
        count: domain.questions.disagreements.length,
        questions: domain.questions.disagreements.map(d => d.key),
      });
    }

    if (!domain.judgementMatch && (domain.reviewer1?.judgement || domain.reviewer2?.judgement)) {
      judgementDisagreements.push(domainKey);
    }
  });

  return {
    totalQuestions: stats.total,
    agreementCount: stats.agreed,
    disagreementCount: stats.disagreed,
    agreementPercentage: Math.round((stats.agreementRate || 0) * 100),
    sectionBDisagreements: sectionB.disagreements.length,
    domainDisagreements,
    judgementDisagreements,
    overallDisagreement: !overall.judgementMatch,
    needsReconciliation: stats.disagreed > 0 || !overall.judgementMatch,
  };
}

/**
 * Get readable question text from domain and question key
 */
export function getQuestionText(domainKey: string, questionKey: string): string {
  const questions = getDomainQuestions(domainKey);
  const q = questions[questionKey];
  return q ? `${q.number}: ${q.text}` : questionKey;
}

/**
 * Get the domain definition
 */
export function getDomainDef(
  domainKey: string,
): (typeof ROBINS_I_CHECKLIST)[keyof typeof ROBINS_I_CHECKLIST] | undefined {
  return ROBINS_I_CHECKLIST[domainKey as keyof typeof ROBINS_I_CHECKLIST];
}

/**
 * Get the domain name/title
 */
export function getDomainName(domainKey: string): string {
  return (
    (ROBINS_I_CHECKLIST[domainKey as keyof typeof ROBINS_I_CHECKLIST] as { name?: string })?.name ||
    domainKey
  );
}
