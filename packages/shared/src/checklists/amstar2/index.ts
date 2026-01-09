/**
 * AMSTAR2 Module
 *
 * AMSTAR2 (A MeaSurement Tool to Assess systematic Reviews, version 2)
 * is a critical appraisal tool for systematic reviews.
 *
 * Note on naming:
 * - AMSTAR2QuestionSchema (from schema.ts): Interface defining question structure for UI
 * - AMSTAR2Question (from types.ts): Type alias for answer data
 * - AMSTAR_CHECKLIST: Const containing all question definitions (Record<string, AMSTAR2QuestionSchema>)
 */

// Schema (checklist map and question definitions)
export * from './schema.js';

// Checklist creation
export * from './create.js';

// Scoring functions
export * from './score.js';

// Answer manipulation
export * from './answers.js';

// Comparison/reconciliation
export * from './compare.js';
