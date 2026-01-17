/**
 * ROB-2 Checklist Comparison
 *
 * Utilities for comparing two reviewer checklists and creating reconciled versions.
 */

import {
  ROB2_CHECKLIST,
  PRELIMINARY_SECTION,
  getActiveDomainKeys,
  getDomainQuestions as getDomainQuestionsFromSchema,
  type DomainKey,
  type ROB2Domain,
} from './schema.js';
import {
  scoreRob2Domain,
  scoreAllDomains,
  type ChecklistState,
  type DomainState,
} from './scoring.js';
import type { ROB2Checklist } from './create.js';

// Re-export ROB2Checklist for convenience (it's defined in create.ts)
export type { ROB2Checklist };

// ============================================================================
// Types
// ============================================================================

export interface QuestionComparison {
  key: string;
  isAgreement: boolean;
  reviewer1: {
    answer: string | null;
    comment?: string;
  };
  reviewer2: {
    answer: string | null;
    comment?: string;
  };
}

export interface DomainComparison {
  questions: {
    agreements: QuestionComparison[];
    disagreements: QuestionComparison[];
  };
  judgement1: string | null;
  judgement2: string | null;
  judgementMatch: boolean;
  direction1: string | null;
  direction2: string | null;
  directionMatch: boolean;
}

export interface PreliminaryFieldComparison {
  key: string;
  isAgreement: boolean;
  reviewer1Value: unknown;
  reviewer2Value: unknown;
}

export interface PreliminaryComparison {
  fields: PreliminaryFieldComparison[];
  aimMismatch: boolean;
  aim1: string | null;
  aim2: string | null;
}

export interface OverallComparison {
  judgement1: string | null;
  judgement2: string | null;
  judgementMatch: boolean;
  direction1: string | null;
  direction2: string | null;
  directionMatch: boolean;
}

export interface ComparisonStats {
  total: number;
  agreed: number;
  disagreed: number;
  agreementRate: number;
}

export interface ComparisonResult {
  preliminary: PreliminaryComparison;
  domains: Record<string, DomainComparison>;
  overall: OverallComparison;
  stats: ComparisonStats;
}

// Use a looser checklist type for comparison since reconciled checklists may have partial data
interface PartialROB2Checklist {
  id?: string;
  name?: string;
  reviewerName?: string;
  createdAt?: string;
  preliminary?: {
    studyDesign?: string | null;
    experimental?: string;
    comparator?: string;
    numericalResult?: string;
    aim?: string | null;
    deviationsToAddress?: string[];
    sources?: Record<string, boolean>;
  };
  domain1?: DomainState;
  domain2a?: DomainState;
  domain2b?: DomainState;
  domain3?: DomainState;
  domain4?: DomainState;
  domain5?: DomainState;
  overall?: {
    judgement?: string | null;
    direction?: string | null;
  };
  [key: string]: unknown;
}

// ============================================================================
// Preliminary Section Comparison
// ============================================================================

const PRELIMINARY_FIELD_KEYS = [
  'studyDesign',
  'experimental',
  'comparator',
  'numericalResult',
  'aim',
  'deviationsToAddress',
  'sources',
] as const;

/**
 * Compare preliminary sections of two checklists
 */
function comparePreliminary(
  prelim1: PartialROB2Checklist['preliminary'],
  prelim2: PartialROB2Checklist['preliminary'],
): PreliminaryComparison {
  const fields: PreliminaryFieldComparison[] = [];

  for (const key of PRELIMINARY_FIELD_KEYS) {
    const value1 = prelim1?.[key];
    const value2 = prelim2?.[key];

    let isAgreement: boolean;

    if (key === 'deviationsToAddress') {
      // Compare arrays
      const arr1 = (value1 as string[] | undefined) || [];
      const arr2 = (value2 as string[] | undefined) || [];
      isAgreement = arr1.length === arr2.length && arr1.every((v, i) => v === arr2[i]);
    } else if (key === 'sources') {
      // Compare objects
      const obj1 = (value1 as Record<string, boolean> | undefined) || {};
      const obj2 = (value2 as Record<string, boolean> | undefined) || {};
      const keys1 = Object.keys(obj1).filter(k => obj1[k]);
      const keys2 = Object.keys(obj2).filter(k => obj2[k]);
      isAgreement = keys1.length === keys2.length && keys1.every(k => keys2.includes(k));
    } else {
      // Compare primitives (strings)
      isAgreement = value1 === value2;
    }

    fields.push({
      key,
      isAgreement,
      reviewer1Value: value1,
      reviewer2Value: value2,
    });
  }

  const aim1 = (prelim1?.aim as string) || null;
  const aim2 = (prelim2?.aim as string) || null;
  const aimMismatch = aim1 !== aim2 && aim1 !== null && aim2 !== null;

  return {
    fields,
    aimMismatch,
    aim1,
    aim2,
  };
}

