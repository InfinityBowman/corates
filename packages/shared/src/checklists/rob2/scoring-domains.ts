/**
 * ROB-2 Domain Scoring Functions
 *
 * Individual scoring algorithms for each ROB-2 domain based on
 * the official decision diagrams.
 */

import { JUDGEMENTS } from './schema.js';
import { isYesPY, isNoPPN, isNoPPNNI, type ScoringResult, type DomainAnswers } from './scoring-helpers.js';

/**
 * Score Domain 1 (Bias arising from the randomization process)
 *
 * Algorithm from decision diagram:
 * - Start at 1.2 (concealment)
 * - Y/PY -> 1.1 (random sequence) -> 1.3 (baseline imbalances)
 * - N/PN -> High
 * - NI -> 1.3 -> outcomes
 */
export function scoreDomain1(answers: DomainAnswers): ScoringResult {
  const q1 = answers.d1_1?.answer ?? null; // random sequence
  const q2 = answers.d1_2?.answer ?? null; // concealment
  const q3 = answers.d1_3?.answer ?? null; // baseline imbalances

  // Start at 1.2 (concealment)
  if (q2 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // 1.2 N/PN -> High
  if (isNoPPN(q2)) {
    return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D1.R1' };
  }

  // 1.2 Y/PY -> 1.1
  if (isYesPY(q2)) {
    if (q1 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 1.1 N/PN -> Some concerns (regardless of 1.3)
    if (isNoPPN(q1)) {
      return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D1.R2' };
    }

    // 1.1 Y/PY/NI -> 1.3
    if (isYesPY(q1) || q1 === 'NI') {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // 1.3 N/PN/NI -> Low
      if (isNoPPNNI(q3)) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D1.R3' };
      }

      // 1.3 Y/PY -> Some concerns
      if (isYesPY(q3)) {
        return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D1.R4' };
      }
    }
  }

  // 1.2 NI -> 1.3
  if (q2 === 'NI') {
    if (q3 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 1.3 N/PN/NI -> Some concerns
    if (isNoPPNNI(q3)) {
      return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D1.R5' };
    }

    // 1.3 Y/PY -> High
    if (isYesPY(q3)) {
      return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D1.R6' };
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 2a Part 1 (Questions 2.1-2.5)
 */
function scoreDomain2aPart1(answers: DomainAnswers): ScoringResult {
  const q1 = answers.d2a_1?.answer ?? null; // participants aware
  const q2 = answers.d2a_2?.answer ?? null; // personnel aware
  const q3 = answers.d2a_3?.answer ?? null; // deviations from trial context (WITH_NA)
  const q4 = answers.d2a_4?.answer ?? null; // affect outcome (WITH_NA)
  const q5 = answers.d2a_5?.answer ?? null; // balanced (WITH_NA)

  // Need both 2.1 and 2.2 answered
  if (q1 === null || q2 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Both N/PN -> Low
  if (isNoPPN(q1) && isNoPPN(q2)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2A.P1.R1' };
  }

  // Either Y/PY/NI -> 2.3
  if (isYesPY(q1) || isYesPY(q2) || q1 === 'NI' || q2 === 'NI') {
    if (q3 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 2.3 N/PN/NA -> Low
    if (isNoPPN(q3) || q3 === 'NA') {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2A.P1.R2' };
    }

    // 2.3 NI -> Some concerns
    if (q3 === 'NI') {
      return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D2A.P1.R3' };
    }

    // 2.3 Y/PY -> 2.4
    if (isYesPY(q3)) {
      if (q4 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // 2.4 N/PN/NA -> Some concerns
      if (isNoPPN(q4) || q4 === 'NA') {
        return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D2A.P1.R4' };
      }

      // 2.4 Y/PY/NI -> 2.5
      if (isYesPY(q4) || q4 === 'NI') {
        if (q5 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        // 2.5 Y/PY/NA -> Some concerns
        if (isYesPY(q5) || q5 === 'NA') {
          return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D2A.P1.R5' };
        }

        // 2.5 N/PN/NI -> High
        if (isNoPPNNI(q5)) {
          return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D2A.P1.R6' };
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 2a Part 2 (Questions 2.6-2.7)
 */
function scoreDomain2aPart2(answers: DomainAnswers): ScoringResult {
  const q6 = answers.d2a_6?.answer ?? null; // appropriate analysis
  const q7 = answers.d2a_7?.answer ?? null; // substantial impact (WITH_NA)

  if (q6 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // 2.6 Y/PY -> Low
  if (isYesPY(q6)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2A.P2.R1' };
  }

  // 2.6 N/PN/NI -> 2.7
  if (isNoPPNNI(q6)) {
    if (q7 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 2.7 N/PN/NA -> Some concerns
    if (isNoPPN(q7) || q7 === 'NA') {
      return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D2A.P2.R2' };
    }

    // 2.7 Y/PY/NI -> High
    if (isYesPY(q7) || q7 === 'NI') {
      return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D2A.P2.R3' };
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 2a (Effect of assignment to intervention)
 * Combines Part 1 and Part 2, taking the worst rating
 */
export function scoreDomain2a(answers: DomainAnswers): ScoringResult {
  const part1 = scoreDomain2aPart1(answers);
  const part2 = scoreDomain2aPart2(answers);

  // If either part is incomplete, return incomplete
  if (!part1.isComplete || !part2.isComplete) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Combine: take worst rating
  const rankMap: Record<string, number> = {
    [JUDGEMENTS.LOW]: 0,
    [JUDGEMENTS.SOME_CONCERNS]: 1,
    [JUDGEMENTS.HIGH]: 2,
  };

  const p1Rank = part1.judgement ? rankMap[part1.judgement] : 0;
  const p2Rank = part2.judgement ? rankMap[part2.judgement] : 0;
  const worstRank = Math.max(p1Rank, p2Rank);

  const judgement =
    worstRank === 2 ? JUDGEMENTS.HIGH
    : worstRank === 1 ? JUDGEMENTS.SOME_CONCERNS
    : JUDGEMENTS.LOW;

  return {
    judgement,
    isComplete: true,
    ruleId: `D2A.Combined(${part1.ruleId},${part2.ruleId})`,
  };
}

/**
 * Score Domain 2b (Effect of adhering to intervention)
 */
export function scoreDomain2b(answers: DomainAnswers): ScoringResult {
  const q1 = answers.d2b_1?.answer ?? null; // participants aware
  const q2 = answers.d2b_2?.answer ?? null; // personnel aware
  const q3 = answers.d2b_3?.answer ?? null; // balanced non-protocol (WITH_NA)
  const q4 = answers.d2b_4?.answer ?? null; // failures in implementation (WITH_NA)
  const q5 = answers.d2b_5?.answer ?? null; // non-adherence (WITH_NA)
  const q6 = answers.d2b_6?.answer ?? null; // appropriate analysis (WITH_NA)

  // Need both 2.1 and 2.2 answered
  if (q1 === null || q2 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Both N/PN -> go to 2.4/2.5
  if (isNoPPN(q1) && isNoPPN(q2)) {
    // Check 2.4 and 2.5
    if (q4 === null || q5 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Both NA/N/PN -> Low
    if ((isNoPPN(q4) || q4 === 'NA') && (isNoPPN(q5) || q5 === 'NA')) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2B.R1' };
    }

    // Either Y/PY/NI -> 2.6
    if (isYesPY(q4) || isYesPY(q5) || q4 === 'NI' || q5 === 'NI') {
      if (q6 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // 2.6 Y/PY/NA -> Some concerns
      if (isYesPY(q6) || q6 === 'NA') {
        return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D2B.R2' };
      }

      // 2.6 N/PN/NI -> High
      if (isNoPPNNI(q6)) {
        return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D2B.R3' };
      }
    }
  }

  // Either Y/PY/NI -> 2.3
  if (isYesPY(q1) || isYesPY(q2) || q1 === 'NI' || q2 === 'NI') {
    if (q3 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 2.3 NA/Y/PY -> go to 2.4/2.5
    if (q3 === 'NA' || isYesPY(q3)) {
      if (q4 === null || q5 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // Both NA/N/PN -> Low
      if ((isNoPPN(q4) || q4 === 'NA') && (isNoPPN(q5) || q5 === 'NA')) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2B.R4' };
      }

      // Either Y/PY/NI -> 2.6
      if (isYesPY(q4) || isYesPY(q5) || q4 === 'NI' || q5 === 'NI') {
        if (q6 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        // 2.6 Y/PY/NA -> Some concerns
        if (isYesPY(q6) || q6 === 'NA') {
          return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D2B.R5' };
        }

        // 2.6 N/PN/NI -> High
        if (isNoPPNNI(q6)) {
          return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D2B.R6' };
        }
      }
    }

    // 2.3 N/PN/NI -> 2.6
    if (isNoPPNNI(q3)) {
      if (q6 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // 2.6 Y/PY/NA -> Some concerns
      if (isYesPY(q6) || q6 === 'NA') {
        return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D2B.R7' };
      }

      // 2.6 N/PN/NI -> High
      if (isNoPPNNI(q6)) {
        return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D2B.R8' };
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 3 (Missing outcome data)
 */
export function scoreDomain3(answers: DomainAnswers): ScoringResult {
  const q1 = answers.d3_1?.answer ?? null; // data available
  const q2 = answers.d3_2?.answer ?? null; // evidence not biased (WITH_NA)
  const q3 = answers.d3_3?.answer ?? null; // could depend on true value (WITH_NA)
  const q4 = answers.d3_4?.answer ?? null; // likely depended on true value (WITH_NA)

  if (q1 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // 3.1 Y/PY -> Low
  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D3.R1' };
  }

  // 3.1 N/PN/NI -> 3.2
  if (isNoPPNNI(q1)) {
    if (q2 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 3.2 Y/PY -> Low
    if (isYesPY(q2)) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D3.R2' };
    }

    // 3.2 N/PN/NI/NA -> 3.3
    if (isNoPPN(q2) || q2 === 'NI' || q2 === 'NA') {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // 3.3 N/PN/NA -> Low
      if (isNoPPN(q3) || q3 === 'NA') {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D3.R3' };
      }

      // 3.3 Y/PY/NI -> 3.4
      if (isYesPY(q3) || q3 === 'NI') {
        if (q4 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        // 3.4 N/PN/NA -> Some concerns
        if (isNoPPN(q4) || q4 === 'NA') {
          return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D3.R4' };
        }

        // 3.4 Y/PY/NI -> High
        if (isYesPY(q4) || q4 === 'NI') {
          return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D3.R5' };
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 4 (Measurement of the outcome)
 */
export function scoreDomain4(answers: DomainAnswers): ScoringResult {
  const q1 = answers.d4_1?.answer ?? null; // inappropriate method
  const q2 = answers.d4_2?.answer ?? null; // differ between groups
  const q3 = answers.d4_3?.answer ?? null; // assessors aware (WITH_NA)
  const q4 = answers.d4_4?.answer ?? null; // could be influenced (WITH_NA)
  const q5 = answers.d4_5?.answer ?? null; // likely influenced (WITH_NA)

  if (q1 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // 4.1 Y/PY -> High
  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D4.R1' };
  }

  // 4.1 N/PN/NI -> 4.2
  if (isNoPPNNI(q1)) {
    if (q2 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 4.2 Y/PY -> High
    if (isYesPY(q2)) {
      return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D4.R2' };
    }

    // 4.2 N/PN -> 4.3 (branch A)
    if (isNoPPN(q2)) {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // 4.3 N/PN/NA -> Low
      if (isNoPPN(q3) || q3 === 'NA') {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R3' };
      }

      // 4.3 Y/PY/NI -> 4.4
      if (isYesPY(q3) || q3 === 'NI') {
        if (q4 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        // 4.4 N/PN/NA -> Low
        if (isNoPPN(q4) || q4 === 'NA') {
          return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R4' };
        }

        // 4.4 Y/PY/NI -> 4.5
        if (isYesPY(q4) || q4 === 'NI') {
          if (q5 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }

          // 4.5 N/PN/NA -> Some concerns
          if (isNoPPN(q5) || q5 === 'NA') {
            return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D4.R5' };
          }

          // 4.5 Y/PY/NI -> High
          if (isYesPY(q5) || q5 === 'NI') {
            return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D4.R6' };
          }
        }
      }
    }

    // 4.2 NI -> 4.3 (branch B - leads to Some concerns or High)
    if (q2 === 'NI') {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // 4.3 N/PN/NA -> Some concerns
      if (isNoPPN(q3) || q3 === 'NA') {
        return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D4.R7' };
      }

      // 4.3 Y/PY/NI -> 4.4
      if (isYesPY(q3) || q3 === 'NI') {
        if (q4 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        // 4.4 N/PN/NA -> Some concerns
        if (isNoPPN(q4) || q4 === 'NA') {
          return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D4.R8' };
        }

        // 4.4 Y/PY/NI -> 4.5
        if (isYesPY(q4) || q4 === 'NI') {
          if (q5 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }

          // 4.5 N/PN/NA -> Some concerns
          if (isNoPPN(q5) || q5 === 'NA') {
            return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D4.R9' };
          }

          // 4.5 Y/PY/NI -> High
          if (isYesPY(q5) || q5 === 'NI') {
            return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D4.R10' };
          }
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 5 (Selection of the reported result)
 */
export function scoreDomain5(answers: DomainAnswers): ScoringResult {
  const q1 = answers.d5_1?.answer ?? null; // pre-specified plan
  const q2 = answers.d5_2?.answer ?? null; // selected from measurements
  const q3 = answers.d5_3?.answer ?? null; // selected from analyses

  // Need 5.2 and 5.3 first
  if (q2 === null || q3 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Either 5.2 or 5.3 Y/PY -> High
  if (isYesPY(q2) || isYesPY(q3)) {
    return { judgement: JUDGEMENTS.HIGH, isComplete: true, ruleId: 'D5.R1' };
  }

  // At least one NI, but neither Y/PY -> Some concerns
  if ((q2 === 'NI' || q3 === 'NI') && !isYesPY(q2) && !isYesPY(q3)) {
    return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D5.R2' };
  }

  // Both N/PN -> check 5.1
  if (isNoPPN(q2) && isNoPPN(q3)) {
    if (q1 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // 5.1 Y/PY -> Low
    if (isYesPY(q1)) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D5.R3' };
    }

    // 5.1 N/PN/NI -> Some concerns
    if (isNoPPNNI(q1)) {
      return { judgement: JUDGEMENTS.SOME_CONCERNS, isComplete: true, ruleId: 'D5.R4' };
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}
