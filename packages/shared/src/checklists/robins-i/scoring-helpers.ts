/**
 * ROBINS-I V2 Scoring Helpers
 *
 * Shared helper functions, types, and constants used across all ROBINS-I
 * domain scoring functions.
 */

// Helper: check if answer matches any value in a set
export const inSet = (answer: string | null | undefined, ...values: string[]): boolean =>
  values.includes(answer as string);

// Normalization: treat NA as NI for scoring to avoid "stuck" branches
export const normalizeAnswer = (answer: string | null | undefined): string | null =>
  answer === 'NA' ? 'NI' : (answer ?? null);

// Helper: check if answer is Yes or Probably Yes
export const isYesPY = (answer: string | null): boolean => inSet(answer, 'Y', 'PY');

// Helper: check if answer is No or Probably No
export const isNoPPN = (answer: string | null): boolean => inSet(answer, 'N', 'PN');

// Helper: check if answer is No, Probably No, or No Information
export const isNoPPNNI = (answer: string | null): boolean => inSet(answer, 'N', 'PN', 'NI');

// Canonical judgement values - single source of truth for all ROBINS-I scoring
export const JUDGEMENTS = {
  LOW: 'Low',
  LOW_EXCEPT_CONFOUNDING: 'Low (except for concerns about uncontrolled confounding)',
  MODERATE: 'Moderate',
  SERIOUS: 'Serious',
  CRITICAL: 'Critical',
} as const;

export type Judgement = (typeof JUDGEMENTS)[keyof typeof JUDGEMENTS];

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