// ============================================================================
// Domain Comparison
// ============================================================================

/**
 * Compare a domain between two checklists
 */
function compareDomain(
  domainKey: DomainKey,
  domain1: DomainState | undefined,
  domain2: DomainState | undefined,
): DomainComparison {
  const domainDef = ROB2_CHECKLIST[domainKey] as ROB2Domain;
  const questionKeys = Object.keys(domainDef?.questions || {});

  const agreements: QuestionComparison[] = [];
  const disagreements: QuestionComparison[] = [];

  for (const qKey of questionKeys) {
    const ans1 = domain1?.answers?.[qKey]?.answer ?? null;
    const ans2 = domain2?.answers?.[qKey]?.answer ?? null;

    const comparison: QuestionComparison = {
      key: qKey,
      isAgreement: ans1 === ans2,
      reviewer1: {
        answer: ans1,
        comment: domain1?.answers?.[qKey]?.comment || '',
      },
      reviewer2: {
        answer: ans2,
        comment: domain2?.answers?.[qKey]?.comment || '',
      },
    };

    if (comparison.isAgreement) {
      agreements.push(comparison);
    } else {
      disagreements.push(comparison);
    }
  }

  // Get auto-calculated judgements
  const scoring1 = scoreRob2Domain(domainKey, domain1?.answers);
  const scoring2 = scoreRob2Domain(domainKey, domain2?.answers);

  const judgement1 = scoring1.judgement;
  const judgement2 = scoring2.judgement;

  const direction1 = domain1?.direction ?? null;
  const direction2 = domain2?.direction ?? null;

  return {
    questions: { agreements, disagreements },
    judgement1,
    judgement2,
    judgementMatch: judgement1 === judgement2,
    direction1,
    direction2,
    directionMatch: direction1 === direction2,
  };
}

/**
 * Compare overall judgement between two checklists
 */
function compareOverall(
  checklist1: PartialROB2Checklist,
  checklist2: PartialROB2Checklist,
): OverallComparison {
  // Get auto-calculated overall judgements
  // Cast to ChecklistState since the structures are compatible for scoring purposes
  const scoring1 = scoreAllDomains(checklist1 as unknown as ChecklistState);
  const scoring2 = scoreAllDomains(checklist2 as unknown as ChecklistState);

  const judgement1 = scoring1.overall;
  const judgement2 = scoring2.overall;

  const direction1 = checklist1.overall?.direction ?? null;
  const direction2 = checklist2.overall?.direction ?? null;

  return {
    judgement1,
    judgement2,
    judgementMatch: judgement1 === judgement2,
    direction1,
    direction2,
    directionMatch: direction1 === direction2,
  };
}

// ============================================================================
// Main Comparison Function
// ============================================================================

/**
 * Compare the answers of two ROB-2 checklists and identify differences
 */
