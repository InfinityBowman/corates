/**
 * Checklists Module
 *
 * This module contains all checklist-related logic that is shared between
 * frontend and backend, including:
 * - Checklist status constants and helpers
 * - AMSTAR2 schema, creation, scoring, and comparison
 * - ROBINS-I schema, creation, scoring
 * - Domain logic for filtering and querying checklists
 * - Type definitions for checklist structures
 */

// Type definitions
export * from './types.js';

// Status constants and helpers
export * from './status.js';

// Domain logic (filtering, queries)
export * from './domain.js';

// AMSTAR2
export * as amstar2 from './amstar2/index.js';

// ROBINS-I
export * as robinsI from './robins-i/index.js';

// ROB-2
export * as rob2 from './rob2/index.js';

// Re-export key functions at top level for convenience
export {
  createAMSTAR2Checklist,
  scoreAMSTAR2Checklist,
  isAMSTAR2Complete,
  getAnswers as getAMSTAR2Answers,
  compareChecklists as compareAMSTAR2Checklists,
  createReconciledChecklist as createReconciledAMSTAR2Checklist,
} from './amstar2/index.js';

export {
  createROBINSIChecklist,
  scoreROBINSIChecklist,
  isROBINSIComplete,
  getAnswers as getROBINSIAnswers,
  scoreRobinsDomain,
  scoreAllDomains,
} from './robins-i/index.js';

export {
  createROB2Checklist,
  scoreROB2Checklist,
  isROB2Complete,
  getAnswers as getROB2Answers,
  scoreRob2Domain,
  scoreAllDomains as scoreAllROB2Domains,
} from './rob2/index.js';
