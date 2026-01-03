/**
 * ROBINS-I V2 Smart Scoring Engine
 *
 * Implements deterministic, table-driven scoring for all ROBINS-I domains
 * based on the official decision tables.
 */

// Helper: check if answer matches any value in a set
const inSet = (answer, ...values) => values.includes(answer);

// Helper: check if answer is Yes or Probably Yes
const isYesPY = answer => inSet(answer, 'Y', 'PY');

// Helper: check if answer is No or Probably No
const isNoPPN = answer => inSet(answer, 'N', 'PN');

// Helper: check if answer is No, Probably No, or No Information
const isNoPPNNI = answer => inSet(answer, 'N', 'PN', 'NI');

// Helper: check for "don't care" condition (matches anything) - intentionally unused as placeholder
const _isDontCare = () => true;

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
 * Table from table.md
 */
function scoreDomain1A(answers) {
  const q1 = answers.d1a_1?.answer; // All confounders controlled
  const q2 = answers.d1a_2?.answer; // Confounders measured validly
  const q3 = answers.d1a_3?.answer; // Post-intervention vars controlled
  const q4 = answers.d1a_4?.answer; // Evidence of uncontrolled confounding

  // Check if we have enough answers
  const requiredForBasic = [q1, q4];
  if (requiredForBasic.some(a => a === null || a === undefined)) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Rule 1: Y/PY, N/PN/NI, Y/PY/WN, N/PN -> Low (except uncontrolled)
  if (isYesPY(q1) && isNoPPNNI(q3) && inSet(q2, 'Y', 'PY', 'WN') && isNoPPN(q4)) {
    return { judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING, isComplete: true, ruleId: 'D1A.R1' };
  }

  // Rule 2: Y/PY, N/PN/NI, Y/PY/WN, Y/PY -> Moderate
  if (isYesPY(q1) && isNoPPNNI(q3) && inSet(q2, 'Y', 'PY', 'WN') && isYesPY(q4)) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1A.R2' };
  }

  // Rule 3: Y/PY, N/PN/NI, SN/NI, — -> Serious
  if (isYesPY(q1) && isNoPPNNI(q3) && inSet(q2, 'SN', 'NI')) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R3' };
  }

  // Rule 4: Y/PY, Y/PY, —, Y/PY -> Critical
  if (isYesPY(q1) && isYesPY(q3) && isYesPY(q4)) {
    return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R4' };
  }

  // Rule 5: Y/PY, Y/PY, —, N/PN -> Serious
  if (isYesPY(q1) && isYesPY(q3) && isNoPPN(q4)) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R5' };
  }

  // Rule 6: WN, N/PN/NI, Y/PY, Y/PY -> Moderate
  if (q1 === 'WN' && isNoPPNNI(q3) && isYesPY(q2) && isYesPY(q4)) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1A.R6' };
  }

  // Rule 7: WN, N/PN/NI, SN/NI, — -> Serious
  if (q1 === 'WN' && isNoPPNNI(q3) && inSet(q2, 'SN', 'NI')) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R7' };
  }

  // Rule 8: SN/NI, —, —, Y/PY -> Critical
  if (inSet(q1, 'SN', 'NI') && isYesPY(q4)) {
    return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1A.R8' };
  }

  // Rule 9: SN/NI, —, —, N/PN -> Serious
  if (inSet(q1, 'SN', 'NI') && isNoPPN(q4)) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1A.R9' };
  }

  // No rule matched - check if more answers needed
  const allAnswered = [q1, q2, q3, q4].every(a => a !== null && a !== undefined);
  return { judgement: null, isComplete: allAnswered, ruleId: null };
}

/**
 * Score Domain 1B (Bias due to confounding - Per-Protocol effect)
 *
 * Questions: d1b_1, d1b_2, d1b_3, d1b_4, d1b_5
 * Table from table (1).md
 */
