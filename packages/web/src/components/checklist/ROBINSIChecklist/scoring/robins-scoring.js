/**
 * ROBINS-I V2 Smart Scoring Engine
 *
 * Implements deterministic, table-driven scoring for all ROBINS-I domains
 * based on the official decision tables.
 */

// Helper: check if answer matches any value in a set
const inSet = (answer, ...values) => values.includes(answer);

// Normalization: treat NA as NI for scoring to avoid "stuck" branches
// (The mermaid decision diagrams generally model NI but omit NA.)
const normalizeAnswer = answer => (answer === 'NA' ? 'NI' : answer);

// Helper: check if answer is Yes or Probably Yes
const isYesPY = answer => inSet(answer, 'Y', 'PY');

// Helper: check if answer is No or Probably No
const isNoPPN = answer => inSet(answer, 'N', 'PN');

// Helper: check if answer is No, Probably No, or No Information
const isNoPPNNI = answer => inSet(answer, 'N', 'PN', 'NI');

// Canonical judgement values matching ROB_JUDGEMENTS in checklist-map.js
const JUDGEMENTS = {
  LOW: 'Low',
  LOW_EXCEPT_CONFOUNDING: 'Low (except for concerns about uncontrolled confounding)',
  MODERATE: 'Moderate',
  SERIOUS: 'Serious',
  CRITICAL: 'Critical',
};

/**
 * Score Domain 1A (Bias due to confounding - ITT effect)
 *
 * Questions: d1a_1, d1a_2, d1a_3, d1a_4
 * Flow from domain-1-a.md mermaid diagram
 */
