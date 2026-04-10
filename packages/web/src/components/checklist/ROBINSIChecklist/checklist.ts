/**
 * ROBINS-I Checklist Logic
 *
 * Re-exports checklist functions from @corates/shared for backward compatibility.
 * All new code should import directly from @corates/shared.
 */

import { robinsI } from '@corates/shared';

// Re-export functions with original names for backward compatibility
export const isROBINSIComplete = robinsI.isROBINSIComplete;
export const shouldStopAssessment = robinsI.shouldStopAssessment;

// Re-export smart scoring functions
export const getSmartScoring = robinsI.scoreAllDomains;
export const mapOverallJudgementToDisplay = robinsI.mapOverallJudgementToDisplay;