function scoreDomain1B(answers) {
  const q1 = answers.d1b_1?.answer; // Appropriate analysis
  const q2 = answers.d1b_2?.answer; // All confounders controlled
  const q3 = answers.d1b_3?.answer; // Confounders measured validly
  const q4 = answers.d1b_4?.answer; // Post-intervention vars controlled
  const q5 = answers.d1b_5?.answer; // Uncontrolled confounding

  // Check if we have the key answers
  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Rule 1: Y/PY, Y/PY, Y/PY, —, N/PN -> Low
  if (isYesPY(q1) && isYesPY(q2) && isYesPY(q3) && isNoPPN(q5)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D1B.R1' };
  }

  // Rule 2: Y/PY, Y/PY, Y/PY, —, Y/PY -> Moderate
  if (isYesPY(q1) && isYesPY(q2) && isYesPY(q3) && isYesPY(q5)) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1B.R2' };
  }

  // Rule 3: Y/PY, WN, Y/PY/WN, —, N/PN -> Low (except uncontrolled)
  if (isYesPY(q1) && q2 === 'WN' && inSet(q3, 'Y', 'PY', 'WN') && isNoPPN(q5)) {
    return { judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING, isComplete: true, ruleId: 'D1B.R3' };
  }

  // Rule 4: Y/PY, WN, Y/PY/WN, —, Y/PY -> Moderate
  if (isYesPY(q1) && q2 === 'WN' && inSet(q3, 'Y', 'PY', 'WN') && isYesPY(q5)) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D1B.R4' };
  }

  // Rule 5: Y/PY, SN/NI, —, —, — -> Serious
  if (isYesPY(q1) && inSet(q2, 'SN', 'NI')) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R5' };
  }

  // Rule 6: N/PN/NI, —, —, Y/PY, — -> Critical
  if (isNoPPNNI(q1) && isYesPY(q4)) {
    return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1B.R6' };
  }

  // Rule 7: N/PN/NI, —, —, N/PN/NI, Y/PY -> Critical
  if (isNoPPNNI(q1) && isNoPPNNI(q4) && isYesPY(q5)) {
    return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D1B.R7' };
  }

  // Rule 8: N/PN/NI, —, —, N/PN/NI, N/PN -> Serious
  if (isNoPPNNI(q1) && isNoPPNNI(q4) && isNoPPN(q5)) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D1B.R8' };
  }

  // No rule matched
  const allAnswered = [q1, q2, q3, q4, q5].every(a => a !== null && a !== undefined);
  return { judgement: null, isComplete: allAnswered, ruleId: null };
}

/**
 * Score Domain 2 (Bias in classification of interventions)
 *
 * Questions: d2_1, d2_2, d2_3, d2_4, d2_5
 * Table from table (2).md
 */
function scoreDomain2(answers) {
  const q1 = answers.d2_1?.answer; // Distinguishable at start
  const q2 = answers.d2_2?.answer; // Outcomes distinguishable
  const q3 = answers.d2_3?.answer; // Appropriate analysis
  const q4 = answers.d2_4?.answer; // Outcome-dependent classification
  const q5 = answers.d2_5?.answer; // Further errors

  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Rule 1: Y/PY, —, —, N/PN, N/PN -> Low
  if (isYesPY(q1) && isNoPPN(q4) && isNoPPN(q5)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2.R1' };
  }

  // Rule 2: Y/PY, —, —, N/PN, Y/PY/NI -> Moderate
  if (isYesPY(q1) && isNoPPN(q4) && inSet(q5, 'Y', 'PY', 'NI')) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R2' };
  }

  // Rule 3: Y/PY, —, —, WY/NI, N/PN -> Moderate
  if (isYesPY(q1) && inSet(q4, 'WY', 'NI') && isNoPPN(q5)) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D2.R3' };
  }

  // Rule 4: Y/PY, —, —, SY, — -> Serious
  if (isYesPY(q1) && q4 === 'SY') {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R4' };
  }

  // Rule 5: N/PN/NI, Y/PY, —, N/PN, N/PN -> Low
  if (isNoPPNNI(q1) && isYesPY(q2) && isNoPPN(q4) && isNoPPN(q5)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D2.R5' };
  }

  // Rule 6: N/PN/NI, N/PN/NI, Y/PY, WY/NI, Y/PY/NI -> Serious
  if (
    isNoPPNNI(q1) &&
    isNoPPNNI(q2) &&
    isYesPY(q3) &&
    inSet(q4, 'WY', 'NI') &&
    inSet(q5, 'Y', 'PY', 'NI')
  ) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D2.R6' };
  }

  // Rule 7: N/PN/NI, N/PN/NI, N/PN, SY/WY/NI, — -> Critical
  if (isNoPPNNI(q1) && isNoPPNNI(q2) && isNoPPN(q3) && inSet(q4, 'SY', 'WY', 'NI')) {
    return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D2.R7' };
  }

  const allAnswered = [q1, q2, q3, q4, q5].every(a => a !== null && a !== undefined);
  return { judgement: null, isComplete: allAnswered, ruleId: null };
}

