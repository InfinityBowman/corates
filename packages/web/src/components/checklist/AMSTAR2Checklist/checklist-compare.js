/**
 * AMSTAR2 Checklist Comparison Utilities
 *
 * Re-exports comparison functions from @corates/shared for backward compatibility.
 * All new code should import directly from @corates/shared.
 */

import { amstar2 } from '@corates/shared';

// Re-export comparison functions from shared package
export const compareChecklists = amstar2.compareChecklists;
export const compareMultiPartQuestion = amstar2.compareMultiPartQuestion;
export const compareQuestion = amstar2.compareQuestion;
export const createReconciledChecklist = amstar2.createReconciledChecklist;
export const getReconciliationSummary = amstar2.getReconciliationSummary;

// Re-export answer helpers
export const getFinalAnswer = amstar2.getFinalAnswer;
export const answersMatch = amstar2.answersMatch;

// Re-export question key helpers
export const getQuestionKeys = amstar2.getQuestionKeys;
export const getDataKeysForQuestion = amstar2.getDataKeysForQuestion;
export const isMultiPartQuestion = amstar2.isMultiPartQuestion;

// Question text helpers (also available in shared)
export const getQuestionText = amstar2.getQuestionText;
export const getQuestionDef = amstar2.getQuestionDef;
