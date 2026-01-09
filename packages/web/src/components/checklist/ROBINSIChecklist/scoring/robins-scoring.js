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
export const DOMAIN_SCORING_RULES = robinsI.DOMAIN_SCORING_RULES;

// Domain scoring functions
export const scoreDomain1A = robinsI.scoreDomain1A;
export const scoreDomain1B = robinsI.scoreDomain1B;
export const scoreDomain2 = robinsI.scoreDomain2;
export const scoreDomain3 = robinsI.scoreDomain3;
export const scoreDomain4 = robinsI.scoreDomain4;
export const scoreDomain5 = robinsI.scoreDomain5;
export const scoreDomain6 = robinsI.scoreDomain6;

// Main scoring functions
export const scoreRobinsDomain = robinsI.scoreRobinsDomain;
export const scoreAllDomains = robinsI.scoreAllDomains;
export const getEffectiveDomainJudgement = robinsI.getEffectiveDomainJudgement;
export const mapOverallJudgementToDisplay = robinsI.mapOverallJudgementToDisplay;
