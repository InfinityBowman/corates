/**
 * Shared TypeScript types for checklists
 */

import type { ChecklistStatus } from './status.js';

/**
 * Base checklist metadata shared by all checklist types
 */
export interface ChecklistMetadata {
  id: string;
  name: string;
  reviewerName: string;
  createdAt: string;
  assignedTo?: string | null;
  status?: ChecklistStatus;
  type: 'AMSTAR2' | 'ROBINS_I' | 'ROB2';
}

/**
 * AMSTAR2 question answer structure
 */
export interface AMSTAR2QuestionAnswer {
  answers: boolean[][];
  critical: boolean;
}

/**
 * Alias for AMSTAR2QuestionAnswer for internal use
 */
export type AMSTAR2Question = AMSTAR2QuestionAnswer;

/**
 * AMSTAR2 checklist structure
 */
export interface AMSTAR2Checklist extends ChecklistMetadata {
  q1: AMSTAR2QuestionAnswer;
  q2: AMSTAR2QuestionAnswer;
  q3: AMSTAR2QuestionAnswer;
  q4: AMSTAR2QuestionAnswer;
  q5: AMSTAR2QuestionAnswer;
  q6: AMSTAR2QuestionAnswer;
  q7: AMSTAR2QuestionAnswer;
  q8: AMSTAR2QuestionAnswer;
  q9a: AMSTAR2QuestionAnswer;
  q9b: AMSTAR2QuestionAnswer;
  q10: AMSTAR2QuestionAnswer;
  q11a: AMSTAR2QuestionAnswer;
  q11b: AMSTAR2QuestionAnswer;
  q12: AMSTAR2QuestionAnswer;
  q13: AMSTAR2QuestionAnswer;
  q14: AMSTAR2QuestionAnswer;
  q15: AMSTAR2QuestionAnswer;
  q16: AMSTAR2QuestionAnswer;
  sourceChecklists?: string[];
}

/**
 * AMSTAR2 scoring result
 */
export type AMSTAR2Score = 'High' | 'Moderate' | 'Low' | 'Critically Low' | 'Error';

/**
 * ROBINS-I response types
 */
export type ROBINSIResponse =
  | 'Y'
  | 'PY'
  | 'PN'
  | 'N'
  | 'NI'
  | 'NA'
  | 'WN'
  | 'SN'
  | 'SY'
  | 'WY'
  | null;

/**
 * ROBINS-I question answer structure
 */
export interface ROBINSIQuestionAnswer {
  answer: ROBINSIResponse;
  comment: string;
}

/**
 * ROBINS-I domain state
 */
export interface ROBINSIDomainState {
  answers: Record<string, ROBINSIQuestionAnswer>;
  judgement: string | null;
  judgementSource: 'auto' | 'manual';
  direction?: string | null;
}

/**
 * ROBINS-I Section B state
 */
export interface ROBINSISectionB {
  b1: ROBINSIQuestionAnswer;
  b2: ROBINSIQuestionAnswer;
  b3: ROBINSIQuestionAnswer;
  stopAssessment: boolean;
}

/**
 * ROBINS-I checklist structure
 */
export interface ROBINSIChecklist extends ChecklistMetadata {
  planning: {
    confoundingFactors: string;
  };
  sectionA: {
    numericalResult: string;
    furtherDetails: string;
    outcome: string;
  };
  sectionB: ROBINSISectionB;
  sectionC: {
    participants: string;
    interventionStrategy: string;
    comparatorStrategy: string;
    isPerProtocol: boolean;
  };
  sectionD: {
    sources: Record<string, boolean>;
    otherSpecify: string;
  };
  confoundingEvaluation: {
    predefined: unknown[];
    additional: unknown[];
  };
  domain1a: ROBINSIDomainState;
  domain1b: ROBINSIDomainState;
  domain2: ROBINSIDomainState;
  domain3: ROBINSIDomainState;
  domain4: ROBINSIDomainState;
  domain5: ROBINSIDomainState;
  domain6: ROBINSIDomainState;
  overall: {
    judgement: string | null;
    judgementSource: 'auto' | 'manual';
    direction: string | null;
  };
}

/**
 * Study object structure (for domain logic)
 */
export interface Study {
  id: string;
  projectId?: string;
  name?: string;
  reviewer1?: string | null;
  reviewer2?: string | null;
  checklists?: Array<ChecklistMetadata & { answers?: unknown }>;
  reconciliation?: {
    checklist1Id?: string;
    checklist2Id?: string;
    reconciledChecklistId?: string | null;
  };
}

/**
 * ROBINS-I scoring result
 */
export interface ROBINSIDomainScore {
  judgement: string | null;
  isComplete: boolean;
  ruleId: string | null;
}

/**
 * ROB-2 response types
 */
export type ROB2Response = 'Y' | 'PY' | 'PN' | 'N' | 'NI' | 'NA' | null;

/**
 * ROB-2 question answer structure
 */
export interface ROB2QuestionAnswer {
  answer: ROB2Response;
  comment: string;
}

/**
 * ROB-2 domain state
 */
export interface ROB2DomainState {
  answers: Record<string, ROB2QuestionAnswer>;
  judgement: string | null;
  direction: string | null;
}

/**
 * ROB-2 preliminary section state
 */
export interface ROB2PreliminaryState {
  studyDesign: string | null;
  experimental: string;
  comparator: string;
  numericalResult: string;
  aim: 'ASSIGNMENT' | 'ADHERING' | null;
  deviationsToAddress: string[];
  sources: Record<string, boolean>;
}

/**
 * ROB-2 checklist structure
 */
export interface ROB2Checklist extends Omit<ChecklistMetadata, 'type'> {
  type: 'ROB2';
  preliminary: ROB2PreliminaryState;
  domain1: ROB2DomainState;
  domain2a: ROB2DomainState;
  domain2b: ROB2DomainState;
  domain3: ROB2DomainState;
  domain4: ROB2DomainState;
  domain5: ROB2DomainState;
  overall: {
    judgement: string | null;
    direction: string | null;
  };
}

/**
 * ROB-2 scoring result
 */
export type ROB2Score = 'Low' | 'Some concerns' | 'High' | 'Incomplete' | 'Error';
