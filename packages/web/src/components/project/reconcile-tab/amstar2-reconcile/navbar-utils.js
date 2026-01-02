/**
 * Utility functions for Navbar component
 * Handles question state calculations and styling logic
 */
import {
  isMultiPartQuestion,
  getDataKeysForQuestion,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare.js';

/**
 * Check if a question has been answered in the final answers
 * @param {string} questionKey - The question key to check
 * @param {Object} finalAnswers - Object mapping question keys to final answers
 * @returns {boolean}
 */
export function hasQuestionAnswer(questionKey, finalAnswers) {
  const final = finalAnswers[questionKey];
  if (!final) return false;

  // Handle multi-part questions (q9, q11)
  if (isMultiPartQuestion(questionKey)) {
    const dataKeys = getDataKeysForQuestion(questionKey);
    for (const dk of dataKeys) {
      if (!final[dk]) return false;
      const lastCol = final[dk].answers?.[final[dk].answers.length - 1];
      if (!lastCol || !lastCol.some(v => v === true)) return false;
    }
    return true;
  }

  const lastCol = final.answers?.[final.answers.length - 1];
  return lastCol && lastCol.some(v => v === true);
}

/**
 * Get pill styling classes based on question state
 * @param {boolean} isCurrentPage - Is this the active page
 * @param {boolean} hasAnswer - Has this question been answered (not used for styling, checkmark overlay handles it)
 * @param {boolean} isAgreement - Do reviewers agree on this question
 * @returns {string} Tailwind CSS classes
 */
export function getQuestionPillStyle(isCurrentPage, hasAnswer, isAgreement) {
  if (isCurrentPage) {
    return 'bg-blue-600 text-white ring-2 ring-blue-300';
  }
  // Always use lighter colors - checkmark icon indicates if answered
  return isAgreement ?
      'bg-green-100 text-green-700 hover:bg-green-200'
    : 'bg-amber-100 text-amber-700 hover:bg-amber-200';
}

/**
 * Generate descriptive tooltip for a question pill
 * @param {number} questionNumber - The question number (1-indexed)
 * @param {boolean} hasAnswer - Has this question been answered
 * @param {boolean} isAgreement - Do reviewers agree on this question
 * @returns {string} Tooltip text
 */
export function getQuestionTooltip(questionNumber, hasAnswer, isAgreement) {
  const questionNum = `Question ${questionNumber}`;

  if (hasAnswer) {
    return `${questionNum} - Reconciled`;
  }
  if (isAgreement) {
    return `${questionNum} - Reviewers agreed`;
  }
  // Disagreement and not answered
  return `${questionNum} - Reviewers disagree`;
}
