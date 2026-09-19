/**
 * Shared shapes for the per-tool reliability adapters.
 */

import type { ItemDefinition, RatingPair } from './stats.js';

export type ReliabilityToolType = 'ROB2' | 'ROBINS_I' | 'AMSTAR2';

export interface ToolPairs {
  /** Domain judgements (RoB 2, ROBINS-I) or item answers (AMSTAR 2). */
  judgements: RatingPair[];
  /** One pair per checklist pair: the overall judgement or confidence rating. */
  overall: RatingPair[];
  /** Signaling questions; empty for tools without them. */
  questions: RatingPair[];
}

export interface ToolReliabilityDefinition {
  type: ReliabilityToolType;
  label: string;
  /** What one reviewer pair appraises: an outcome or a whole study. */
  unit: 'outcome' | 'study';
  judgementLabel: string;
  judgementScale: string[];
  overallScale: string[];
  items: ItemDefinition[];
  hasQuestions: boolean;
  /** Tool-specific rules the explanation must state, in plain language. */
  notes: string[];
  extractPairs: (a: unknown, b: unknown) => ToolPairs;
}
