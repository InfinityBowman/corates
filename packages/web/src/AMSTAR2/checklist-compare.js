/**
 * Checklist comparison utilities for reconciliation workflow
 * Compares two reviewer checklists and helps create a finalized consensus version
 */

import { AMSTAR_CHECKLIST } from './checklist-map.js';

/**
 * Get all question keys from a checklist
 * @returns {string[]} Array of question keys (q1, q2, ..., q16)
 */
export function getQuestionKeys() {
  return Object.keys(AMSTAR_CHECKLIST);
}

/**
 * Compare the answers of two checklists and identify differences
 * @param {Object} checklist1 - First reviewer's checklist
 * @param {Object} checklist2 - Second reviewer's checklist
 * @returns {Object} Comparison result with agreements, disagreements, and stats
 */
export function compareChecklists(checklist1, checklist2) {
  if (!checklist1 || !checklist2) {
    return { agreements: [], disagreements: [], stats: { total: 0, agreed: 0, disagreed: 0 } };
  }

  const questionKeys = getQuestionKeys();
  const agreements = [];
  const disagreements = [];

  for (const key of questionKeys) {
    const q1 = checklist1[key];
    const q2 = checklist2[key];

    if (!q1 || !q2) continue;

    const comparison = compareQuestion(key, q1, q2);

    if (comparison.isAgreement) {
      agreements.push({ key, ...comparison });
    } else {
      disagreements.push({ key, ...comparison });
    }
  }

  return {
    agreements,
    disagreements,
    stats: {
      total: agreements.length + disagreements.length,
      agreed: agreements.length,
      disagreed: disagreements.length,
      agreementRate: agreements.length / (agreements.length + disagreements.length) || 0,
    },
  };
}

/**
 * Compare a single question's answers between two checklists
 * @param {string} questionKey - The question key (e.g., 'q1')
 * @param {Object} q1 - First reviewer's answer object
 * @param {Object} q2 - Second reviewer's answer object
 * @returns {Object} Comparison result for this question
 */
export function compareQuestion(questionKey, q1, q2) {
  const answers1 = q1.answers;
  const answers2 = q2.answers;

  // Get the final answer (last column) for each
  const finalAnswer1 = getFinalAnswer(answers1, questionKey);
  const finalAnswer2 = getFinalAnswer(answers2, questionKey);

  // Check if all individual checkboxes match
  const detailedMatch = answersMatch(answers1, answers2);

  // Check if final answers match (main agreement criterion)
  const finalMatch = finalAnswer1 === finalAnswer2;

  // Check if critical assessment matches
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

/**
 * Get the final answer (Yes/No/Partial Yes/No MA) from the last column
 * @param {Array} answers - 2D array of answers
 * @param {string} questionKey - The question key
 * @returns {string|null} The selected final answer or null
 */
export function getFinalAnswer(answers, questionKey) {
  if (!Array.isArray(answers) || answers.length === 0) return null;

  const lastCol = answers[answers.length - 1];
  if (!Array.isArray(lastCol)) return null;

  const idx = lastCol.findIndex(v => v === true);
  if (idx === -1) return null;

  // Determine the label based on question type and column length
  const customPatternQuestions = ['q11a', 'q11b', 'q12', 'q15'];
  const customLabels = ['Yes', 'No', 'No MA'];
  const defaultLabels = ['Yes', 'Partial Yes', 'No', 'No MA'];

  if (customPatternQuestions.includes(questionKey)) {
    return customLabels[idx] || null;
  }
  if (lastCol.length === 2) {
    return idx === 0 ? 'Yes' : 'No';
  }
  if (lastCol.length >= 3) {
    return defaultLabels[idx] || null;
  }
  return null;
}

/**
 * Check if two answer arrays are identical
 * @param {Array} answers1 - First 2D array of answers
 * @param {Array} answers2 - Second 2D array of answers
 * @returns {boolean} True if all answers match
 */
export function answersMatch(answers1, answers2) {
  if (!Array.isArray(answers1) || !Array.isArray(answers2)) return false;
  if (answers1.length !== answers2.length) return false;

  for (let i = 0; i < answers1.length; i++) {
    if (!Array.isArray(answers1[i]) || !Array.isArray(answers2[i])) return false;
    if (answers1[i].length !== answers2[i].length) return false;

    for (let j = 0; j < answers1[i].length; j++) {
      if (answers1[i][j] !== answers2[i][j]) return false;
    }
  }

  return true;
}

/**
 * Create a merged/reconciled checklist from two source checklists
 * @param {Object} checklist1 - First reviewer's checklist
 * @param {Object} checklist2 - Second reviewer's checklist
 * @param {Object} selections - Object mapping question keys to 'reviewer1' | 'reviewer2' | custom
 * @param {Object} metadata - Metadata for the reconciled checklist
 * @returns {Object} The reconciled checklist
 */
export function createReconciledChecklist(checklist1, checklist2, selections, metadata = {}) {
  const questionKeys = getQuestionKeys();

  const reconciled = {
    name: metadata.name || 'Reconciled Checklist',
    reviewerName: metadata.reviewerName || 'Consensus',
    createdAt: metadata.createdAt || new Date().toISOString().split('T')[0],
    id: metadata.id || `reconciled-${Date.now()}`,
    isReconciled: true,
    sourceChecklists: [checklist1.id, checklist2.id],
  };

  for (const key of questionKeys) {
    const selection = selections[key];

    if (!selection || selection === 'reviewer1') {
      // Default to reviewer 1 if no selection
      reconciled[key] = JSON.parse(JSON.stringify(checklist1[key]));
    } else if (selection === 'reviewer2') {
      reconciled[key] = JSON.parse(JSON.stringify(checklist2[key]));
    } else if (typeof selection === 'object') {
      // Custom merged answer
      reconciled[key] = JSON.parse(JSON.stringify(selection));
    }
  }

  return reconciled;
}

/**
 * Get a summary of what needs reconciliation
 * @param {Object} comparison - Result from compareChecklists
 * @returns {Object} Summary with counts and lists
 */
export function getReconciliationSummary(comparison) {
  const { agreements, disagreements, stats } = comparison;

  const criticalDisagreements = disagreements.filter(d => {
    // Check if either reviewer marked as critical or it's a critical question
    return d.reviewer1.critical || d.reviewer2.critical;
  });

  const nonCriticalDisagreements = disagreements.filter(d => {
    return !d.reviewer1.critical && !d.reviewer2.critical;
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
 * Get readable question text from question key
 * @param {string} questionKey - The question key (e.g., 'q1')
 * @returns {string} The question text
 */
export function getQuestionText(questionKey) {
  return AMSTAR_CHECKLIST[questionKey]?.text || questionKey;
}

/**
 * Get the question definition from checklist map
 * @param {string} questionKey - The question key
 * @returns {Object} The question definition
 */
export function getQuestionDef(questionKey) {
  return AMSTAR_CHECKLIST[questionKey];
}