/**
 * Score Domain 3 Part A (Selection bias - prevalent user bias and immortal time)
 *
 * Questions: d3_1, d3_2
 * Table from table (3).md (Note: SY in original table should be SN)
 */
function scoreDomain3PartA(answers) {
  const q1 = answers.d3_1?.answer; // Followed from start
  const q2 = answers.d3_2?.answer; // Early events excluded

  if (q1 === null || q1 === undefined) {
    return { result: null, isComplete: false };
  }

  // Row 1: Y/PY, N/PN/NI -> Low
  if (isYesPY(q1) && isNoPPNNI(q2)) {
    return { result: 'Low', isComplete: true };
  }

  // Row 2: Y/PY, Y/PY -> Moderate
  if (isYesPY(q1) && isYesPY(q2)) {
    return { result: 'Moderate', isComplete: true };
  }

  // Row 3: WN/NI, — -> Moderate
  if (inSet(q1, 'WN', 'NI')) {
    return { result: 'Moderate', isComplete: true };
  }

  // Row 4: SN, — -> Serious (corrected from SY to SN per user confirmation)
  if (q1 === 'SN') {
    return { result: 'Serious', isComplete: true };
  }

  return { result: null, isComplete: q2 !== null && q2 !== undefined };
}

/**
 * Score Domain 3 Part B (Selection bias - other types)
 *
 * Questions: d3_3, d3_4, d3_5
 * Table from table (4).md
 */
function scoreDomain3PartB(answers) {
  const q3 = answers.d3_3?.answer; // Post-start selection
  const q4 = answers.d3_4?.answer; // Associated with intervention
  const q5 = answers.d3_5?.answer; // Influenced by outcome

  if (q3 === null || q3 === undefined) {
    return { result: null, isComplete: false };
  }

  // Row 1: N/PN, —, — -> Low
  if (isNoPPN(q3)) {
    return { result: 'Low', isComplete: true };
  }

  // Row 2: Y/PY/NI, N/PN, — -> Low
  if (inSet(q3, 'Y', 'PY', 'NI') && isNoPPN(q4)) {
    return { result: 'Low', isComplete: true };
  }

  // Row 3: Y/PY, Y/PY, N/PN/NI -> Moderate
  if (isYesPY(q3) && isYesPY(q4) && isNoPPNNI(q5)) {
    return { result: 'Moderate', isComplete: true };
  }

  // Row 4: Y/PY, Y/PY, Y/PY -> Serious
  if (isYesPY(q3) && isYesPY(q4) && isYesPY(q5)) {
    return { result: 'Serious', isComplete: true };
  }

  // Row 5: NI, NI, — -> Moderate
  if (q3 === 'NI' && q4 === 'NI') {
    return { result: 'Moderate', isComplete: true };
  }

  const allAnswered = [q3, q4, q5].every(a => a !== null && a !== undefined);
  return { result: null, isComplete: allAnswered };
}

/**
 * Score Domain 3 Final (combines Part A + Part B with correction questions)
 *
 * Questions: d3_6, d3_7, d3_8
 * Table from table (5).md
 */
function scoreDomain3(answers) {
  const partA = scoreDomain3PartA(answers);
  const partB = scoreDomain3PartB(answers);

  // If either part is incomplete, domain is incomplete
  if (!partA.isComplete || !partB.isComplete) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  const q6 = answers.d3_6?.answer; // Corrected for selection biases
  const q7 = answers.d3_7?.answer; // Sensitivity analyses OK
  const q8 = answers.d3_8?.answer; // Severe enough to exclude

  // Determine combined worst result
  const rankMap = { Low: 0, Moderate: 1, Serious: 2 };
  const worstRank = Math.max(rankMap[partA.result] ?? 0, rankMap[partB.result] ?? 0);

  // Row 1: All Low -> Low
  if (partA.result === 'Low' && partB.result === 'Low') {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D3.R1' };
  }

  // Row 2: At worst Moderate -> Moderate
  if (worstRank <= 1) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R2' };
  }

  // At least one Serious - need correction/sensitivity questions
  if (worstRank >= 2) {
    // Row 3: >=1 Serious, Y/PY (corrected or sensitivity OK) -> Moderate
    if (isYesPY(q6) || isYesPY(q7)) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D3.R3' };
    }

    // Row 5: >=1 Serious, N/PN/NI (not corrected/sensitivity), Y/PY (severe) -> Critical
    if (isNoPPNNI(q6) && isNoPPNNI(q7) && isYesPY(q8)) {
      return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D3.R5' };
    }

    // Row 4: >=1 Serious, N/PN/NI, N/PN/NI -> Serious
    if (isNoPPNNI(q6) && isNoPPNNI(q7) && isNoPPNNI(q8)) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D3.R4' };
    }
  }

  // Need more answers for final determination
  const allAnswered = [q6, q7, q8].every(a => a !== null && a !== undefined);
  return { judgement: null, isComplete: allAnswered, ruleId: null };
}

