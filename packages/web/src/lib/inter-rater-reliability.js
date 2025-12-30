/**
 * Inter-rater Reliability Calculation Utilities
 *
 * Calculates simple percent agreement and Cohen's Kappa for AMSTAR2 checklists
 * across dual-reviewer studies.
 */

import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import { getAnswers } from '@/AMSTAR2/checklist.js';
import { getQuestionKeys } from '@/AMSTAR2/checklist-compare.js';

/**
 * Calculate inter-rater reliability metrics for all eligible studies
 * @param {Array} studies - Array of study objects
 * @param {Function} getChecklistData - Function to retrieve checklist data (studyId, checklistId) => { answers: {...} }
 * @returns {Object} Metrics object with percentAgreement, cohensKappa, studyCount, totalComparisons
 */
export function calculateInterRaterReliability(studies, getChecklistData) {
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
  const allComparisons = [];
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
    const answers1 = getAnswers(checklist1Data.answers);
    const answers2 = getAnswers(checklist2Data.answers);

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
 * @param {Array} comparisons - Array of {questionKey, reviewer1, reviewer2, agree}
 * @returns {number|null} Cohen's Kappa value or null if calculation not possible
 */
function calculateCohensKappa(comparisons) {
  if (!comparisons || comparisons.length === 0) return null;

  // Get all unique answer values
  const allAnswers = new Set();
  comparisons.forEach(c => {
    allAnswers.add(c.reviewer1);
    allAnswers.add(c.reviewer2);
  });

  const answerCategories = Array.from(allAnswers).sort();

  if (answerCategories.length === 0) return null;

  // Build confusion matrix: [reviewer1][reviewer2] = count
  const matrix = {};
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
  const reviewer1Marginals = {};
  const reviewer2Marginals = {};

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

  // Calculate Cohen's Kappa: κ = (P_o - P_e) / (1 - P_e)
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
 * @param {number|null} kappa - Cohen's Kappa value
 * @returns {string} Interpretation text
 */
export function getKappaInterpretation(kappa) {
  if (kappa == null) return 'N/A';
  if (kappa < 0) return 'Poor';
  if (kappa <= 0.2) return 'Slight';
  if (kappa <= 0.4) return 'Fair';
  if (kappa <= 0.6) return 'Moderate';
  if (kappa <= 0.8) return 'Substantial';
  return 'Almost Perfect';
}
