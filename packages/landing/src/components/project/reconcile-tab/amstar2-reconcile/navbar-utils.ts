/**
 * Utility functions for Navbar component
 * Handles question state calculations and styling logic
 */
import {
  isMultiPartQuestion,
  getDataKeysForQuestion,
} from '@/components/checklist/AMSTAR2Checklist/checklist-compare';

interface AnswerColumn {
  answers?: boolean[][];
  [key: string]: unknown;
}

type FinalAnswers = Record<string, AnswerColumn | Record<string, AnswerColumn>>;

/**
 * Check if a question has been answered in the final answers
 */
export function hasQuestionAnswer(questionKey: string, finalAnswers: FinalAnswers): boolean {
  const final = finalAnswers[questionKey];
  if (!final) return false;

  if (isMultiPartQuestion(questionKey)) {
    const dataKeys = getDataKeysForQuestion(questionKey);
    for (const dk of dataKeys) {
      const part = (final as Record<string, AnswerColumn>)[dk];
      if (!part) return false;
      const lastCol = part.answers?.[part.answers.length - 1];
      if (!lastCol || !lastCol.some(v => v === true)) return false;
    }
    return true;
  }

  const singleFinal = final as AnswerColumn;
  const lastCol = singleFinal.answers?.[singleFinal.answers.length - 1];
  return lastCol != null && lastCol.some(v => v === true);
}

/**
 * Get pill styling classes based on question state
 */
export function getQuestionPillStyle(
  isCurrentPage: boolean,
  _hasAnswer: boolean,
  isAgreement: boolean,
): string {
  if (isCurrentPage) {
    return 'bg-blue-600 text-white ring-2 ring-blue-300';
  }
  return isAgreement ?
      'bg-green-100 text-green-700 hover:bg-green-200'
    : 'bg-amber-100 text-amber-700 hover:bg-amber-200';
}

/**
 * Generate descriptive tooltip for a question pill
 */
export function getQuestionTooltip(
  questionNumber: number | string,
  hasAnswer: boolean,
  isAgreement: boolean,
): string {
  const questionNum = `Question ${questionNumber}`;

  if (hasAnswer) {
    return `${questionNum} - Reconciled`;
  }
  if (isAgreement) {
    return `${questionNum} - Reviewers agreed`;
  }
  return `${questionNum} - Reviewers disagree`;
}
