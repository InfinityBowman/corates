/**
 * Confidence scoring for memory entries
 */

import type { KnowledgeType } from './types.js';

// Base confidence by knowledge type
const TYPE_BASE_CONFIDENCE: Record<KnowledgeType, number> = {
  fact: 0.6, // Facts are relatively straightforward
  decision: 0.5, // Decisions need more context to be valuable
  procedure: 0.55, // Procedures are actionable but may become stale
  pattern: 0.5, // Patterns need validation over time
};

// Bonus for having a source
const SOURCE_BONUS = 0.1;

// Bonus multipliers for content length (normalized)
const CONTENT_LENGTH_BONUS = 0.1;
const OPTIMAL_CONTENT_LENGTH = 500; // Characters for max bonus

/**
 * Compute confidence score for a new entry
 */
export function computeConfidence(input: {
  type: KnowledgeType;
  content: string;
  source?: { type: string; reference?: string };
  confidenceHint?: number;
}): number {
  let confidence = TYPE_BASE_CONFIDENCE[input.type];

  // Bonus for having a source
  if (input.source) {
    confidence += SOURCE_BONUS;
    // Extra bonus for having a reference
    if (input.source.reference) {
      confidence += 0.05;
    }
  }

  // Bonus for content length (up to optimal length)
  const lengthRatio = Math.min(input.content.length / OPTIMAL_CONTENT_LENGTH, 1);
  confidence += CONTENT_LENGTH_BONUS * lengthRatio;

  // Factor in agent's confidence hint if provided
  if (input.confidenceHint !== undefined) {
    // Weight the hint at 30%
    confidence = 0.7 * confidence + 0.3 * input.confidenceHint;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, confidence));
}
