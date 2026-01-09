/**
 * AMSTAR2 Checklist Comparison
 *
 * Utilities for comparing two reviewer checklists and creating reconciled versions.
 */

import type { AMSTAR2Checklist, AMSTAR2Question } from '../types.js';
import { AMSTAR_CHECKLIST, AMSTAR2_QUESTION_KEYS } from './schema.js';
import { getFinalAnswer, answersMatch } from './answers.js';

interface QuestionComparison {
  isAgreement: boolean;
  finalMatch: boolean;
  criticalMatch: boolean;
  detailedMatch: boolean;
  reviewer1: {
    answers: boolean[][];
    finalAnswer: string | null;
    critical: boolean;
  };
  reviewer2: {
    answers: boolean[][];
    finalAnswer: string | null;
    critical: boolean;
  };
}

interface MultiPartComparison {
  isAgreement: boolean;
  isMultiPart: true;
  parts: Array<{
    key: string;
    isAgreement: boolean;
    finalMatch: boolean;
    criticalMatch: boolean;
    detailedMatch: boolean;
    reviewer1Answer: AMSTAR2Question;
    reviewer2Answer: AMSTAR2Question;
  }>;
  reviewer1Answer: AMSTAR2Question[];
  reviewer2Answer: AMSTAR2Question[];
}

interface ComparisonResult {
  agreements: Array<{ key: string } & (QuestionComparison | MultiPartComparison)>;
  disagreements: Array<{ key: string } & (QuestionComparison | MultiPartComparison)>;
  stats: {
    total: number;
    agreed: number;
    disagreed: number;
    agreementRate: number;
  };
}

/**
 * Get all question keys for display in reconciliation.
 *
 * Returns keys as they appear in AMSTAR_CHECKLIST (q1-q16), but q9 and q11
 * are displayed as combined questions while their data is stored as q9a/q9b and q11a/q11b.
 */
export function getQuestionKeys(): string[] {
  return AMSTAR2_QUESTION_KEYS;
}

/**
 * Get the actual data keys for a question.
 *
 * For q9 and q11, returns the a/b parts. For others, returns the key as-is.
 */
export function getDataKeysForQuestion(questionKey: string): string[] {
  if (questionKey === 'q9') {
    return ['q9a', 'q9b'];
  }
  if (questionKey === 'q11') {
    return ['q11a', 'q11b'];
  }
  return [questionKey];
}

/**
 * Check if a question has multiple parts (a/b)
 */
export function isMultiPartQuestion(questionKey: string): boolean {
  return questionKey === 'q9' || questionKey === 'q11';
}

/**
 * Compare the answers of two checklists and identify differences.
 */
export function compareChecklists(
  checklist1: AMSTAR2Checklist,
  checklist2: AMSTAR2Checklist,
): ComparisonResult {
  if (!checklist1 || !checklist2) {
    return {
      agreements: [],
      disagreements: [],
      stats: { total: 0, agreed: 0, disagreed: 0, agreementRate: 0 },
    };
  }

  const questionKeys = getQuestionKeys();
  const agreements: ComparisonResult['agreements'] = [];
  const disagreements: ComparisonResult['disagreements'] = [];

  for (const key of questionKeys) {
    if (isMultiPartQuestion(key)) {
      const dataKeys = getDataKeysForQuestion(key);
      const q1Parts = dataKeys.map(
        dk => checklist1[dk as keyof AMSTAR2Checklist] as AMSTAR2Question,
      );
      const q2Parts = dataKeys.map(
        dk => checklist2[dk as keyof AMSTAR2Checklist] as AMSTAR2Question,
      );

      if (q1Parts.some(p => !p) || q2Parts.some(p => !p)) continue;

      const comparison = compareMultiPartQuestion(key, q1Parts, q2Parts, dataKeys);

      if (comparison.isAgreement) {
        agreements.push({ key, ...comparison });
      } else {
        disagreements.push({ key, ...comparison });
      }
    } else {
      const q1 = checklist1[key as keyof AMSTAR2Checklist] as AMSTAR2Question;
      const q2 = checklist2[key as keyof AMSTAR2Checklist] as AMSTAR2Question;

      if (!q1 || !q2) continue;

      const comparison = compareQuestion(key, q1, q2);

      if (comparison.isAgreement) {
        agreements.push({ key, ...comparison });
      } else {
        disagreements.push({ key, ...comparison });
      }
    }
  }

  const total = agreements.length + disagreements.length;
  return {
    agreements,
    disagreements,
    stats: {
      total,
      agreed: agreements.length,
      disagreed: disagreements.length,
      agreementRate: total > 0 ? agreements.length / total : 0,
    },
  };
}

/**
 * Compare a multi-part question (q9 or q11) between two checklists.
 */
export function compareMultiPartQuestion(
  _questionKey: string,
  q1Parts: AMSTAR2Question[],
  q2Parts: AMSTAR2Question[],
  dataKeys: string[],
): MultiPartComparison {
  let allPartsAgree = true;
  const partComparisons: QuestionComparison[] = [];

  for (let i = 0; i < q1Parts.length; i++) {
    const partComparison = compareQuestion(dataKeys[i], q1Parts[i], q2Parts[i]);
    partComparisons.push(partComparison);
    if (!partComparison.isAgreement) {
      allPartsAgree = false;
    }
  }

  return {
    isAgreement: allPartsAgree,
    isMultiPart: true,
    parts: dataKeys.map((dk, i) => ({
      key: dk,
      ...partComparisons[i],
      reviewer1Answer: q1Parts[i],
      reviewer2Answer: q2Parts[i],
    })),
    reviewer1Answer: q1Parts,
    reviewer2Answer: q2Parts,
  };
}