/**
 * Score Domain 4 (Bias due to missing data)
 *
 * Questions: d4_1 through d4_11
 * Table from table (6).md - requires derived conditions
 */
function scoreDomain4(answers) {
  const q1 = answers.d4_1?.answer; // Complete data on intervention
  const q2 = answers.d4_2?.answer; // Complete data on outcome
  const q3 = answers.d4_3?.answer; // Complete data on confounders
  const q4 = answers.d4_4?.answer; // Complete case analysis?
  const q5 = answers.d4_5?.answer; // Exclusion related to outcome?
  const q6 = answers.d4_6?.answer; // Explained by model?
  const q7 = answers.d4_7?.answer; // Based on imputation?
  const q8 = answers.d4_8?.answer; // MAR/MCAR reasonable?
  const q9 = answers.d4_9?.answer; // Imputation appropriate?
  const _q10 = answers.d4_10?.answer; // Alternative method? (not used in current table logic but kept for future)
  const q11 = answers.d4_11?.answer; // Evidence not biased?

  // Determine if all complete data questions are Y/PY
  const completeDataAnswered = [q1, q2, q3].every(a => a !== null && a !== undefined);
  if (!completeDataAnswered) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  const allCompleteData = [q1, q2, q3].every(a => isYesPY(a));
  const anyMissingData = [q1, q2, q3].some(a => isNoPPNNI(a));

  // Rule 1: All Y/PY complete data -> Low
  if (allCompleteData) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R1' };
  }

  // Rules 2-8 require missing data (any N/PN/NI in 4.1-4.3)
  if (anyMissingData) {
    // Determine method and other derived conditions
    const isCompleteCase = isYesPY(q4) || q4 === 'NI';
    const isImputation = isYesPY(q7);
    const isPoorNone = isNoPPN(q4) && isNoPPN(q7);

    if (isCompleteCase && !isImputation) {
      // Complete-case analysis path
      // Rule 2: Not outcome-related (N/PN to 4.5) -> Low
      if (isNoPPN(q5)) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R2' };
      }

      // Rule 3: Explained by model (Y/PY/NI to 4.5, check 4.6), evidence not biased Y/PY -> Moderate
      if ((isYesPY(q5) || q5 === 'NI') && inSet(q6, 'Y', 'PY', 'WN') && isYesPY(q11)) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R3' };
      }

      // Rule 4: Explained by model, evidence not biased N/PN -> Serious
      if ((isYesPY(q5) || q5 === 'NI') && inSet(q6, 'Y', 'PY', 'WN') && isNoPPN(q11)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R4' };
      }
    }

    if (isImputation) {
      // Imputation path
      // Rule 5: MAR/MCAR + appropriate -> Low
      if (isYesPY(q8) && inSet(q9, 'Y', 'PY')) {
        return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D4.R5' };
      }

      // Rule 6: Weak/unclear (WN/SN/NI for q9), evidence not biased Y/PY -> Moderate
      if (inSet(q9, 'WN', 'SN', 'NI') && isYesPY(q11)) {
        return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D4.R6' };
      }

      // Rule 7: Weak/unclear, evidence not biased N/PN -> Serious
      if (inSet(q9, 'WN', 'SN', 'NI') && isNoPPN(q11)) {
        return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D4.R7' };
      }
    }

    if (isPoorNone) {
      // Poor/none method path
      // Rule 8: Strong concern, evidence not biased N/PN -> Critical
      if (isNoPPN(q11)) {
        return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D4.R8' };
      }
    }
  }

  // Determine completeness based on branching logic
  const allAnswered = Object.values(answers).every(
    a => a?.answer !== null && a?.answer !== undefined,
  );
  return { judgement: null, isComplete: allAnswered, ruleId: null };
}

