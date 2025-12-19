/**
 * Utility functions for Navbar component
 * Handles question state calculations and styling logic
 */
import { isMultiPartQuestion, getDataKeysForQuestion } from '@/AMSTAR2/checklist-compare.js';

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
      const lastCol = final[dk].answers?.at(-1);
      if (!lastCol || !lastCol.includes(true)) return false;
    }
    return true;
  }

  const lastCol = final.answers?.at(-1);
  return lastCol && lastCol.includes(true);
}

/**
 * Get pill styling classes based on question state
 * @param {boolean} isCurrentPage - Is this the active page
 * @param {boolean} hasAnswer - Has this question been answered
 * @param {boolean} isAgreement - Do reviewers agree on this question
 * @returns {string} Tailwind CSS classes
 */
export function getQuestionPillStyle(isCurrentPage, hasAnswer, isAgreement) {
  if (isCurrentPage) {
    return 'bg-blue-600 text-white ring-2 ring-blue-300';
  }
  if (hasAnswer) {
    // Answered - show solid color
    return isAgreement ?
        'bg-green-500 text-white hover:bg-green-600'
      : 'bg-amber-500 text-white hover:bg-amber-600';
  }
  // Not answered yet - show lighter color to indicate agreement/disagreement status
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
