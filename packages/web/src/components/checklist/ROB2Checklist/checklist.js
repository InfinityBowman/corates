/**
 * ROB-2 Checklist Utilities
 *
 * Helper functions for ROB-2 checklist operations.
 * Re-exports from @corates/shared while maintaining the expected interface.
 */

import { rob2 } from '@corates/shared/checklists';

// Re-export functions from shared package with original names for registry compatibility
export const createChecklist = rob2.createROB2Checklist;
export const scoreChecklist = rob2.scoreROB2Checklist;
export const isROB2Complete = rob2.isROB2Complete;
export const getAnswers = rob2.getAnswers;
export const getSelectedAnswer = rob2.getSelectedAnswer;
export const getDomainSummary = rob2.getDomainSummary;
export const scoreRob2Domain = rob2.scoreRob2Domain;
export const scoreAllDomains = rob2.scoreAllDomains;
export const createROB2Checklist = rob2.createROB2Checklist;

/**
 * Get smart scoring for a checklist (domain and overall scores)
 */
export function getSmartScoring(checklistState) {
  if (!checklistState) {
    return { domains: {}, overall: null, isComplete: false };
  }

  const result = scoreAllDomains(checklistState);

  // Convert to expected format
  const domains = {};
  Object.entries(result.domains).forEach(([key, info]) => {
    domains[key] = {
      auto: info.auto?.judgement || null,
      effective: info.judgement,
      source: 'auto',
      isOverridden: false,
    };
  });

  return {
    domains,
    overall: result.overall,
    isComplete: result.isComplete,
  };
}

/**
 * Map overall score to display format
 */
export function mapOverallJudgementToDisplay(score) {
  switch (score) {
    case 'Low':
      return 'Low risk of bias';
    case 'Some concerns':
      return 'Some concerns';
    case 'High':
      return 'High risk of bias';
    default:
      return score;
  }
}