/**
 * Score Domain 5 (Bias in measurement of the outcome)
 *
 * Questions: d5_1, d5_2, d5_3
 * Table from table (7).md
 */
function scoreDomain5(answers) {
  const q1 = answers.d5_1?.answer; // Differs by intervention
  const q2 = answers.d5_2?.answer; // Assessor aware
  const q3 = answers.d5_3?.answer; // Influence possible

  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Rule 1: Y/PY (differs) -> Serious
  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R1' };
  }

  // Rule 2: N/PN, N/PN -> Low
  if (isNoPPN(q1) && isNoPPN(q2)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D5.R2' };
  }

  // Rule 3: N/PN, Y/PY/NI, N/PN -> Low
  if (isNoPPN(q1) && inSet(q2, 'Y', 'PY', 'NI') && isNoPPN(q3)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D5.R3' };
  }

  // Rule 4: N/PN, Y/PY/NI, WY/NI -> Moderate
  if (isNoPPN(q1) && inSet(q2, 'Y', 'PY', 'NI') && inSet(q3, 'WY', 'NI')) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R4' };
  }

  // Rule 5: N/PN, Y/PY/NI, SY -> Serious
  if (isNoPPN(q1) && inSet(q2, 'Y', 'PY', 'NI') && q3 === 'SY') {
    return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D5.R5' };
  }

  // Rule 6: NI, N/PN, WY/NI/PN -> Moderate
  if (q1 === 'NI' && isNoPPN(q2) && inSet(q3, 'WY', 'NI', 'PN')) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R6' };
  }

  // Rule 7: NI, Y/PY/NI, — -> Moderate
  if (q1 === 'NI' && inSet(q2, 'Y', 'PY', 'NI')) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D5.R7' };
  }

  const allAnswered = [q1, q2, q3].every(a => a !== null && a !== undefined);
  return { judgement: null, isComplete: allAnswered, ruleId: null };
}

/**
 * Score Domain 6 (Bias in selection of the reported result)
 *
 * Questions: d6_1, d6_2, d6_3, d6_4
 * Table from table (8).md
 */
function scoreDomain6(answers) {
  const q1 = answers.d6_1?.answer; // Prespecified
  const q2 = answers.d6_2?.answer; // Selected from multiple measurements
  const q3 = answers.d6_3?.answer; // Selected from multiple analyses
  const q4 = answers.d6_4?.answer; // Selected from multiple subgroups

  if (q1 === null || q1 === undefined) {
    return { judgement: null, isComplete: false, ruleId: null };
  }

  // Rule 1: Y/PY (prespecified) -> Low
  if (isYesPY(q1)) {
    return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D6.R1' };
  }

  // Count Y/PY among q2-q4
  const selectionQuestions = [q2, q3, q4];
  const yesCount = selectionQuestions.filter(a => isYesPY(a)).length;
  const hasNI = selectionQuestions.some(a => a === 'NI');
  const allNI = selectionQuestions.every(a => a === 'NI');

  // N/PN/NI for q1 - check the selection questions
  if (isNoPPNNI(q1)) {
    // Rule 6: 0 Y/PY, All NI -> Serious
    if (yesCount === 0 && allNI) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D6.R6' };
    }

    // Rule 2: 0 Y/PY, No NI -> Low
    if (yesCount === 0 && !hasNI) {
      return { judgement: JUDGEMENTS.LOW, isComplete: true, ruleId: 'D6.R2' };
    }

    // Rule 3: 0 Y/PY, Has NI (but not all) -> Moderate
    if (yesCount === 0 && hasNI && !allNI) {
      return { judgement: JUDGEMENTS.MODERATE, isComplete: true, ruleId: 'D6.R3' };
    }

    // Rule 4: 1 Y/PY -> Serious
    if (yesCount === 1) {
      return { judgement: JUDGEMENTS.SERIOUS, isComplete: true, ruleId: 'D6.R4' };
    }

    // Rule 5: >=2 Y/PY -> Critical
    if (yesCount >= 2) {
      return { judgement: JUDGEMENTS.CRITICAL, isComplete: true, ruleId: 'D6.R5' };
    }
  }

  const allAnswered = [q1, q2, q3, q4].every(a => a !== null && a !== undefined);
  return { judgement: null, isComplete: allAnswered, ruleId: null };
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
