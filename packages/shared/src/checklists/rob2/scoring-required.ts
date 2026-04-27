/**
 * ROB-2 Required Questions
 *
 * Determines which questions are on the active scoring path for each domain.
 * Questions NOT in the returned set are irrelevant given current answers
 * and can be marked as optional/skippable in the UI.
 */

import { isYesPY, isNoPPN, isNoPPNNI, type DomainAnswers } from './scoring-helpers.js';

/**
 * Determine which questions are on the active scoring path for a domain.
 * Questions NOT in the returned set are irrelevant given current answers
 * and can be marked as optional/skippable in the UI.
 */
export function getRequiredQuestions(
  domainKey: string,
  answers: DomainAnswers | undefined,
): Set<string> {
  if (!answers) return new Set();

  switch (domainKey) {
    case 'domain1':
      return getRequiredD1(answers);
    case 'domain2a':
      return getRequiredD2a(answers);
    case 'domain2b':
      return getRequiredD2b(answers);
    case 'domain3':
      return getRequiredD3(answers);
    case 'domain4':
      return getRequiredD4(answers);
    case 'domain5':
      return getRequiredD5(answers);
    default:
      return new Set();
  }
}

function getRequiredD1(a: DomainAnswers): Set<string> {
  const required = new Set<string>();
  const q2 = a.d1_2?.answer ?? null;

  // Always need 1.2 first
  required.add('d1_2');
  if (q2 === null) return required;

  if (isNoPPN(q2)) return required; // High, done

  if (isYesPY(q2)) {
    required.add('d1_1');
    const q1 = a.d1_1?.answer ?? null;
    if (q1 === null) return required;
    if (isNoPPN(q1)) return required; // Some concerns, done
    // Y/PY/NI -> need 1.3
    required.add('d1_3');
    return required;
  }

  if (q2 === 'NI') {
    // Skip 1.1, go to 1.3
    required.add('d1_3');
    return required;
  }

  return required;
}

function getRequiredD2a(a: DomainAnswers): Set<string> {
  const required = new Set<string>();

  // Part 1: always need 2.1 and 2.2
  required.add('d2a_1');
  required.add('d2a_2');
  const q1 = a.d2a_1?.answer ?? null;
  const q2 = a.d2a_2?.answer ?? null;

  if (q1 !== null && q2 !== null) {
    if (!(isNoPPN(q1) && isNoPPN(q2))) {
      // Either Y/PY/NI -> need 2.3
      required.add('d2a_3');
      const q3 = a.d2a_3?.answer ?? null;
      if (q3 !== null && isYesPY(q3)) {
        required.add('d2a_4');
        const q4 = a.d2a_4?.answer ?? null;
        if (q4 !== null && (isYesPY(q4) || q4 === 'NI')) {
          required.add('d2a_5');
        }
      }
    }
  }

  // Part 2: always need 2.6
  required.add('d2a_6');
  const q6 = a.d2a_6?.answer ?? null;
  if (q6 !== null && isNoPPNNI(q6)) {
    required.add('d2a_7');
  }

  return required;
}

function getRequiredD2b(a: DomainAnswers): Set<string> {
  const required = new Set<string>();

  required.add('d2b_1');
  required.add('d2b_2');
  const q1 = a.d2b_1?.answer ?? null;
  const q2 = a.d2b_2?.answer ?? null;
  if (q1 === null || q2 === null) return required;

  if (isNoPPN(q1) && isNoPPN(q2)) {
    // Both N/PN -> skip 2.3, need 2.4/2.5
    required.add('d2b_4');
    required.add('d2b_5');
    const q4 = a.d2b_4?.answer ?? null;
    const q5 = a.d2b_5?.answer ?? null;
    if (q4 !== null && q5 !== null) {
      const bothClean = (isNoPPN(q4) || q4 === 'NA') && (isNoPPN(q5) || q5 === 'NA');
      if (!bothClean) {
        required.add('d2b_6');
      }
    }
    return required;
  }

  // Either Y/PY/NI -> need 2.3
  required.add('d2b_3');
  const q3 = a.d2b_3?.answer ?? null;
  if (q3 === null) return required;

  if (q3 === 'NA' || isYesPY(q3)) {
    // Need 2.4/2.5
    required.add('d2b_4');
    required.add('d2b_5');
    const q4 = a.d2b_4?.answer ?? null;
    const q5 = a.d2b_5?.answer ?? null;
    if (q4 !== null && q5 !== null) {
      const bothClean = (isNoPPN(q4) || q4 === 'NA') && (isNoPPN(q5) || q5 === 'NA');
      if (!bothClean) {
        required.add('d2b_6');
      }
    }
  } else if (isNoPPNNI(q3)) {
    // Skip 2.4/2.5, go to 2.6
    required.add('d2b_6');
  }

  return required;
}

function getRequiredD3(a: DomainAnswers): Set<string> {
  const required = new Set<string>();

  required.add('d3_1');
  const q1 = a.d3_1?.answer ?? null;
  if (q1 === null) return required;
  if (isYesPY(q1)) return required; // Low, done

  required.add('d3_2');
  const q2 = a.d3_2?.answer ?? null;
  if (q2 === null) return required;
  if (isYesPY(q2)) return required; // Low, done

  required.add('d3_3');
  const q3 = a.d3_3?.answer ?? null;
  if (q3 === null) return required;
  if (isNoPPN(q3) || q3 === 'NA') return required; // Low, done

  required.add('d3_4');
  return required;
}

function getRequiredD4(a: DomainAnswers): Set<string> {
  const required = new Set<string>();

  required.add('d4_1');
  const q1 = a.d4_1?.answer ?? null;
  if (q1 === null) return required;
  if (isYesPY(q1)) return required; // High, done

  required.add('d4_2');
  const q2 = a.d4_2?.answer ?? null;
  if (q2 === null) return required;
  if (isYesPY(q2)) return required; // High, done

  // Both N/PN and NI branches need 4.3
  required.add('d4_3');
  const q3 = a.d4_3?.answer ?? null;
  if (q3 === null) return required;

  // Early exits: N/PN/NA on branch A -> Low, or on branch B -> Some concerns
  if ((isNoPPN(q3) || q3 === 'NA') && (isNoPPN(q2) || q2 === 'NI')) {
    return required;
  }

  if (isYesPY(q3) || q3 === 'NI') {
    required.add('d4_4');
    const q4 = a.d4_4?.answer ?? null;
    if (q4 === null) return required;
    if (isNoPPN(q4) || q4 === 'NA') return required; // Low or Some concerns, done

    if (isYesPY(q4) || q4 === 'NI') {
      required.add('d4_5');
    }
  }

  return required;
}

function getRequiredD5(a: DomainAnswers): Set<string> {
  const required = new Set<string>();

  // Always start with 5.2 and 5.3
  required.add('d5_2');
  required.add('d5_3');
  const q2 = a.d5_2?.answer ?? null;
  const q3 = a.d5_3?.answer ?? null;
  if (q2 === null || q3 === null) return required;

  // Y/PY on either -> High, done; NI on either -> Some concerns, done
  if (isYesPY(q2) || isYesPY(q3)) return required;
  if (q2 === 'NI' || q3 === 'NI') return required;

  // Both N/PN -> need 5.1
  if (isNoPPN(q2) && isNoPPN(q3)) {
    required.add('d5_1');
  }

  return required;
}
