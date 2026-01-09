/**
 * AMSTAR2 Scoring
 *
 * Functions for scoring checklists and determining confidence levels.
 */

import type { AMSTAR2Checklist, AMSTAR2Question, AMSTAR2Score } from '../types.js';
import { AMSTAR2_DATA_KEYS } from './schema.js';
import { getSelectedAnswer, consolidateAnswers } from './answers.js';

/**
 * Score an AMSTAR2 checklist using the last column of each question.
 *
 * Scoring rules:
 * - Partial Yes is scored the same as Yes
 * - No MA (No Meta-Analysis) is not counted as a flaw
 * - Critical flaws: More than one critical question answered "No" = Critically Low
 * - One critical flaw = Low confidence
 * - Multiple non-critical flaws = Moderate confidence
 * - Otherwise = High confidence
 *
 * @param checklist - The AMSTAR2 checklist to score
 * @returns The confidence rating
 */
export function scoreAMSTAR2Checklist(checklist: AMSTAR2Checklist): AMSTAR2Score {
  if (!checklist || typeof checklist !== 'object') return 'Error';

  let criticalFlaws = 0;
  let nonCriticalFlaws = 0;

  const consolidated = consolidateAnswers(checklist);

  for (const [question, obj] of Object.entries(consolidated)) {
    if (!/^q\d+[a-z]*$/i.test(question)) continue;
    const questionData = obj as AMSTAR2Question;
    if (!questionData || !Array.isArray(questionData.answers)) continue;

    const selected = getSelectedAnswer(questionData.answers, question);

    // Only count as flaw if answer is missing or "No"
    // "Yes", "Partial Yes", and "No MA" are not flaws
    if (!selected || selected === 'No') {
      if (questionData.critical) {
        criticalFlaws++;
      } else {
        nonCriticalFlaws++;
      }
    }
  }

  if (criticalFlaws > 1) return 'Critically Low';
  if (criticalFlaws === 1) return 'Low';
  if (nonCriticalFlaws > 1) return 'Moderate';
  return 'High';
}

/**
 * Check if an AMSTAR2 checklist is complete (all questions have final answers).
 *
 * A question has a final answer if the last column has at least one option selected.
 *
 * @param checklist - The checklist object to validate
 * @returns True if all questions have final answers, false otherwise
 */
export function isAMSTAR2Complete(checklist: AMSTAR2Checklist): boolean {
  if (!checklist || typeof checklist !== 'object') return false;

  // Check each required question has a final answer
  for (const questionKey of AMSTAR2_DATA_KEYS) {
    const question = checklist[questionKey as keyof AMSTAR2Checklist] as
      | AMSTAR2Question
      | undefined;
    if (!question || !Array.isArray(question.answers)) return false;

    // Check if the last column has at least one option selected
    const lastCol = question.answers[question.answers.length - 1];
    if (!Array.isArray(lastCol)) return false;
    const hasAnswer = lastCol.some(v => v === true);
    if (!hasAnswer) return false;
  }

  return true;
}

/**
 * Get a breakdown of critical and non-critical flaw counts.
 *
 * @param checklist - The AMSTAR2 checklist
 * @returns Object with flaw counts and details
 */
export function getScoreBreakdown(checklist: AMSTAR2Checklist): {
  criticalFlaws: number;
  nonCriticalFlaws: number;
  criticalQuestions: string[];
  nonCriticalQuestions: string[];
  score: AMSTAR2Score;
} {
  if (!checklist || typeof checklist !== 'object') {
    return {
      criticalFlaws: 0,
      nonCriticalFlaws: 0,
      criticalQuestions: [],
      nonCriticalQuestions: [],
      score: 'Error',
    };
  }

  const criticalQuestions: string[] = [];
  const nonCriticalQuestions: string[] = [];

  const consolidated = consolidateAnswers(checklist);

  for (const [question, obj] of Object.entries(consolidated)) {
    if (!/^q\d+[a-z]*$/i.test(question)) continue;
    const questionData = obj as AMSTAR2Question;
    if (!questionData || !Array.isArray(questionData.answers)) continue;

    const selected = getSelectedAnswer(questionData.answers, question);

    if (!selected || selected === 'No') {
      if (questionData.critical) {
        criticalQuestions.push(question);
      } else {
        nonCriticalQuestions.push(question);
      }
    }
  }

  return {
    criticalFlaws: criticalQuestions.length,
    nonCriticalFlaws: nonCriticalQuestions.length,
    criticalQuestions,
    nonCriticalQuestions,
    score: scoreAMSTAR2Checklist(checklist),
  };
}

// Legacy export for backwards compatibility
export const scoreChecklist = scoreAMSTAR2Checklist;
