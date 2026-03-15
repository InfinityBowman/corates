/**
 * AMSTAR2 Checklist Comparison Utilities
 * Re-exports from @corates/shared for backward compatibility.
 */

import { amstar2 } from '@corates/shared';

export const compareChecklists = amstar2.compareChecklists;
export const compareMultiPartQuestion = amstar2.compareMultiPartQuestion;
export const compareQuestion = amstar2.compareQuestion;
export const createReconciledChecklist = amstar2.createReconciledChecklist;
export const getReconciliationSummary = amstar2.getReconciliationSummary;

export const getFinalAnswer = amstar2.getFinalAnswer;
export const answersMatch = amstar2.answersMatch;

export const getQuestionKeys = amstar2.getQuestionKeys;
export const getDataKeysForQuestion = amstar2.getDataKeysForQuestion;
export const isMultiPartQuestion = amstar2.isMultiPartQuestion;

export const getQuestionText = amstar2.getQuestionText;
