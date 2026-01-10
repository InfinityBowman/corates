/**
 * ROBINS-I Checklist Schema/Map
 *
 * Re-exports the checklist schema from @corates/shared for backward compatibility.
 * All new code should import directly from @corates/shared.
 */

import { robinsI } from '@corates/shared';

// Re-export schema and constants from shared package
export const ROBINS_I_CHECKLIST = robinsI.ROBINS_I_CHECKLIST;

// Response types
export const RESPONSE_TYPES = robinsI.RESPONSE_TYPES;
export const RESPONSE_LABELS = robinsI.RESPONSE_LABELS;

// Judgement options
export const ROB_JUDGEMENTS = robinsI.ROB_JUDGEMENTS;
export const OVERALL_ROB_JUDGEMENTS = robinsI.OVERALL_ROB_JUDGEMENTS;

// Bias direction options
export const BIAS_DIRECTIONS = robinsI.BIAS_DIRECTIONS;
export const DOMAIN1_DIRECTIONS = robinsI.DOMAIN1_DIRECTIONS;

// Information sources
export const INFORMATION_SOURCES = robinsI.INFORMATION_SOURCES;
export const SECTION_D = robinsI.SECTION_D;

// Sections
export const PLANNING_SECTION = robinsI.PLANNING_SECTION;
export const SECTION_A = robinsI.SECTION_A;
export const SECTION_B = robinsI.SECTION_B;
export const SECTION_C = robinsI.SECTION_C;

// Helper functions
export const getActiveDomainKeys = robinsI.getActiveDomainKeys;
export const getDomainQuestions = robinsI.getDomainQuestions;
export const getResponseOptions = robinsI.getResponseOptions;
