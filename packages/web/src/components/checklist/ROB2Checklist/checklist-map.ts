/**
 * ROB-2 Checklist Map
 *
 * Re-exports schema from shared package for component use.
 */

import { rob2 } from '@corates/shared/checklists';

// Response types and labels
export const RESPONSE_LABELS = rob2.RESPONSE_LABELS;
export const getResponseOptions = rob2.getResponseOptions;

// Judgements
export const JUDGEMENTS = rob2.JUDGEMENTS;

// Bias directions
export const BIAS_DIRECTIONS = rob2.BIAS_DIRECTIONS;

// Study design options
export const STUDY_DESIGNS = rob2.STUDY_DESIGNS;

// Aim options
export const AIM_OPTIONS = rob2.AIM_OPTIONS;

// Deviation options
export const DEVIATION_OPTIONS = rob2.DEVIATION_OPTIONS;

// Information sources
export const INFORMATION_SOURCES = rob2.INFORMATION_SOURCES;

// Preliminary section schema
export const PRELIMINARY_SECTION = rob2.PRELIMINARY_SECTION;

// Domain definitions
export const ROB2_CHECKLIST = rob2.ROB2_CHECKLIST;

// Domain key helpers
export const getActiveDomainKeys = rob2.getActiveDomainKeys;
export const getDomainQuestions = rob2.getDomainQuestions;