/**
 * Compare a single question's answers between two checklists.
 */
export function compareQuestion(
  questionKey: string,
  q1: AMSTAR2Question,
  q2: AMSTAR2Question,
): QuestionComparison {
  const answers1 = q1.answers;
  const answers2 = q2.answers;

  const finalAnswer1 = getFinalAnswer(answers1, questionKey);
  const finalAnswer2 = getFinalAnswer(answers2, questionKey);

  const detailedMatch = answersMatch(answers1, answers2);
  const finalMatch = finalAnswer1 === finalAnswer2;
  const criticalMatch = q1.critical === q2.critical;

  return {
    isAgreement: finalMatch && criticalMatch,
    finalMatch,
    criticalMatch,
    detailedMatch,
    reviewer1: {
      answers: answers1,
      finalAnswer: finalAnswer1,
      critical: q1.critical,
    },
    reviewer2: {
      answers: answers2,
      finalAnswer: finalAnswer2,
      critical: q2.critical,
    },
  };
}

type SelectionValue = 'reviewer1' | 'reviewer2' | AMSTAR2Question | Record<string, AMSTAR2Question>;

interface ReconciledMetadata {
  name?: string;
  reviewerName?: string;
  createdAt?: string;
  id?: string;
}

/**
 * Create a merged/reconciled checklist from two source checklists.
 */
export function createReconciledChecklist(
  checklist1: AMSTAR2Checklist,
  checklist2: AMSTAR2Checklist,
  selections: Record<string, SelectionValue>,
  metadata: ReconciledMetadata = {},
): AMSTAR2Checklist & { sourceChecklists: string[] } {
  const questionKeys = getQuestionKeys();

  const reconciled: Record<string, unknown> = {
    name: metadata.name || 'Reconciled Checklist',
    reviewerName: metadata.reviewerName || 'Consensus',
    createdAt: metadata.createdAt || new Date().toISOString().split('T')[0],
    id: metadata.id || `reconciled-${Date.now()}`,
    sourceChecklists: [checklist1.id, checklist2.id],
  };

  for (const key of questionKeys) {
    const selection = selections[key];
    const dataKeys = getDataKeysForQuestion(key);

    if (isMultiPartQuestion(key)) {
      for (const dataKey of dataKeys) {
        if (!selection || selection === 'reviewer1') {
          reconciled[dataKey] = JSON.parse(
            JSON.stringify(checklist1[dataKey as keyof AMSTAR2Checklist]),
          );
        } else if (selection === 'reviewer2') {
          reconciled[dataKey] = JSON.parse(
            JSON.stringify(checklist2[dataKey as keyof AMSTAR2Checklist]),
          );
        } else if (
          typeof selection === 'object' &&
          (selection as Record<string, unknown>)[dataKey]
        ) {
          reconciled[dataKey] = JSON.parse(
            JSON.stringify((selection as Record<string, unknown>)[dataKey]),
          );
        }
      }
    } else {
      if (!selection || selection === 'reviewer1') {
        reconciled[key] = JSON.parse(JSON.stringify(checklist1[key as keyof AMSTAR2Checklist]));
      } else if (selection === 'reviewer2') {
        reconciled[key] = JSON.parse(JSON.stringify(checklist2[key as keyof AMSTAR2Checklist]));
      } else if (typeof selection === 'object') {
        reconciled[key] = JSON.parse(JSON.stringify(selection));
      }
    }
  }

  return reconciled as unknown as AMSTAR2Checklist & { sourceChecklists: string[] };
}

/**
 * Get a summary of what needs reconciliation.
 */
export function getReconciliationSummary(comparison: ComparisonResult): {
  totalQuestions: number;
  agreementCount: number;
  disagreementCount: number;
  agreementPercentage: number;
  criticalDisagreements: number;
  nonCriticalDisagreements: number;
  needsReconciliation: boolean;
  disagreementsByQuestion: string[];
} {
  const { disagreements, stats } = comparison;

  const criticalDisagreements = disagreements.filter(d => {
    if ('isMultiPart' in d && d.isMultiPart && d.parts) {
      return d.parts.some(part => part.reviewer1Answer?.critical || part.reviewer2Answer?.critical);
    }
    if ('reviewer1' in d) {
      return d.reviewer1?.critical || d.reviewer2?.critical;
    }
    return false;
  });

  const nonCriticalDisagreements = disagreements.filter(d => {
    if ('isMultiPart' in d && d.isMultiPart && d.parts) {
      return !d.parts.some(
        part => part.reviewer1Answer?.critical || part.reviewer2Answer?.critical,
      );
    }
    if ('reviewer1' in d) {
      return !d.reviewer1?.critical && !d.reviewer2?.critical;
    }
    return true;
  });

  return {
    totalQuestions: stats.total,
    agreementCount: stats.agreed,
    disagreementCount: stats.disagreed,
    agreementPercentage: Math.round(stats.agreementRate * 100),
    criticalDisagreements: criticalDisagreements.length,
    nonCriticalDisagreements: nonCriticalDisagreements.length,
    needsReconciliation: disagreements.length > 0,
    disagreementsByQuestion: disagreements.map(d => d.key),
  };
}

/**
 * Get readable question text from question key.
 */
export function getQuestionText(questionKey: string): string {
  return AMSTAR_CHECKLIST[questionKey]?.text || questionKey;
}

/**
 * Get the question definition from checklist map.
 */
export function getQuestionDef(
  questionKey: string,
): (typeof AMSTAR_CHECKLIST)[keyof typeof AMSTAR_CHECKLIST] | undefined {
  return AMSTAR_CHECKLIST[questionKey];
}
