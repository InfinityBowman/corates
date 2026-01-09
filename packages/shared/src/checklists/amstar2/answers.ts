/**
 * AMSTAR2 Answer Utilities
 *
 * Functions for getting and manipulating checklist answers.
 */

import type { AMSTAR2Checklist, AMSTAR2Question } from '../types.js';

type AnswerLabel = 'Yes' | 'Partial Yes' | 'No' | 'No MA' | null;

/**
 * Get the selected answer from the last column of a question's answers.
 *
 * @param answers - 2D array of boolean answers
 * @param questionKey - The question key (e.g., 'q1', 'q9a')
 * @returns The selected answer label or null if none selected
 */
export function getSelectedAnswer(answers: boolean[][], questionKey: string): AnswerLabel {
  // Questions with custom pattern (Yes/No/No MA instead of Yes/Partial Yes/No/No MA)
  const customPatternQuestions = ['q11a', 'q11b', 'q12', 'q15'];
  const customLabels: AnswerLabel[] = ['Yes', 'No', 'No MA'];
  const defaultLabels: AnswerLabel[] = ['Yes', 'Partial Yes', 'No', 'No MA'];

  if (!Array.isArray(answers) || answers.length === 0) return null;
  const lastCol = answers[answers.length - 1];
  if (!Array.isArray(lastCol)) return null;

  const idx = lastCol.findIndex(v => v === true);
  if (idx === -1) return null;

  if (customPatternQuestions.includes(questionKey)) return customLabels[idx] || null;
  if (lastCol.length === 2) return idx === 0 ? 'Yes' : 'No';
  if (lastCol.length >= 3) return defaultLabels[idx] || null;

  return null;
}

/**
 * Get all answers from a checklist as a simple key-value object.
 *
 * @param checklist - The AMSTAR2 checklist
 * @returns Object mapping question keys to their selected answers
 */
export function getAnswers(checklist: AMSTAR2Checklist): Record<string, AnswerLabel> | null {
  if (!checklist || typeof checklist !== 'object') return null;

  const result: Record<string, AnswerLabel> = {};
  const consolidated = consolidateAnswers(checklist);

  for (const [key, value] of Object.entries(consolidated)) {
    if (!/^q\d+[a-z]*$/i.test(key)) continue;
    const question = value as AMSTAR2Question;
    if (!question || !Array.isArray(question.answers)) continue;

    const selected = getSelectedAnswer(question.answers, key);
    result[key] = selected;
  }

  return result;
}

/**
 * Consolidate multi-part questions (q9a/b, q11a/b) into single questions.
 *
 * For scoring purposes, q9a and q9b are combined into q9, taking the lower score.
 * Similarly for q11a and q11b into q11.
 *
 * @param checklist - The checklist with separate a/b questions
 * @returns Checklist with consolidated questions
 */
export function consolidateAnswers(checklist: AMSTAR2Checklist): Record<string, unknown> {
  const result: Record<string, unknown> = { ...checklist };

  // Consolidate q9a and q9b into q9 by taking the lower score
  if (result.q9a && result.q9b) {
    const q9a = getSelectedAnswer((result.q9a as AMSTAR2Question).answers, 'q9a');
    const q9b = getSelectedAnswer((result.q9b as AMSTAR2Question).answers, 'q9b');

    if (q9a === null || q9b === null) {
      result.q9 = result.q9a;
    } else if (q9a === 'No' || q9b === 'No') {
      result.q9 = q9a === 'No' ? result.q9a : result.q9b;
    } else if (q9a === 'No MA' && q9b === 'No MA') {
      result.q9 = result.q9a;
    } else {
      result.q9 = result.q9a;
    }
    delete result.q9a;
    delete result.q9b;
  }

  // Consolidate q11a and q11b into q11 by taking the lower score
  if (result.q11a && result.q11b) {
    const q11a = getSelectedAnswer((result.q11a as AMSTAR2Question).answers, 'q11a');
    const q11b = getSelectedAnswer((result.q11b as AMSTAR2Question).answers, 'q11b');

    if (q11a === null || q11b === null) {
      result.q11 = result.q11a;
    } else if (q11a === 'No' || q11b === 'No') {
      result.q11 = q11a === 'No' ? result.q11a : result.q11b;
    } else if (q11a === 'No MA' && q11b === 'No MA') {
      result.q11 = result.q11a;
    } else {
      result.q11 = result.q11a;
    }
    delete result.q11a;
    delete result.q11b;
  }

  return result;
}

/**
 * Get the final answer (last column selection) from a question's answers.
 *
 * @param answers - 2D array of boolean answers
 * @param questionKey - The question key
 * @returns The selected final answer or null
 */
export function getFinalAnswer(answers: boolean[][], questionKey: string): AnswerLabel {
  return getSelectedAnswer(answers, questionKey);
}

/**
 * Check if two answer arrays are identical.
 *
 * @param answers1 - First 2D array of answers
 * @param answers2 - Second 2D array of answers
 * @returns True if all answers match
 */
export function answersMatch(answers1: boolean[][], answers2: boolean[][]): boolean {
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
