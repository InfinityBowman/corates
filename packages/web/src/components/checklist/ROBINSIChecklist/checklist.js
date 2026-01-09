/**
 * ROBINS-I Checklist Logic
 *
 * Re-exports checklist functions from @corates/shared for backward compatibility.
 * All new code should import directly from @corates/shared.
 */

import { robinsI } from '@corates/shared';

// Re-export functions with original names for backward compatibility
export const createChecklist = robinsI.createROBINSIChecklist;
export const scoreChecklist = robinsI.scoreROBINSIChecklist;
export const isROBINSIComplete = robinsI.isROBINSIComplete;
export const shouldStopAssessment = robinsI.shouldStopAssessment;
export const getAnswers = robinsI.getAnswers;
export const getDomainSummary = robinsI.getDomainSummary;

// Re-export smart scoring functions (also available from ./scoring/robins-scoring.js)
export const getSmartScoring = robinsI.scoreAllDomains;
export const mapOverallJudgementToDisplay = robinsI.mapOverallJudgementToDisplay;
