/**
 * Checklist Registry
 *
 * Central registry that maps checklist types to their components, scoring functions,
 * and creation utilities. This enables the modular checklist architecture.
 */

import { CHECKLIST_TYPES, DEFAULT_CHECKLIST_TYPE } from './types';
import { amstar2, robinsI, rob2 } from '@corates/shared';

const createAMSTAR2 = amstar2.createAMSTAR2Checklist;
const scoreAMSTAR2 = amstar2.scoreAMSTAR2Checklist;
const getAMSTAR2Answers = amstar2.getAnswers;

const createROBINSI = robinsI.createROBINSIChecklist;
const scoreROBINSI = robinsI.scoreROBINSIChecklist;
const getROBINSIAnswers = robinsI.getAnswers;

const createROB2 = rob2.createROB2Checklist;
const scoreROB2 = rob2.scoreROB2Checklist;
const getROB2Answers = rob2.getAnswers;

interface ChecklistConfig {
  createChecklist: (..._args: any[]) => any;
  scoreChecklist: (_state: any) => string;
  getAnswers: (_state: any) => any;
}

export const CHECKLIST_REGISTRY: Record<string, ChecklistConfig> = {
  [CHECKLIST_TYPES.AMSTAR2]: {
    createChecklist: createAMSTAR2,
    scoreChecklist: scoreAMSTAR2,
    getAnswers: getAMSTAR2Answers || ((state: any) => state),
  },

  [CHECKLIST_TYPES.ROBINS_I]: {
    createChecklist: createROBINSI,
    scoreChecklist: scoreROBINSI,
    getAnswers: getROBINSIAnswers,
  },

  [CHECKLIST_TYPES.ROB2]: {
    createChecklist: createROB2,
    scoreChecklist: scoreROB2,
    getAnswers: getROB2Answers,
  },
};

export function getChecklistConfig(type: string): ChecklistConfig {
  const config = CHECKLIST_REGISTRY[type];
  if (!config) {
    console.warn(`Unknown checklist type: ${type}, falling back to ${DEFAULT_CHECKLIST_TYPE}`);
    return CHECKLIST_REGISTRY[DEFAULT_CHECKLIST_TYPE];
  }
  return config;
}

export function createChecklistOfType(type: string, options: Record<string, unknown>): any {
  const config = getChecklistConfig(type);
  const checklist = config.createChecklist(options);
  return { ...checklist, type };
}

export function scoreChecklistOfType(type: string, state: any): string {
  const config = getChecklistConfig(type);
  return config.scoreChecklist(state);
}

export function getChecklistTypeFromState(checklistState: any): string {
  if (checklistState?.type) return checklistState.type;
  if (checklistState?.domain2a || checklistState?.domain2b) return CHECKLIST_TYPES.ROB2;
  if (checklistState?.sectionB || checklistState?.domain1a || checklistState?.domain1b)
    return CHECKLIST_TYPES.ROBINS_I;
  if (checklistState?.q1 || checklistState?.q2) return CHECKLIST_TYPES.AMSTAR2;
  return DEFAULT_CHECKLIST_TYPE;
}

// Re-export types for convenience
export {
  CHECKLIST_TYPES,
  DEFAULT_CHECKLIST_TYPE,
  getChecklistTypeOptions,
  getChecklistMetadata,
} from './types';
export type { ChecklistType, ChecklistMetadata } from './types';
