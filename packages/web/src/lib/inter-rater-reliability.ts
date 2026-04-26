/**
 * Inter-rater Reliability Calculation Utilities
 *
 * Calculates simple percent agreement and Cohen's Kappa for AMSTAR2 checklists
 * across dual-reviewer studies.
 */

import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import type { Study } from '@corates/shared/checklists';
import { getAnswers } from '@/components/checklist/AMSTAR2Checklist/checklist.js';
import { getQuestionKeys } from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';
import type { AMSTAR2Checklist } from '@corates/shared/checklists';

interface ChecklistData {
  answers?: Record<string, unknown>;
}

interface Comparison {
  questionKey: string;
  reviewer1: string;
  reviewer2: string;
  agree: boolean;
}

interface InterRaterMetrics {
  percentAgreement: number | null;
  cohensKappa: number | null;
  studyCount: number;
  totalComparisons: number;
}

/**
 * Calculate inter-rater reliability metrics for all eligible studies
 */
export function calculateInterRaterReliability(
  studies: Study[] | null | undefined,
  getChecklistData:
    | ((studyId: string, checklistId: string) => ChecklistData | null | undefined)
    | null
    | undefined,
): InterRaterMetrics {
  if (!studies || !Array.isArray(studies) || studies.length === 0) {
    return {
      percentAgreement: null,
      cohensKappa: null,
      studyCount: 0,
      totalComparisons: 0,
    };
  }

  // Filter studies with dual reviewers
  const dualReviewerStudies = studies.filter(s => s.reviewer1 && s.reviewer2);

  if (dualReviewerStudies.length === 0) {
    return {
      percentAgreement: null,
      cohensKappa: null,
      studyCount: 0,
      totalComparisons: 0,
    };
  }

  // Collect all question comparisons across all studies
  const allComparisons: Comparison[] = [];
  let eligibleStudyCount = 0;

  for (const study of dualReviewerStudies) {
    const checklists = study.checklists || [];

    // Find 2 reviewer-completed AMSTAR2 checklists (one per reviewer)
    const completedChecklists = checklists.filter(
      c => c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED && c.type === 'AMSTAR2',
    );

    // Must have exactly 2 completed checklists
    if (completedChecklists.length !== 2) continue;

    // Verify one is from reviewer1 and one is from reviewer2
    const reviewer1Checklist = completedChecklists.find(c => c.assignedTo === study.reviewer1);
    const reviewer2Checklist = completedChecklists.find(c => c.assignedTo === study.reviewer2);

    if (!reviewer1Checklist || !reviewer2Checklist) continue;

    // Get checklist data
    const checklist1Data = getChecklistData?.(study.id, reviewer1Checklist.id);
    const checklist2Data = getChecklistData?.(study.id, reviewer2Checklist.id);

    if (!checklist1Data?.answers || !checklist2Data?.answers) continue;

    // Extract answers using getAnswers function
    const answers1 = getAnswers(checklist1Data.answers as unknown as AMSTAR2Checklist);
    const answers2 = getAnswers(checklist2Data.answers as unknown as AMSTAR2Checklist);

    if (!answers1 || !answers2) continue;

    // Get question keys (q1-q16, with q9 and q11 consolidated)
    const questionKeys = getQuestionKeys();

    // Compare each question
    for (const questionKey of questionKeys) {
      const answer1 = answers1[questionKey];
      const answer2 = answers2[questionKey];

      // Skip if either answer is missing/null
      if (answer1 == null || answer2 == null) continue;

      allComparisons.push({
        questionKey,
        reviewer1: answer1,
        reviewer2: answer2,
        agree: answer1 === answer2,
      });
    }

    eligibleStudyCount++;
  }

  if (allComparisons.length === 0) {
    return {
      percentAgreement: null,
      cohensKappa: null,
      studyCount: 0,
      totalComparisons: 0,
    };
  }

  // Calculate percent agreement
  const agreements = allComparisons.filter(c => c.agree).length;
  const percentAgreement = (agreements / allComparisons.length) * 100;

  // Calculate Cohen's Kappa
  const cohensKappa = calculateCohensKappa(allComparisons);

  return {
    percentAgreement,
    cohensKappa,
    studyCount: eligibleStudyCount,
    totalComparisons: allComparisons.length,
  };
}

/**
 * Calculate Cohen's Kappa from comparison data
 */
function calculateCohensKappa(comparisons: Comparison[]): number | null {
  if (!comparisons || comparisons.length === 0) return null;

  // Get all unique answer values
  const allAnswers = new Set<string>();
  comparisons.forEach(c => {
    allAnswers.add(c.reviewer1);
    allAnswers.add(c.reviewer2);
  });

  const answerCategories = Array.from(allAnswers).sort();

  if (answerCategories.length === 0) return null;

  // Build confusion matrix: [reviewer1][reviewer2] = count
  const matrix: Record<string, Record<string, number>> = {};
  answerCategories.forEach(a1 => {
    matrix[a1] = {};
    answerCategories.forEach(a2 => {
      matrix[a1][a2] = 0;
    });
  });

  comparisons.forEach(c => {
    matrix[c.reviewer1][c.reviewer2]++;
  });

  // Calculate observed agreement (P_o)
  let observedAgreement = 0;
  answerCategories.forEach(category => {
    observedAgreement += matrix[category][category] || 0;
  });
  const P_o = observedAgreement / comparisons.length;

  // Calculate expected agreement (P_e) from marginal distributions
  const n = comparisons.length;
  const reviewer1Marginals: Record<string, number> = {};
  const reviewer2Marginals: Record<string, number> = {};

  answerCategories.forEach(category => {
    reviewer1Marginals[category] = 0;
    reviewer2Marginals[category] = 0;
  });

  comparisons.forEach(c => {
    reviewer1Marginals[c.reviewer1]++;
    reviewer2Marginals[c.reviewer2]++;
  });

  let expectedAgreement = 0;
  answerCategories.forEach(category => {
    const p1 = reviewer1Marginals[category] / n;
    const p2 = reviewer2Marginals[category] / n;
    expectedAgreement += p1 * p2;
  });

  const P_e = expectedAgreement;

  // Calculate Cohen's Kappa: k = (P_o - P_e) / (1 - P_e)
  // Handle edge case where P_e is very close to 1 (numerical precision)
  const denominator = 1 - P_e;
  if (Math.abs(denominator) < 1e-10) {
    // Perfect expected agreement means no variance, return 1 if observed is also perfect
    return Math.abs(P_o - 1) < 1e-10 ? 1 : null;
  }

  const kappa = (P_o - P_e) / denominator;
  return kappa;
}

/**
 * Get interpretation text for Cohen's Kappa value
 */
export function getKappaInterpretation(kappa: number | null): string {
  if (kappa == null) return 'N/A';
  if (kappa < 0) return 'Poor';
  if (kappa <= 0.2) return 'Slight';
  if (kappa <= 0.4) return 'Fair';
  if (kappa <= 0.6) return 'Moderate';
  if (kappa <= 0.8) return 'Substantial';
  return 'Almost Perfect';
}
