/**
 * ROBINS-I V2 Smart Scoring Engine
 *
 * Implements deterministic, table-driven scoring for all ROBINS-I domains
 * based on the official decision tables.
 */

// Helper: check if answer matches any value in a set
const inSet = (answer: string | null | undefined, ...values: string[]): boolean =>
  values.includes(answer as string);

// Normalization: treat NA as NI for scoring to avoid "stuck" branches
const normalizeAnswer = (answer: string | null | undefined): string | null =>
  answer === 'NA' ? 'NI' : (answer ?? null);

// Helper: check if answer is Yes or Probably Yes
const isYesPY = (answer: string | null): boolean => inSet(answer, 'Y', 'PY');

// Helper: check if answer is No or Probably No
const isNoPPN = (answer: string | null): boolean => inSet(answer, 'N', 'PN');

// Helper: check if answer is No, Probably No, or No Information
const isNoPPNNI = (answer: string | null): boolean => inSet(answer, 'N', 'PN', 'NI');

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

/**
 * Score Domain 1A (Bias due to confounding - ITT effect)
 */
function scoreDomain1A(answers: DomainAnswers): ScoringResult {
  const q1 = normalizeAnswer(answers.d1a_1?.answer);
  const q2 = normalizeAnswer(answers.d1a_2?.answer);
  const q3 = normalizeAnswer(answers.d1a_3?.answer);
  const q4 = normalizeAnswer(answers.d1a_4?.answer);

  if (q1 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Path: Q1 -> if SN/NI -> NC1 -> outcomes
  if (inSet(q1, 'SN', 'NI')) {
    if (q4 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }
    if (isNoPPN(q4)) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R8' };
    }
    if (isYesPY(q4)) {
      return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R9' };
    }
  }

  // Path: Q1 -> if Y/PY -> Q3a
  if (isYesPY(q1)) {
    if (q3 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (isYesPY(q3)) {
      if (q4 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q4)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R5' };
      }
      if (isYesPY(q4)) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R4' };
      }
    }

    if (isNoPPNNI(q3)) {
      if (q2 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (inSet(q2, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R3' };
      }

      if (isYesPY(q2) || q2 === 'WN') {
        if (q4 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q4)) {
          return {
            judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING,
            isComplete: true,
            ruleId: 'D1A.R1',
          };
        }
        if (isYesPY(q4)) {
          return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1A.R2' };
        }
      }
    }
  }

  // Path: Q1 -> if WN -> Q3b
  if (q1 === 'WN') {
    if (q3 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (isYesPY(q3)) {
      if (q4 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q4)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R6' };
      }
      if (isYesPY(q4)) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R7' };
      }
    }

    if (isNoPPNNI(q3)) {
      if (q2 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (inSet(q2, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R10' };
      }

      if (isYesPY(q2) || q2 === 'WN') {
        if (q4 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q4)) {
          return {
            judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING,
            isComplete: true,
            ruleId: 'D1A.R1',
          };
        }
        if (isYesPY(q4)) {
          return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1A.R2' };
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 1B (Bias due to confounding - Per-Protocol effect)
 */
function scoreDomain1B(answers: DomainAnswers): ScoringResult {
  const q1 = normalizeAnswer(answers.d1b_1?.answer);
  const q2 = normalizeAnswer(answers.d1b_2?.answer);
  const q3 = normalizeAnswer(answers.d1b_3?.answer);
  const q4 = normalizeAnswer(answers.d1b_4?.answer);
  const q5 = normalizeAnswer(answers.d1b_5?.answer);

  if (q1 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Path: Q1 -> if N/PN/NI -> Q4
  if (isNoPPNNI(q1)) {
    if (q4 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (isYesPY(q4)) {
      return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1B.R6' };
    }

    if (isNoPPNNI(q4)) {
      if (q5 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R8' };
      }
      if (isYesPY(q5)) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1B.R7' };
      }
    }
  }

  // Path: Q1 -> if Y/PY -> Q2
  if (isYesPY(q1)) {
    if (q2 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (inSet(q2, 'SN', 'NI')) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R5' };
    }

    if (isYesPY(q2)) {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (inSet(q3, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R5' };
      }

      if (isYesPY(q3)) {
        if (q5 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q5)) {
          return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D1B.R1' };
        }
        if (isYesPY(q5)) {
          return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1B.R2' };
        }
      }

      if (q3 === 'WN') {
        if (q5 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q5)) {
          return {
            judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING,
            isComplete: true,
            ruleId: 'D1B.R3',
          };
        }
        if (isYesPY(q5)) {
          return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R4' };
        }
      }
    }

    if (q2 === 'WN') {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (inSet(q3, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R5' };
      }

      if (isYesPY(q3) || q3 === 'WN') {
        if (q5 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q5)) {
          return {
            judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING,
            isComplete: true,
            ruleId: 'D1B.R3',
          };
        }
        if (isYesPY(q5)) {
          return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R4' };
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 2 (Bias in classification of interventions)
 */
function scoreDomain2(answers: DomainAnswers): ScoringResult {
  const q1 = normalizeAnswer(answers.d2_1?.answer);
  const q2 = normalizeAnswer(answers.d2_2?.answer);
  const q3 = normalizeAnswer(answers.d2_3?.answer);
  const q4 = normalizeAnswer(answers.d2_4?.answer);
  const q5 = normalizeAnswer(answers.d2_5?.answer);

  if (q1 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Path: A1 -> if Y/PY -> C1
  if (isYesPY(q1)) {
    if (q4 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (q4 === 'SY') {
      if (q5 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R4' };
      }
      if (inSet(q5, 'Y', 'PY', 'NI')) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R4' };
      }
    }

    if (inSet(q4, 'WY', 'NI')) {
      if (q5 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R3' };
      }
      if (inSet(q5, 'Y', 'PY', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R3' };
      }
    }

    if (isNoPPN(q4)) {
      if (q5 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2.R1' };
      }
      if (inSet(q5, 'Y', 'PY', 'NI')) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R2' };
      }
    }
  }

  // Path: A1 -> if N/PN/NI -> A2
  if (isNoPPNNI(q1)) {
    if (q2 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (isYesPY(q2)) {
      if (q4 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (q4 === 'SY') {
        if (q5 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q5)) {
          return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R4' };
        }
        if (inSet(q5, 'Y', 'PY', 'NI')) {
          return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R4' };
        }
      }

      if (inSet(q4, 'WY', 'NI')) {
        if (q5 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q5)) {
          return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R3' };
        }
        if (inSet(q5, 'Y', 'PY', 'NI')) {
          return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R3' };
        }
      }

      if (isNoPPN(q4)) {
        if (q5 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q5)) {
          return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2.R5' };
        }
        if (inSet(q5, 'Y', 'PY', 'NI')) {
          return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R2' };
        }
      }
    }

    if (isNoPPNNI(q2)) {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (isNoPPN(q3)) {
        if (q4 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (inSet(q4, 'SY', 'WY', 'NI')) {
          return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R7' };
        }
        if (isNoPPN(q4)) {
          if (q5 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isNoPPN(q5)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R7' };
          }
          if (inSet(q5, 'Y', 'PY', 'NI')) {
            return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R7' };
          }
        }
      }

      if (inSet(q3, 'SY', 'WY', 'NI')) {
        if (q4 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (q4 === 'SY') {
          if (q5 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isNoPPN(q5)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R6' };
          }
          if (inSet(q5, 'Y', 'PY', 'NI')) {
            return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R6' };
          }
        }
        if (isNoPPN(q4)) {
          if (q5 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isNoPPN(q5)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R6' };
          }
          if (inSet(q5, 'Y', 'PY', 'NI')) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R6' };
          }
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

interface PartResult {
  result: string | null;
  isComplete: boolean;
}

/**
 * Score Domain 3 Part A (Selection bias - prevalent user bias and immortal time)
 */
function scoreDomain3PartA(answers: DomainAnswers): PartResult {
  const q1 = normalizeAnswer(answers.d3_1?.answer);
  const q2 = normalizeAnswer(answers.d3_2?.answer);

  if (q1 === null) {
    return { result: null, isComplete: false };
  }

  if (q1 === 'SN') {
    return { result: 'Serious', isComplete: true };
  }

  if (inSet(q1, 'WN', 'NI')) {
    return { result: 'Moderate', isComplete: true };
  }

  if (isYesPY(q1)) {
    if (q2 === null) {
      return { result: null, isComplete: false };
    }
    if (isNoPPNNI(q2)) {
      return { result: 'Low', isComplete: true };
    }
    if (isYesPY(q2)) {
      return { result: 'Moderate', isComplete: true };
    }
  }

  return { result: null, isComplete: q2 !== null };
}

/**
 * Score Domain 3 Part B (Selection bias - other types)
 */
function scoreDomain3PartB(answers: DomainAnswers): PartResult {
  const q3 = normalizeAnswer(answers.d3_3?.answer);
  const q4 = normalizeAnswer(answers.d3_4?.answer);
  const q5 = normalizeAnswer(answers.d3_5?.answer);

  if (q3 === null) {
    return { result: null, isComplete: false };
  }

  if (isNoPPN(q3)) {
    return { result: 'Low', isComplete: true };
  }

  if (q3 === 'NI') {
    return { result: 'Moderate', isComplete: true };
  }

  if (isYesPY(q3)) {
    if (q4 === null) {
      return { result: null, isComplete: false };
    }

    if (isNoPPN(q4)) {
      return { result: 'Low', isComplete: true };
    }

    if (q4 === 'NI') {
      return { result: 'Moderate', isComplete: true };
    }

    if (isYesPY(q4)) {
      if (q5 === null) {
        return { result: null, isComplete: false };
      }
      if (isNoPPNNI(q5)) {
        return { result: 'Moderate', isComplete: true };
      }
      if (isYesPY(q5)) {
        return { result: 'Serious', isComplete: true };
      }
    }
  }

  const allAnswered = [q3, q4, q5].every(a => a !== null);
  return { result: null, isComplete: allAnswered };
}

/**
 * Score Domain 3 Final (combines Part A + Part B with correction questions)
 */
function scoreDomain3(answers: DomainAnswers): ScoringResult {
  const partA = scoreDomain3PartA(answers);
  const partB = scoreDomain3PartB(answers);

  if (!partA.isComplete || !partB.isComplete) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  const q6 = normalizeAnswer(answers.d3_6?.answer);
  const q7 = normalizeAnswer(answers.d3_7?.answer);
  const q8 = normalizeAnswer(answers.d3_8?.answer);

  const rankMap: Record<string, number> = { Low: 0, Moderate: 1, Serious: 2 };
  const aRank = rankMap[partA.result || ''] ?? 0;
  const bRank = rankMap[partB.result || ''] ?? 0;
  const worstRank = Math.max(aRank, bRank);

  if (partA.result === 'Low' && partB.result === 'Low') {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D3.R1' };
  }

  if (worstRank <= 1) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R2' };
  }

  if (worstRank >= 2) {
    if (isYesPY(q6)) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R3' };
    }

    if (isNoPPNNI(q6)) {
      if (isYesPY(q7)) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R3' };
      }

      if (isNoPPNNI(q7)) {
        if (q8 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPNNI(q8)) {
          return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D3.R4' };
        }
        if (isYesPY(q8)) {
          return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D3.R5' };
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 4 (Bias due to missing data)
 */
function scoreDomain4(answers: DomainAnswers): ScoringResult {
  const q1 = normalizeAnswer(answers.d4_1?.answer);
  const q2 = normalizeAnswer(answers.d4_2?.answer);
  const q3 = normalizeAnswer(answers.d4_3?.answer);
  const q4 = normalizeAnswer(answers.d4_4?.answer);
  const q5 = normalizeAnswer(answers.d4_5?.answer);
  const q6 = normalizeAnswer(answers.d4_6?.answer);
  const q7 = normalizeAnswer(answers.d4_7?.answer);
  const q8 = normalizeAnswer(answers.d4_8?.answer);
  const q9 = normalizeAnswer(answers.d4_9?.answer);
  const q10 = normalizeAnswer(answers.d4_10?.answer);
  const q11 = normalizeAnswer(answers.d4_11?.answer);

  const completeDataAnswered = [q1, q2, q3].every(a => a !== null);
  if (!completeDataAnswered) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  const allCompleteData = [q1, q2, q3].every(a => isYesPY(a));

  if (allCompleteData) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R1' };
  }

  if ([q1, q2, q3].some(a => isNoPPNNI(a))) {
    if (q4 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Complete-case path
    if (isYesPY(q4) || q4 === 'NI') {
      if (q5 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R2' };
      }

      if (isYesPY(q5) || q5 === 'NI') {
        if (q6 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        if (isYesPY(q6)) {
          if (q11 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R3' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R4' };
          }
        }

        if (inSet(q6, 'WN', 'NI')) {
          if (q11 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
          }
        }

        if (q6 === 'SN') {
          if (q11 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D4.R8' };
          }
        }
      }
    }

    // Imputation/alternative method path
    if (isNoPPN(q4)) {
      if (q7 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // Imputation path
      if (isYesPY(q7)) {
        if (q8 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        if (isYesPY(q8)) {
          if (q9 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q9)) {
            return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R5' };
          }
          if (inSet(q9, 'WN', 'NI')) {
            if (q11 === null) {
              return { judgement: null, isComplete: false, ruleId: null };
            }
            if (isYesPY(q11)) {
              return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
            }
            if (isNoPPN(q11)) {
              return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
            }
          }
          if (q9 === 'SN') {
            if (q11 === null) {
              return { judgement: null, isComplete: false, ruleId: null };
            }
            if (isYesPY(q11)) {
              return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
            }
            if (isNoPPN(q11)) {
              return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D4.R8' };
            }
          }
        }

        if (isNoPPNNI(q8)) {
          if (q11 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
          }
        }
      }

      // Alternative method path
      if (isNoPPNNI(q7)) {
        if (q10 === null) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isYesPY(q10)) {
          return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R2' };
        }
        if (inSet(q10, 'WN', 'NI')) {
          if (q11 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
          }
        }
        if (q10 === 'SN') {
          if (q11 === null) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D4.R8' };
          }
        }
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 5 (Bias in measurement of the outcome)
 */
function scoreDomain5(answers: DomainAnswers): ScoringResult {
  const q1 = normalizeAnswer(answers.d5_1?.answer);
  const q2 = normalizeAnswer(answers.d5_2?.answer);
  const q3 = normalizeAnswer(answers.d5_3?.answer);

  if (q1 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R1' };
  }

  if (isNoPPN(q1)) {
    if (q2 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (isNoPPN(q2)) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D5.R2' };
    }

    if (inSet(q2, 'Y', 'PY', 'NI')) {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q3)) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D5.R3' };
      }
      if (inSet(q3, 'WY', 'NI')) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R4' };
      }
      if (q3 === 'SY') {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R5' };
      }
    }
  }

  if (q1 === 'NI') {
    if (q2 === null) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    if (isNoPPN(q2)) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R6' };
    }

    if (inSet(q2, 'Y', 'PY', 'NI')) {
      if (q3 === null) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (inSet(q3, 'WY', 'N', 'PN', 'NI')) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R7' };
      }
      if (q3 === 'SY') {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R7' };
      }
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 6 (Bias in selection of the reported result)
 */
function scoreDomain6(answers: DomainAnswers): ScoringResult {
  const q1 = normalizeAnswer(answers.d6_1?.answer);
  const q2 = normalizeAnswer(answers.d6_2?.answer);
  const q3 = normalizeAnswer(answers.d6_3?.answer);
  const q4 = normalizeAnswer(answers.d6_4?.answer);

  if (q1 === null) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D6.R1' };
  }

  if (isNoPPNNI(q1)) {
    const selectionQuestions = [q2, q3, q4];
    const allSelectionAnswered = selectionQuestions.every(a => a !== null);

    if (!allSelectionAnswered) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    const yesCount = selectionQuestions.filter(a => isYesPY(a)).length;
    const hasNI = selectionQuestions.some(a => a === 'NI');
    const allNI = selectionQuestions.every(a => a === 'NI');
    const allNPN = selectionQuestions.every(a => isNoPPN(a));

    if (allNPN) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D6.R2' };
    }

    if (yesCount === 0 && hasNI && !allNI) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D6.R3' };
    }

    if (yesCount === 1 || (yesCount === 0 && allNI)) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D6.R4' };
    }

    if (yesCount >= 2) {
      return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D6.R5' };
    }
  }

  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Main entry point: score a ROBINS-I domain
 */
export function scoreRobinsDomain(
  domainKey: string,
  answers: DomainAnswers | undefined,
  _options: { isPerProtocol?: boolean } = {},
): ScoringResult {
  if (!answers) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  switch (domainKey) {
    case 'domain1a':
      return scoreDomain1A(answers);
    case 'domain1b':
      return scoreDomain1B(answers);
    case 'domain2':
      return scoreDomain2(answers);
    case 'domain3':
      return scoreDomain3(answers);
    case 'domain4':
      return scoreDomain4(answers);
    case 'domain5':
      return scoreDomain5(answers);
    case 'domain6':
      return scoreDomain6(answers);
    default:
      return { judgement: null, isComplete: false, ruleId: null };
  }
}

interface DomainState {
  answers?: DomainAnswers;
  judgement?: Judgement | null;
  judgementSource?: 'auto' | 'manual';
  direction?: string | null;
}

/**
 * Get effective domain judgement (respects manual override)
 */
export function getEffectiveDomainJudgement(
  domainState: DomainState | undefined,
  autoScore: ScoringResult,
): Judgement | null {
  if (domainState?.judgementSource === 'manual' && domainState?.judgement) {
    return domainState.judgement;
  }
  return autoScore?.judgement || null;
}

interface ChecklistState {
  sectionC?: { isPerProtocol?: boolean };
  [domainKey: string]: DomainState | unknown;
}

interface DomainScoringInfo {
  auto: ScoringResult;
  effective: Judgement | null;
  source: 'auto' | 'manual';
  isOverridden: boolean;
}

interface AllDomainsResult {
  domains: Record<string, DomainScoringInfo>;
  overall: Judgement | null;
  isComplete: boolean;
}

/**
 * Score all active domains and return a summary
 */
export function scoreAllDomains(checklistState: ChecklistState | null): AllDomainsResult {
  if (!checklistState) {
    return { domains: {}, overall: null, isComplete: false };
  }

  const isPerProtocol = checklistState.sectionC?.isPerProtocol || false;
  const activeDomainKeys =
    isPerProtocol ?
      ['domain1b', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6']
    : ['domain1a', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6'];

  const domains: Record<string, DomainScoringInfo> = {};
  const effectiveJudgements: Judgement[] = [];

  for (const domainKey of activeDomainKeys) {
    const domainState = checklistState[domainKey] as DomainState | undefined;
    const auto = scoreRobinsDomain(domainKey, domainState?.answers, { isPerProtocol });
    const effective = getEffectiveDomainJudgement(domainState, auto);
    const source = domainState?.judgementSource || 'auto';

    domains[domainKey] = {
      auto,
      effective,
      source,
      isOverridden: source === 'manual' && effective !== auto.judgement,
    };

    if (effective) {
      effectiveJudgements.push(effective);
    }
  }

  let overall: Judgement | null = null;
  if (effectiveJudgements.length === activeDomainKeys.length) {
    if (effectiveJudgements.includes(JUDGEMENTS.CRITICAL)) {
      overall = JUDGEMENTS.CRITICAL;
    } else if (effectiveJudgements.includes(JUDGEMENTS.SERIOUS)) {
      overall = JUDGEMENTS.SERIOUS;
    } else if (effectiveJudgements.includes(JUDGEMENTS.MODERATE)) {
      overall = JUDGEMENTS.MODERATE;
    } else {
      overall = JUDGEMENTS.LOW;
    }
  }

  return { domains, overall, isComplete: effectiveJudgements.length === activeDomainKeys.length };
}

// Overall risk of bias display strings for UI
export const OVERALL_DISPLAY = {
  LOW_EXCEPT_CONFOUNDING: 'Low risk of bias except for concerns about uncontrolled confounding',
  MODERATE: 'Moderate risk',
  SERIOUS: 'Serious risk',
  CRITICAL: 'Critical risk',
} as const;

/**
 * Map internal overall judgement to the OVERALL_ROB_JUDGEMENTS display strings
 */
export function mapOverallJudgementToDisplay(judgement: Judgement | null): string | null {
  switch (judgement) {
    case JUDGEMENTS.LOW:
    case JUDGEMENTS.LOW_EXCEPT_CONFOUNDING:
      return OVERALL_DISPLAY.LOW_EXCEPT_CONFOUNDING;
    case JUDGEMENTS.MODERATE:
      return OVERALL_DISPLAY.MODERATE;
    case JUDGEMENTS.SERIOUS:
      return OVERALL_DISPLAY.SERIOUS;
    case JUDGEMENTS.CRITICAL:
      return OVERALL_DISPLAY.CRITICAL;
    default:
      return null;
  }
}