export function compareChecklists(
  checklist1: PartialROB2Checklist | null | undefined,
  checklist2: PartialROB2Checklist | null | undefined,
): ComparisonResult {
  if (!checklist1 || !checklist2) {
    return {
      preliminary: {
        fields: [],
        aimMismatch: false,
        aim1: null,
        aim2: null,
      },
      domains: {},
      overall: {
        judgement1: null,
        judgement2: null,
        judgementMatch: false,
        direction1: null,
        direction2: null,
        directionMatch: false,
      },
      stats: { total: 0, agreed: 0, disagreed: 0, agreementRate: 0 },
    };
  }

  // Compare preliminary section
  const preliminary = comparePreliminary(checklist1.preliminary, checklist2.preliminary);

  // Determine active domains based on reconciled aim (use checklist1's aim as reference)
  const isAdhering = checklist1.preliminary?.aim === 'ADHERING';
  const activeDomains = getActiveDomainKeys(isAdhering);

  // Compare each active domain
  const domains: Record<string, DomainComparison> = {};
  for (const domainKey of activeDomains) {
    domains[domainKey] = compareDomain(
      domainKey,
      checklist1[domainKey] as DomainState,
      checklist2[domainKey] as DomainState,
    );
  }

  // Compare overall
  const overall = compareOverall(checklist1, checklist2);

  // Calculate stats
  let totalItems = preliminary.fields.length;
  let agreedItems = preliminary.fields.filter(f => f.isAgreement).length;

  for (const domainKey of activeDomains) {
    const domain = domains[domainKey];
    totalItems += domain.questions.agreements.length + domain.questions.disagreements.length;
    agreedItems += domain.questions.agreements.length;

    // Count direction as an item
    totalItems += 1;
    if (domain.directionMatch) agreedItems += 1;
  }

  // Count overall direction
  totalItems += 1;
  if (overall.directionMatch) agreedItems += 1;

  return {
    preliminary,
    domains,
    overall,
    stats: {
      total: totalItems,
      agreed: agreedItems,
      disagreed: totalItems - agreedItems,
      agreementRate: totalItems > 0 ? agreedItems / totalItems : 0,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if there is an aim mismatch between two checklists
 */
export function hasAimMismatch(
  checklist1: PartialROB2Checklist | null | undefined,
  checklist2: PartialROB2Checklist | null | undefined,
): boolean {
  const aim1 = checklist1?.preliminary?.aim;
  const aim2 = checklist2?.preliminary?.aim;
  return aim1 !== aim2 && aim1 != null && aim2 != null;
}

/**
 * Get a summary of what needs reconciliation
 */
export function getReconciliationSummary(comparison: ComparisonResult): {
  totalItems: number;
  agreementCount: number;
  disagreementCount: number;
  agreementPercentage: number;
  preliminaryDisagreements: number;
  domainDisagreements: Array<{
    domain: string;
    count: number;
    questions: string[];
  }>;
  directionDisagreements: string[];
  aimMismatch: boolean;
  needsReconciliation: boolean;
} {
  const { preliminary, domains, overall, stats } = comparison;

  const preliminaryDisagreements = preliminary.fields.filter(f => !f.isAgreement).length;

  const domainDisagreements: Array<{
    domain: string;
    count: number;
    questions: string[];
  }> = [];
  const directionDisagreements: string[] = [];

  for (const [domainKey, domain] of Object.entries(domains)) {
    if (domain.questions.disagreements.length > 0) {
      domainDisagreements.push({
        domain: domainKey,
        count: domain.questions.disagreements.length,
        questions: domain.questions.disagreements.map(d => d.key),
      });
    }
    if (!domain.directionMatch) {
      directionDisagreements.push(domainKey);
    }
  }

  if (!overall.directionMatch) {
    directionDisagreements.push('overall');
  }

  return {
    totalItems: stats.total,
    agreementCount: stats.agreed,
    disagreementCount: stats.disagreed,
    agreementPercentage: Math.round(stats.agreementRate * 100),
    preliminaryDisagreements,
    domainDisagreements,
    directionDisagreements,
    aimMismatch: preliminary.aimMismatch,
    needsReconciliation: stats.disagreed > 0 || preliminary.aimMismatch,
  };
}

/**
 * Get the domain definition from the schema
 */
export function getDomainDef(domainKey: string): ROB2Domain | undefined {
  return ROB2_CHECKLIST[domainKey as keyof typeof ROB2_CHECKLIST] as ROB2Domain | undefined;
}

/**
 * Get the domain name/title
 */
export function getDomainName(domainKey: string): string {
  const domain = getDomainDef(domainKey);
  return domain?.name || domainKey;
}

/**
 * Get questions for a domain (re-exported from schema)
 */
export { getDomainQuestionsFromSchema as getComparisonDomainQuestions };

/**
 * Get a preliminary field definition
 */
export function getPreliminaryFieldDef(
  fieldKey: string,
): (typeof PRELIMINARY_SECTION)[keyof typeof PRELIMINARY_SECTION] | undefined {
  return PRELIMINARY_SECTION[fieldKey as keyof typeof PRELIMINARY_SECTION];
}
