/**
 * Checklist Registry
 *
 * Central registry that maps checklist types to their components, scoring functions,
 * and creation utilities. This enables the modular checklist architecture.
 *
 * To add a new checklist type:
 * 1. Add the type constant in types.js
 * 2. Create the checklist logic in src/<TYPE>/checklist.js
 * 3. Create the UI component in src/components/checklist-ui/<TYPE>Checklist/
 * 4. Register it in CHECKLIST_REGISTRY below
 */

import { CHECKLIST_TYPES, DEFAULT_CHECKLIST_TYPE } from './types.js'
import {
  createChecklist as createAMSTAR2,
  scoreChecklist as scoreAMSTAR2,
  getAnswers as getAMSTAR2Answers,
} from '@/AMSTAR2/checklist.js'
import {
  createChecklist as createROBINSI,
  scoreChecklist as scoreROBINSI,
  getAnswers as getROBINSIAnswers,
} from '@/ROBINS-I/checklist.js'

/**
 * Registry mapping checklist types to their implementations
 *
 * Each entry provides:
 * - createChecklist: Factory function to create new checklist state
 * - scoreChecklist: Scoring function for the checklist
 * - getAnswers: Function to extract answers from state (for comparison/export)
 */
export const CHECKLIST_REGISTRY = {
  [CHECKLIST_TYPES.AMSTAR2]: {
    createChecklist: createAMSTAR2,
    scoreChecklist: scoreAMSTAR2,
    getAnswers: getAMSTAR2Answers || ((state) => state),
  },

  [CHECKLIST_TYPES.ROBINS_I]: {
    createChecklist: createROBINSI,
    scoreChecklist: scoreROBINSI,
    getAnswers: getROBINSIAnswers,
  },
}

/**
 * Get the configuration for a checklist type
 * @param {string} type - The checklist type identifier
 * @returns {Object} The registry entry for the type
 */
export function getChecklistConfig(type) {
  const config = CHECKLIST_REGISTRY[type]
  if (!config) {
    console.warn(
      `Unknown checklist type: ${type}, falling back to ${DEFAULT_CHECKLIST_TYPE}`,
    )
    return CHECKLIST_REGISTRY[DEFAULT_CHECKLIST_TYPE]
  }
  return config
}

/**
 * Create a new checklist of the specified type
 * @param {string} type - The checklist type
 * @param {Object} options - Options passed to createChecklist (name, id, etc.)
 * @returns {Object} The new checklist state
 */
export function createChecklistOfType(type, options) {
  const config = getChecklistConfig(type)
  const checklist = config.createChecklist(options)
  // Ensure the type is stored in the checklist
  return { ...checklist, checklistType: type }
}

/**
 * Score a checklist based on its type
 * @param {string} type - The checklist type
 * @param {Object} state - The checklist state
 * @returns {string} The score/rating
 */
export function scoreChecklistOfType(type, state) {
  const config = getChecklistConfig(type)
  return config.scoreChecklist(state)
}

/**
 * Determine the type of a checklist from its state
 * @param {Object} checklistState - The checklist state object
 * @returns {string} The checklist type
 */
export function getChecklistTypeFromState(checklistState) {
  // Check explicit type field
  if (checklistState?.checklistType) {
    return checklistState.checklistType
  }
  // Check for type field (alternative naming)
  if (checklistState?.type) {
    return checklistState.type
  }
  // Detect ROBINS-I by structure
  if (
    checklistState?.sectionB ||
    checklistState?.domain1a ||
    checklistState?.domain1b
  ) {
    return CHECKLIST_TYPES.ROBINS_I
  }
  // Detect AMSTAR2 by structure
  if (checklistState?.q1 || checklistState?.q2) {
    return CHECKLIST_TYPES.AMSTAR2
  }
  // Default to AMSTAR2 for backwards compatibility
  return DEFAULT_CHECKLIST_TYPE
}

// Re-export types for convenience
export {
  CHECKLIST_TYPES,
  DEFAULT_CHECKLIST_TYPE,
  getChecklistTypeOptions,
} from './types.js'
export { getChecklistMetadata } from './types.js'