function scoreDomain1A(answers) {
  const q1 = normalizeAnswer(answers.d1a_1?.answer); // 1.1 Controlled for all the important confounding factors?
  const q2 = normalizeAnswer(answers.d1a_2?.answer); // 1.2 Confounding factors measured validly and reliably?
  const q3 = normalizeAnswer(answers.d1a_3?.answer); // 1.3 Controlled for any post-intervention variables?
  const q4 = normalizeAnswer(answers.d1a_4?.answer); // 1.4 Negative controls etc suggest serious uncontrolled confounding?

  // Must have Q1 to start
  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Path: Q1 -> if SN/NI -> NC1 -> outcomes
  if (inSet(q1, 'SN', 'NI')) {
    if (q4 === null || q4 === undefined) {
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
    if (q3 === null || q3 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Q3a -> if Y/PY -> NC3
    if (isYesPY(q3)) {
      if (q4 === null || q4 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q4)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R5' };
      }
      if (isYesPY(q4)) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R4' };
      }
    }

    // Q3a -> if N/PN/NI -> Q2a
    if (isNoPPNNI(q3)) {
      if (q2 === null || q2 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // Q2a -> if SN/NI -> SER (terminal, no NC needed)
      if (inSet(q2, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R3' };
      }

      // Q2a -> if Y/PY or WN -> NC2
      if (isYesPY(q2) || q2 === 'WN') {
        if (q4 === null || q4 === undefined) {
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
    if (q3 === null || q3 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Q3b -> if Y/PY -> NC4
    if (isYesPY(q3)) {
      if (q4 === null || q4 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q4)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R6' };
      }
      if (isYesPY(q4)) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R7' };
      }
    }

    // Q3b -> if N/PN/NI -> Q2b
    if (isNoPPNNI(q3)) {
      if (q2 === null || q2 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // Q2b -> if SN/NI -> SER (terminal, no NC needed)
      if (inSet(q2, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R7' };
      }

      // Q2b -> if Y/PY/WN -> NC2
      if (isYesPY(q2) || q2 === 'WN') {
        if (q4 === null || q4 === undefined) {
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

  // Incomplete - need more answers
  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 1B (Bias due to confounding - Per-Protocol effect)
 *
 * Questions: d1b_1, d1b_2, d1b_3, d1b_4, d1b_5
 * Flow from domain-1-b.md mermaid diagram
 */
function scoreDomain1B(answers) {
  const q1 = normalizeAnswer(answers.d1b_1?.answer); // 1.1 Appropriate analysis method?
  const q2 = normalizeAnswer(answers.d1b_2?.answer); // 1.2 Controlled for all the important confounding factors?
  const q3 = normalizeAnswer(answers.d1b_3?.answer); // 1.3 Confounding factors measured validly and reliably?
  const q4 = normalizeAnswer(answers.d1b_4?.answer); // 1.4 Controlled for variables measured after start of intervention?
  const q5 = normalizeAnswer(answers.d1b_5?.answer); // 1.5 Negative controls etc suggest serious uncontrolled confounding?

  // Must have Q1 to start
  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Path: Q1 -> if N/PN/NI -> Q4
  if (isNoPPNNI(q1)) {
    if (q4 === null || q4 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Q4 -> if Y/PY -> CRIT (terminal, no NC needed)
    if (isYesPY(q4)) {
      return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1B.R6' };
    }

    // Q4 -> if N/PN/NI -> NC3
    if (isNoPPNNI(q4)) {
      if (q5 === null || q5 === undefined) {
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
    if (q2 === null || q2 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Q2 -> if SN/NI -> SER (terminal, no Q3 needed)
    if (inSet(q2, 'SN', 'NI')) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R5' };
    }

    // Q2 -> if Y/PY -> Q3a
    if (isYesPY(q2)) {
      if (q3 === null || q3 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // Q3a -> if SN/NI -> SER (terminal, no NC needed)
      if (inSet(q3, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R5' };
      }

      // Q3a -> if Y/PY -> NC1
      if (isYesPY(q3)) {
        if (q5 === null || q5 === undefined) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        if (isNoPPN(q5)) {
          return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D1B.R1' };
        }
        if (isYesPY(q5)) {
          return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1B.R2' };
        }
      }

      // Q3a -> if WN -> NC2
      if (q3 === 'WN') {
        if (q5 === null || q5 === undefined) {
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

    // Q2 -> if WN -> Q3b
    if (q2 === 'WN') {
      if (q3 === null || q3 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // Q3b -> if SN/NI -> SER (terminal, no NC needed)
      if (inSet(q3, 'SN', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R5' };
      }

      // Q3b -> if Y/PY/WN -> NC2
      if (isYesPY(q3) || q3 === 'WN') {
        if (q5 === null || q5 === undefined) {
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

  // Incomplete - need more answers
  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 2 (Bias in classification of interventions)
 *
 * Questions: d2_1, d2_2, d2_3, d2_4, d2_5
 * Flow from domain-2.md mermaid diagram
 */
function scoreDomain2(answers) {
  const q1 = normalizeAnswer(answers.d2_1?.answer); // 2.1 Intervention distinguishable at start of follow-up?
  const q2 = normalizeAnswer(answers.d2_2?.answer); // 2.2 Almost all outcome events after strategies distinguishable?
  const q3 = normalizeAnswer(answers.d2_3?.answer); // 2.3 Appropriate analysis?
  const q4 = normalizeAnswer(answers.d2_4?.answer); // 2.4 Classification of intervention influenced by outcome?
  const q5 = normalizeAnswer(answers.d2_5?.answer); // 2.5 Further classification errors likely?

  // Must have A1 (q1) to start
  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Path: A1 -> if Y/PY -> C1
  if (isYesPY(q1)) {
    if (q4 === null || q4 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // C1 -> if SY -> E3
    if (q4 === 'SY') {
      if (q5 === null || q5 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R4' };
      }
      if (inSet(q5, 'Y', 'PY', 'NI')) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R4' };
      }
    }

    // C1 -> if WY/NI -> E2
    if (inSet(q4, 'WY', 'NI')) {
      if (q5 === null || q5 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R3' };
      }
      if (inSet(q5, 'Y', 'PY', 'NI')) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R3' };
      }
    }

    // C1 -> if N/PN -> E1
    if (isNoPPN(q4)) {
      if (q5 === null || q5 === undefined) {
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
    if (q2 === null || q2 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // A2 -> if Y/PY -> C1 (same logic as above)
    if (isYesPY(q2)) {
      if (q4 === null || q4 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      if (q4 === 'SY') {
        if (q5 === null || q5 === undefined) {
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
        if (q5 === null || q5 === undefined) {
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
        if (q5 === null || q5 === undefined) {
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

    // A2 -> if N/PN/NI -> A3
    if (isNoPPNNI(q2)) {
      if (q3 === null || q3 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // A3 -> if N/PN -> C3
      if (isNoPPN(q3)) {
        if (q4 === null || q4 === undefined) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        // C3 -> if SY/WY/NI -> CRIT (terminal, no E needed)
        if (inSet(q4, 'SY', 'WY', 'NI')) {
          return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R7' };
        }
        // C3 -> if N/PN -> E3
        if (isNoPPN(q4)) {
          if (q5 === null || q5 === undefined) {
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

      // A3 -> if SY/WY/NI -> C2
      if (inSet(q3, 'SY', 'WY', 'NI')) {
        if (q4 === null || q4 === undefined) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        // C2 -> if SY -> E3
        if (q4 === 'SY') {
          if (q5 === null || q5 === undefined) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isNoPPN(q5)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R6' };
          }
          if (inSet(q5, 'Y', 'PY', 'NI')) {
            return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R6' };
          }
        }
        // C2 -> if N/PN -> E2
        if (isNoPPN(q4)) {
          if (q5 === null || q5 === undefined) {
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

  // Incomplete - need more answers
  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 3 Part A (Selection bias - prevalent user bias and immortal time)
 *
 * Questions: d3_1, d3_2
 * Flow from domain-3.md mermaid diagram Section A
 */
function scoreDomain3PartA(answers) {
  const q1 = normalizeAnswer(answers.d3_1?.answer); // 3.1 Participants followed from start of intervention?
  const q2 = normalizeAnswer(answers.d3_2?.answer); // 3.2 Early outcome events excluded?

  if (q1 === null || q1 === undefined) {
    return { result: null, isComplete: false };
  }

  // A1 -> if SN -> A_SER (Serious)
  if (q1 === 'SN') {
    return { result: 'Serious', isComplete: true };
  }

  // A1 -> if WN/NI -> A_MOD (Moderate)
  if (inSet(q1, 'WN', 'NI')) {
    return { result: 'Moderate', isComplete: true };
  }

  // A1 -> if Y/PY -> A2
  if (isYesPY(q1)) {
    if (q2 === null || q2 === undefined) {
      return { result: null, isComplete: false };
    }
    // A2 -> if N/PN/NI -> A_LOW (Low)
    if (isNoPPNNI(q2)) {
      return { result: 'Low', isComplete: true };
    }
    // A2 -> if Y/PY -> A_MOD (Moderate)
    if (isYesPY(q2)) {
      return { result: 'Moderate', isComplete: true };
    }
  }

  return { result: null, isComplete: q2 !== null && q2 !== undefined };
}

/**
 * Score Domain 3 Part B (Selection bias - other types)
 *
 * Questions: d3_3, d3_4, d3_5
 * Flow from domain-3.md mermaid diagram Section B
 */
function scoreDomain3PartB(answers) {
  const q3 = normalizeAnswer(answers.d3_3?.answer); // 3.3 Selection based on characteristics after start?
  const q4 = normalizeAnswer(answers.d3_4?.answer); // 3.4 Selection variables associated with intervention?
  const q5 = normalizeAnswer(answers.d3_5?.answer); // 3.5 Selection variables influenced by outcome?

  if (q3 === null || q3 === undefined) {
    return { result: null, isComplete: false };
  }

  // B1 -> if N/PN -> B_LOW1 (Low)
  if (isNoPPN(q3)) {
    return { result: 'Low', isComplete: true };
  }

  // B1 -> if NI -> B_MOD1 (Moderate)
  if (q3 === 'NI') {
    return { result: 'Moderate', isComplete: true };
  }

  // B1 -> if Y/PY -> B2
  if (isYesPY(q3)) {
    if (q4 === null || q4 === undefined) {
      return { result: null, isComplete: false };
    }

    // B2 -> if N/PN -> B_LOW2 (Low)
    if (isNoPPN(q4)) {
      return { result: 'Low', isComplete: true };
    }

    // B2 -> if NI -> B_MOD2 (Moderate)
    if (q4 === 'NI') {
      return { result: 'Moderate', isComplete: true };
    }

    // B2 -> if Y/PY -> B3
    if (isYesPY(q4)) {
      if (q5 === null || q5 === undefined) {
        return { result: null, isComplete: false };
      }
      // B3 -> if N/PN/NI -> B_MOD3 (Moderate)
      if (isNoPPNNI(q5)) {
        return { result: 'Moderate', isComplete: true };
      }
      // B3 -> if Y/PY -> B_SER (Serious)
      if (isYesPY(q5)) {
        return { result: 'Serious', isComplete: true };
      }
    }
  }

  const allAnswered = [q3, q4, q5].every(a => a !== null && a !== undefined);
  return { result: null, isComplete: allAnswered };
}

/**
 * Score Domain 3 Final (combines Part A + Part B with correction questions)
 *
 * Questions: d3_6, d3_7, d3_8
 * Flow from domain-3.md mermaid diagram - combines Section A and B, then applies corrections
 */
function scoreDomain3(answers) {
  const partA = scoreDomain3PartA(answers);
  const partB = scoreDomain3PartB(answers);

  // If either part is incomplete, domain is incomplete
  if (!partA.isComplete || !partB.isComplete) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  const q6 = normalizeAnswer(answers.d3_6?.answer); // 3.6 Analysis corrected for selection biases?
  const q7 = normalizeAnswer(answers.d3_7?.answer); // 3.7 Sensitivity analyses demonstrate minimal impact?
  const q8 = normalizeAnswer(answers.d3_8?.answer); // 3.8 Selection biases severe?

  // Determine combined result: All LOW, At worst MODERATE, or At least one SERIOUS
  const rankMap = { Low: 0, Moderate: 1, Serious: 2 };
  const aRank = rankMap[partA.result] ?? 0;
  const bRank = rankMap[partB.result] ?? 0;
  const worstRank = Math.max(aRank, bRank);

  // All LOW -> LOW_RISK (terminal, no correction questions needed)
  if (partA.result === 'Low' && partB.result === 'Low') {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D3.R1' };
  }

  // At worst MODERATE -> MOD_RISK (terminal, no correction questions needed)
  if (worstRank <= 1) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R2' };
  }

  // At least one SERIOUS -> need correction/sensitivity questions
  if (worstRank >= 2) {
    // C1 (3.6) -> if Y/PY -> MOD_RISK
    if (isYesPY(q6)) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R3' };
    }

    // C1 -> if N/PN/NI -> C2 (3.7)
    if (isNoPPNNI(q6)) {
      // C2 -> if Y/PY -> MOD_RISK
      if (isYesPY(q7)) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R3' };
      }

      // C2 -> if N/PN/NI -> C3 (3.8)
      if (isNoPPNNI(q7)) {
        if (q8 === null || q8 === undefined) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        // C3 -> if N/PN/NI -> SER_RISK
        if (isNoPPNNI(q8)) {
          return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D3.R4' };
        }
        // C3 -> if Y/PY -> CRIT_RISK
        if (isYesPY(q8)) {
          return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D3.R5' };
        }
      }
    }
  }

  // Need more answers for final determination
  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 4 (Bias due to missing data)
 *
 * Questions: d4_1 through d4_11
 * Flow from domain-4.md mermaid diagram
 */
function scoreDomain4(answers) {
  const q1 = normalizeAnswer(answers.d4_1?.answer); // 4.1 Complete data on intervention
  const q2 = normalizeAnswer(answers.d4_2?.answer); // 4.2 Complete data on outcome
  const q3 = normalizeAnswer(answers.d4_3?.answer); // 4.3 Complete data on confounders
  const q4 = normalizeAnswer(answers.d4_4?.answer); // 4.4 Complete-case analysis?
  const q5 = normalizeAnswer(answers.d4_5?.answer); // 4.5 Exclusion related to true outcome?
  const q6 = normalizeAnswer(answers.d4_6?.answer); // 4.6 Outcome–missingness relationship explained by model?
  const q7 = normalizeAnswer(answers.d4_7?.answer); // 4.7 Analysis based on imputation?
  const q8 = normalizeAnswer(answers.d4_8?.answer); // 4.8 MAR/MCAR reasonable?
  const q9 = normalizeAnswer(answers.d4_9?.answer); // 4.9 Appropriate imputation?
  const q10 = normalizeAnswer(answers.d4_10?.answer); // 4.10 Alternative appropriate method?
  const q11 = normalizeAnswer(answers.d4_11?.answer); // 4.11 Evidence result not biased?

  // A: Check 4.1-4.3 complete data
  const completeDataAnswered = [q1, q2, q3].every(a => a !== null && a !== undefined);
  if (!completeDataAnswered) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  const allCompleteData = [q1, q2, q3].every(a => isYesPY(a));

  // A -> if All Y/PY -> LOW1 (terminal)
  if (allCompleteData) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R1' };
  }

  // A -> if Any N/PN/NI -> B (4.4)
  if ([q1, q2, q3].some(a => isNoPPNNI(a))) {
    if (q4 === null || q4 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // B -> if Y/PY/NI -> C (4.5) - complete-case path
    if (isYesPY(q4) || q4 === 'NI') {
      if (q5 === null || q5 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // C -> if N/PN -> LOW2 (terminal)
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R2' };
      }

      // C -> if Y/PY/NI -> E (4.6)
      if (isYesPY(q5) || q5 === 'NI') {
        if (q6 === null || q6 === undefined) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        // E -> if Y/PY -> F1 (4.11)
        if (isYesPY(q6)) {
          if (q11 === null || q11 === undefined) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R3' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R4' };
          }
        }

        // E -> if WN/NI -> F2 (4.11)
        if (inSet(q6, 'WN', 'NI')) {
          if (q11 === null || q11 === undefined) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
          }
        }

        // E -> if SN -> F3 (4.11)
        if (q6 === 'SN') {
          if (q11 === null || q11 === undefined) {
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

    // B -> if N/PN -> D (4.7) - imputation/alternative method path
    if (isNoPPN(q4)) {
      if (q7 === null || q7 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }

      // D -> if Y/PY -> G (4.8) - imputation path
      if (isYesPY(q7)) {
        if (q8 === null || q8 === undefined) {
          return { judgement: null, isComplete: false, ruleId: null };
        }

        // G -> if Y/PY -> I (4.9)
        if (isYesPY(q8)) {
          if (q9 === null || q9 === undefined) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          // I -> if Y/PY -> LOW3 (terminal)
          if (isYesPY(q9)) {
            return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R5' };
          }
          // I -> if WN/NI -> F2 (4.11)
          if (inSet(q9, 'WN', 'NI')) {
            if (q11 === null || q11 === undefined) {
              return { judgement: null, isComplete: false, ruleId: null };
            }
            if (isYesPY(q11)) {
              return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
            }
            if (isNoPPN(q11)) {
              return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
            }
          }
          // I -> if SN -> F3 (4.11)
          if (q9 === 'SN') {
            if (q11 === null || q11 === undefined) {
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

        // G -> if N/PN/NI -> F2 (4.11)
        if (isNoPPNNI(q8)) {
          if (q11 === null || q11 === undefined) {
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

      // D -> if N/PN/NI -> H (4.10) - alternative method path
      if (isNoPPNNI(q7)) {
        if (q10 === null || q10 === undefined) {
          return { judgement: null, isComplete: false, ruleId: null };
        }
        // H -> if Y/PY -> LOW4 (terminal)
        if (isYesPY(q10)) {
          return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R2' };
        }
        // H -> if WN/NI -> F2 (4.11)
        if (inSet(q10, 'WN', 'NI')) {
          if (q11 === null || q11 === undefined) {
            return { judgement: null, isComplete: false, ruleId: null };
          }
          if (isYesPY(q11)) {
            return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
          }
          if (isNoPPN(q11)) {
            return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
          }
        }
        // H -> if SN -> F3 (4.11)
        if (q10 === 'SN') {
          if (q11 === null || q11 === undefined) {
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

  // Incomplete - need more answers
  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 5 (Bias in measurement of the outcome)
 *
 * Questions: d5_1, d5_2, d5_3
 * Flow from domain-5.md mermaid diagram
 */
function scoreDomain5(answers) {
  const q1 = normalizeAnswer(answers.d5_1?.answer); // 5.1 Measurement of outcome differs by intervention?
  const q2 = normalizeAnswer(answers.d5_2?.answer); // 5.2 Outcome assessors aware of intervention received?
  const q3 = normalizeAnswer(answers.d5_3?.answer); // 5.3 Assessment could be influenced by knowledge of intervention?

  // Must have Q1 to start
  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Q1 -> if Y/PY -> SER (terminal, no Q2/Q3 needed)
  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R1' };
  }

  // Q1 -> if N/PN -> Q2a
  if (isNoPPN(q1)) {
    if (q2 === null || q2 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Q2a -> if N/PN -> LOW (terminal, no Q3 needed)
    if (isNoPPN(q2)) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D5.R2' };
    }

    // Q2a -> if Y/PY/NI -> Q3a
    if (inSet(q2, 'Y', 'PY', 'NI')) {
      if (q3 === null || q3 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      // Q3a -> if N/PN -> LOW
      if (isNoPPN(q3)) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D5.R3' };
      }
      // Q3a -> if WY/NI -> MOD
      if (inSet(q3, 'WY', 'NI')) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R4' };
      }
      // Q3a -> if SY -> SER
      if (q3 === 'SY') {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R5' };
      }
    }
  }

  // Q1 -> if NI -> Q2b
  if (q1 === 'NI') {
    if (q2 === null || q2 === undefined) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Q2b -> if N/PN -> MOD (terminal, no Q3 needed)
    if (isNoPPN(q2)) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R6' };
    }

    // Q2b -> if Y/PY/NI -> Q3b
    if (inSet(q2, 'Y', 'PY', 'NI')) {
      if (q3 === null || q3 === undefined) {
        return { judgement: null, isComplete: false, ruleId: null };
      }
      // Q3b -> if WY/N/PN/NI -> MOD
      if (inSet(q3, 'WY', 'N', 'PN', 'NI')) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R7' };
      }
      // Q3b -> if SY -> SER
      if (q3 === 'SY') {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R7' };
      }
    }
  }

  // Incomplete - need more answers
  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Score Domain 6 (Bias in selection of the reported result)
 *
 * Questions: d6_1, d6_2, d6_3, d6_4
 * Flow from domain-6.md mermaid diagram
 */
function scoreDomain6(answers) {
  const q1 = normalizeAnswer(answers.d6_1?.answer); // 6.1 Result reported according to analysis plan?
  const q2 = normalizeAnswer(answers.d6_2?.answer); // 6.2 Multiple outcome measurements?
  const q3 = normalizeAnswer(answers.d6_3?.answer); // 6.3 Multiple analyses of the data?
  const q4 = normalizeAnswer(answers.d6_4?.answer); // 6.4 Multiple subgroups?

  // Must have Q1 to start
  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Q1 -> if Y/PY -> LOW (terminal, no selection questions needed)
  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D6.R1' };
  }

  // Q1 -> if N/PN/NI -> SEL (aggregated from 6.2-6.4)
  if (isNoPPNNI(q1)) {
    // Check if selection questions are answered
    const selectionQuestions = [q2, q3, q4];
    const allSelectionAnswered = selectionQuestions.every(a => a !== null && a !== undefined);

    if (!allSelectionAnswered) {
      return { judgement: null, isComplete: false, ruleId: null };
    }

    // Count Y/PY and NI among selection questions
    const yesCount = selectionQuestions.filter(a => isYesPY(a)).length;
    const hasNI = selectionQuestions.some(a => a === 'NI');
    const allNI = selectionQuestions.every(a => a === 'NI');
    const allNPN = selectionQuestions.every(a => isNoPPN(a));

    // SEL -> if All N/PN -> LOW
    if (allNPN) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D6.R2' };
    }

    // SEL -> if At least one NI, but none Y/PY -> MOD
    // (This means: hasNI is true, yesCount is 0, but not all NI)
    if (yesCount === 0 && hasNI && !allNI) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D6.R3' };
    }

    // SEL -> if One Y/PY, or all NI -> SER
    if (yesCount === 1 || (yesCount === 0 && allNI)) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D6.R4' };
    }

    // SEL -> if Two or more Y/PY -> CRIT
    if (yesCount >= 2) {
      return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D6.R5' };
    }
  }

  // Incomplete - need more answers
  return { judgement: null, isComplete: false, ruleId: null };
}

/**
 * Main entry point: score a ROBINS-I domain
 *
 * @param {string} domainKey - e.g., 'domain1a', 'domain1b', 'domain2', etc.
 * @param {Object} answers - The domain's answers object { questionKey: { answer, comment } }
 * @param {Object} options - Additional options
 * @param {boolean} options.isPerProtocol - Whether this is per-protocol analysis (for domain1)
 * @returns {Object} { judgement, isComplete, ruleId }
 */
export function scoreRobinsDomain(domainKey, answers, _options = {}) {
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

/**
 * Get effective domain judgement (respects manual override)
 *
 * @param {Object} domainState - The domain state { answers, judgement, judgementSource, direction }
 * @param {Object} autoScore - Result from scoreRobinsDomain
 * @returns {string|null} The effective judgement
 */
export function getEffectiveDomainJudgement(domainState, autoScore) {
  if (domainState?.judgementSource === 'manual' && domainState?.judgement) {
    return domainState.judgement;
  }
  return autoScore?.judgement || null;
}

/**
 * Score all active domains and return a summary
 *
 * @param {Object} checklistState - Full checklist state
 * @returns {Object} { domains: { [key]: { auto, effective, source } }, overall }
 */
export function scoreAllDomains(checklistState) {
  if (!checklistState) {
    return { domains: {}, overall: null };
  }

  const isPerProtocol = checklistState.sectionC?.isPerProtocol || false;
  const activeDomainKeys =
    isPerProtocol ?
      ['domain1b', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6']
    : ['domain1a', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6'];

  const domains = {};
  const effectiveJudgements = [];

  for (const domainKey of activeDomainKeys) {
    const domainState = checklistState[domainKey];
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

  // Calculate overall from effective judgements
  let overall = null;
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

/**
 * Map internal overall judgement to the OVERALL_ROB_JUDGEMENTS display strings
 */
export function mapOverallJudgementToDisplay(judgement) {
  switch (judgement) {
    case JUDGEMENTS.LOW:
    case JUDGEMENTS.LOW_EXCEPT_CONFOUNDING:
      return 'Low risk of bias except for concerns about uncontrolled confounding';
    case JUDGEMENTS.MODERATE:
      return 'Moderate risk';
    case JUDGEMENTS.SERIOUS:
      return 'Serious risk';
    case JUDGEMENTS.CRITICAL:
      return 'Critical risk';
    default:
      return null;
  }
}

export { JUDGEMENTS };
