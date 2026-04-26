/**
 * Checklist Registry
 *
 * Central registry that maps checklist types to their components, scoring functions,
 * and creation utilities. This enables the modular checklist architecture.
 */

import { CHECKLIST_TYPES, DEFAULT_CHECKLIST_TYPE } from './types';
import { amstar2, robinsI, rob2 } from '@corates/shared';
import type {
  AMSTAR2Checklist,
  ROBINSIChecklist,
  ROB2Checklist,
} from '@corates/shared/checklists';

interface CreateChecklistOptions {
  name: string;
  id: string;
  createdAt?: number | Date;
  reviewerName?: string;
}

interface ChecklistConfig {
  createChecklist: (options: CreateChecklistOptions) => Record<string, unknown>;
  scoreChecklist: (state: Record<string, unknown>) => string;
  getAnswers: (state: Record<string, unknown>) => Record<string, unknown> | null;
}

const CHECKLIST_REGISTRY: Record<string, ChecklistConfig> = {
  [CHECKLIST_TYPES.AMSTAR2]: {
    createChecklist: opts => amstar2.createAMSTAR2Checklist(opts),
    scoreChecklist: state => amstar2.scoreAMSTAR2Checklist(state as AMSTAR2Checklist),
    getAnswers: amstar2.getAnswers ?
      (state => amstar2.getAnswers(state as AMSTAR2Checklist))
    : (state => state),
  },

  [CHECKLIST_TYPES.ROBINS_I]: {
    createChecklist: opts => robinsI.createROBINSIChecklist(opts),
    scoreChecklist: state => robinsI.scoreROBINSIChecklist(state as ROBINSIChecklist),
    getAnswers: state => robinsI.getAnswers(state as ROBINSIChecklist),
  },

  [CHECKLIST_TYPES.ROB2]: {
    createChecklist: opts => rob2.createROB2Checklist(opts),
    scoreChecklist: state => rob2.scoreROB2Checklist(state as ROB2Checklist),
    getAnswers: state => rob2.getAnswers(state as ROB2Checklist),
  },
};

function getChecklistConfig(type: string): ChecklistConfig {
  const config = CHECKLIST_REGISTRY[type];
  if (!config) {
    console.warn(`Unknown checklist type: ${type}, falling back to ${DEFAULT_CHECKLIST_TYPE}`);
    return CHECKLIST_REGISTRY[DEFAULT_CHECKLIST_TYPE];
  }
  return config;
}

export function createChecklistOfType(
  type: string,
  options: CreateChecklistOptions,
): Record<string, unknown> {
  const config = getChecklistConfig(type);
  const checklist = config.createChecklist(options);
  return { ...checklist, type };
}

export function scoreChecklistOfType(type: string, state: Record<string, unknown>): string {
  const config = getChecklistConfig(type);
  return config.scoreChecklist(state);
}

export function getChecklistTypeFromState(checklistState: Record<string, unknown>): string {
  if (checklistState?.type) return checklistState.type as string;
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
