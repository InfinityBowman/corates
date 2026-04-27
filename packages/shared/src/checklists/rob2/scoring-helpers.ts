/**
 * ROB-2 Scoring Helpers
 *
 * Shared helper functions, types, and interfaces used by the scoring engine.
 */

import type { Judgement } from './schema.js';

// Helper: check if answer matches any value in a set
export const inSet = (answer: string | null | undefined, ...values: string[]): boolean =>
  values.includes(answer as string);

// Helper: check if answer is Yes or Probably Yes
export const isYesPY = (answer: string | null): boolean => inSet(answer, 'Y', 'PY');

// Helper: check if answer is No or Probably No
export const isNoPPN = (answer: string | null): boolean => inSet(answer, 'N', 'PN');

// Helper: check if answer is No, Probably No, or No Information
export const isNoPPNNI = (answer: string | null): boolean => inSet(answer, 'N', 'PN', 'NI');

export interface ScoringResult {
  judgement: Judgement | null;
  isComplete: boolean;
  ruleId: string | null;
}

export interface DomainAnswers {
  [questionKey: string]: {
    answer: string | null;
    comment?: string;
  };
}

export interface DomainState {
  answers?: DomainAnswers;
  judgement?: Judgement | null;
  direction?: string | null;
}

export interface ChecklistState {
  preliminary?: { aim?: string };
  [domainKey: string]: DomainState | unknown;
}

export interface DomainScoringInfo {
  auto: ScoringResult;
  judgement: Judgement | null;
}

export interface AllDomainsResult {
  domains: Record<string, DomainScoringInfo>;
  overall: Judgement | null;
  isComplete: boolean;
}
