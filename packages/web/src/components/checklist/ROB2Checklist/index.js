/**
 * ROB-2 Checklist Module
 *
 * Main entry point for ROB-2 checklist component and utilities.
 */

export { ROB2Checklist, default } from './ROB2Checklist.jsx';
export { PreliminarySection } from './PreliminarySection.jsx';
export { DomainSection } from './DomainSection.jsx';
export { OverallSection } from './OverallSection.jsx';
export { SignallingQuestion, ResponseLegend } from './SignallingQuestion.jsx';
export { DomainJudgement, JudgementBadge } from './DomainJudgement.jsx';
export { ScoringSummary } from './ScoringSummary.jsx';

// Re-export scoring and utilities from checklist.js
export {
  createROB2Checklist as createChecklist,
  scoreROB2Checklist as scoreChecklist,
  getAnswers,
  isROB2Complete as isComplete,
  getSmartScoring,
} from './checklist.js';
