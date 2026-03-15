/**
 * ROBINS-I Smart Scoring Engine
 *
 * Re-exports scoring functions from @corates/shared for backward compatibility.
 * All new code should import directly from @corates/shared.
 */

import { robinsI } from '@corates/shared';

// Re-export all scoring functions and constants
export const JUDGEMENTS = robinsI.JUDGEMENTS;
export const OVERALL_DISPLAY = robinsI.OVERALL_DISPLAY;

// Main scoring functions
export const scoreRobinsDomain = robinsI.scoreRobinsDomain;
export const scoreAllDomains = robinsI.scoreAllDomains;
export const getEffectiveDomainJudgement = robinsI.getEffectiveDomainJudgement;
export const mapOverallJudgementToDisplay = robinsI.mapOverallJudgementToDisplay;
