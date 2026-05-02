export const RESPONSE_LABELS: Record<string, string> = {
  NA: 'Not Applicable',
  Y: 'Yes',
  PY: 'Probably Yes',
  PN: 'Probably No',
  N: 'No',
  NI: 'No Information',
  WN: 'No, but not substantial',
  SN: 'No, and probably substantial',
  SY: 'Yes, substantially',
  WY: 'Yes, but not substantially',
};

export const JUDGEMENTS = {
  LOW: 'Low',
  LOW_EXCEPT_CONFOUNDING: 'Low (except for concerns about uncontrolled confounding)',
  MODERATE: 'Moderate',
  SERIOUS: 'Serious',
  CRITICAL: 'Critical',
} as const;

export type Judgement = (typeof JUDGEMENTS)[keyof typeof JUDGEMENTS];
export type ROBINSIScore = Judgement | 'Incomplete';

const SCORE_COLORS: Record<string, string> = {
  [JUDGEMENTS.LOW]: '#16a34a',
  [JUDGEMENTS.LOW_EXCEPT_CONFOUNDING]: '#16a34a',
  [JUDGEMENTS.MODERATE]: '#ca8a04',
  [JUDGEMENTS.SERIOUS]: '#dc2626',
  [JUDGEMENTS.CRITICAL]: '#7f1d1d',
  Incomplete: '#94a3b8',
};

export function getROBINSIScoreColor(score: ROBINSIScore): string {
  return SCORE_COLORS[score] ?? '#94a3b8';
}

export interface ROBINSIQuestion {
  id: string;
  number: string;
  text: string;
  responses: readonly string[];
}

export interface ROBINSISubsection {
  name: string;
  questions: ROBINSIQuestion[];
}

export interface ROBINSIDomain {
  id: string;
  name: string;
  subtitle?: string;
  questions?: ROBINSIQuestion[];
  subsections?: Record<string, ROBINSISubsection>;
}

// --- Domain definitions ---

export const ROBINSI_DOMAINS: Record<string, ROBINSIDomain> = {
  domain1a: {
    id: 'domain1a',
    name: 'Domain 1: Bias due to confounding',
    subtitle: 'Variant A (intention-to-treat effect)',
    questions: [
      { id: 'd1a_1', number: '1.1', text: 'Did the authors control for all the important confounding factors for which this was necessary?', responses: ['Y', 'PY', 'WN', 'SN', 'NI'] },
      { id: 'd1a_2', number: '1.2', text: 'If Y/PY/WN to 1.1: Were confounding factors measured validly and reliably?', responses: ['NA', 'Y', 'PY', 'WN', 'SN', 'NI'] },
      { id: 'd1a_3', number: '1.3', text: 'If Y/PY/WN to 1.1: Did the authors control for any post-intervention variables affected by the intervention?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd1a_4', number: '1.4', text: 'Did negative controls, quantitative bias analysis, or other considerations suggest serious uncontrolled confounding?', responses: ['NA', 'Y', 'PY', 'PN', 'NI'] },
    ],
  },
  domain1b: {
    id: 'domain1b',
    name: 'Domain 1: Bias due to confounding',
    subtitle: 'Variant B (per-protocol effect)',
    questions: [
      { id: 'd1b_1', number: '1.1', text: 'Did the authors use a method appropriate to control for time-varying and baseline confounding?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd1b_2', number: '1.2', text: 'If Y/PY to 1.1: Did the authors control for all important baseline and time-varying confounders?', responses: ['NA', 'Y', 'PY', 'WN', 'SN', 'NI'] },
      { id: 'd1b_3', number: '1.3', text: 'If Y/PY/WN to 1.2: Were confounders measured validly and reliably?', responses: ['NA', 'Y', 'PY', 'WN', 'SN', 'NI'] },
      { id: 'd1b_4', number: '1.4', text: 'If N/PN/NI to 1.1: Did the authors control for time-varying factors measured after the start of intervention?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd1b_5', number: '1.5', text: 'Did negative controls or other considerations suggest serious uncontrolled confounding?', responses: ['Y', 'PY', 'PN', 'N'] },
    ],
  },
  domain2: {
    id: 'domain2',
    name: 'Domain 2: Bias in classification of interventions',
    questions: [
      { id: 'd2_1', number: '2.1', text: 'Were the intervention strategies distinguishable at the time when follow-up would have started?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd2_2', number: '2.2', text: 'If N/PN/NI to 2.1: Did all or nearly all outcome events occur after the strategies could be distinguished?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd2_3', number: '2.3', text: 'If N/PN/NI to 2.2: Did the analysis avoid problems from indistinguishable strategies?', responses: ['NA', 'SY', 'WY', 'PN', 'N', 'NI'] },
      { id: 'd2_4', number: '2.4', text: 'Was classification of intervention status influenced by knowledge of the outcome?', responses: ['SY', 'WY', 'PN', 'N', 'NI'] },
      { id: 'd2_5', number: '2.5', text: 'Were further classification errors likely?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
    ],
  },
  domain3: {
    id: 'domain3',
    name: 'Domain 3: Bias in selection of participants',
    subsections: {
      a: {
        name: 'A. Prevalent user bias and immortal time',
        questions: [
          { id: 'd3_1', number: '3.1', text: 'Did follow-up begin at the start of the intervention strategies being compared?', responses: ['Y', 'PY', 'WN', 'SN', 'NI'] },
          { id: 'd3_2', number: '3.2', text: 'If Y/PY to 3.1: Were outcome events during follow-up after the start of interventions excluded?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
        ],
      },
      b: {
        name: 'B. Other types of selection bias',
        questions: [
          { id: 'd3_3', number: '3.3', text: 'Was selection based on participant characteristics observed after the start of intervention?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
          { id: 'd3_4', number: '3.4', text: 'If Y/PY to 3.3: Were the post-intervention variables likely associated with intervention?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
          { id: 'd3_5', number: '3.5', text: 'If Y/PY to 3.4: Were they likely influenced by the outcome or a cause of the outcome?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
        ],
      },
      c: {
        name: 'C. Analysis, sensitivity analyses and severity',
        questions: [
          { id: 'd3_6', number: '3.6', text: 'If SN to 3.1 or Y/PY to 3.5: Did the analysis correct for all potential selection biases?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
          { id: 'd3_7', number: '3.7', text: 'If N/PN/NI to 3.6: Did sensitivity analyses show the impact was minimal?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
          { id: 'd3_8', number: '3.8', text: 'If N/PN/NI to 3.7: Were biases severe enough to exclude from synthesis?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
        ],
      },
    },
  },
  domain4: {
    id: 'domain4',
    name: 'Domain 4: Bias due to missing data',
    questions: [
      { id: 'd4_1', number: '4.1', text: 'Were complete data on intervention status available for all, or nearly all, participants?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd4_2', number: '4.2', text: 'Were complete data on the outcome available for all, or nearly all, participants?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd4_3', number: '4.3', text: 'Were complete data on important confounding variables available?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd4_4', number: '4.4', text: 'If N/PN/NI to 4.1-4.3: Is the result based on a complete case analysis?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd4_5', number: '4.5', text: 'If Y/PY/NI to 4.4: Was exclusion likely related to the true outcome value?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd4_6', number: '4.6', text: 'If Y/PY/NI to 4.5: Is the relationship explained by variables in the model?', responses: ['NA', 'Y', 'PY', 'WN', 'SN', 'NI'] },
      { id: 'd4_7', number: '4.7', text: 'If N/PN to 4.4: Was the analysis based on imputing missing values?', responses: ['NA', 'Y', 'PY', 'PN', 'NI'] },
      { id: 'd4_8', number: '4.8', text: 'If Y/PY to 4.7: Is the MAR/MCAR assumption reasonable?', responses: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd4_9', number: '4.9', text: 'If Y/PY to 4.8: Was imputation performed appropriately?', responses: ['NA', 'Y', 'PY', 'WN', 'SN', 'NI'] },
      { id: 'd4_10', number: '4.10', text: 'If N/PN/NI to 4.7: Was an alternative method used for bias correction?', responses: ['NA', 'Y', 'PY', 'WN', 'SN', 'NI'] },
      { id: 'd4_11', number: '4.11', text: 'Is there evidence that the result was not biased by missing data?', responses: ['NA', 'Y', 'PY', 'PN', 'N'] },
    ],
  },
  domain5: {
    id: 'domain5',
    name: 'Domain 5: Bias in measurement of the outcome',
    questions: [
      { id: 'd5_1', number: '5.1', text: 'Could measurement or ascertainment of the outcome have differed between groups?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd5_2', number: '5.2', text: 'Were outcome assessors aware of the intervention received?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd5_3', number: '5.3', text: 'If Y/PY/NI to 5.2: Could assessment be influenced by knowledge of the intervention?', responses: ['NA', 'SY', 'WY', 'PN', 'N', 'NI'] },
    ],
  },
  domain6: {
    id: 'domain6',
    name: 'Domain 6: Bias in selection of the reported result',
    questions: [
      { id: 'd6_1', number: '6.1', text: 'Was the result reported per a pre-determined analysis plan?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd6_2', number: '6.2', text: 'Was the result likely selected from multiple outcome measurements?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd6_3', number: '6.3', text: 'Was the result likely selected from multiple analyses?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
      { id: 'd6_4', number: '6.4', text: 'Was the result likely selected from multiple subgroups?', responses: ['Y', 'PY', 'PN', 'N', 'NI'] },
    ],
  },
};

export function getActiveDomainKeys(isPerProtocol: boolean): string[] {
  const base = ['domain2', 'domain3', 'domain4', 'domain5', 'domain6'];
  return isPerProtocol ? ['domain1b', ...base] : ['domain1a', ...base];
}

export function getDomainQuestions(domain: ROBINSIDomain): ROBINSIQuestion[] {
  if (domain.questions) return domain.questions;
  if (domain.subsections) {
    return Object.values(domain.subsections).flatMap(s => s.questions);
  }
  return [];
}

// --- Scoring helpers ---

function normalize(v: string | null): string | null {
  return v === 'NA' ? 'NI' : v;
}

function isYesPY(v: string | null): boolean {
  return v === 'Y' || v === 'PY';
}

function isNoPPN(v: string | null): boolean {
  return v === 'N' || v === 'PN';
}

function isNoPPNNI(v: string | null): boolean {
  return v === 'N' || v === 'PN' || v === 'NI';
}

function inSet(v: string | null, ...vals: string[]): boolean {
  return vals.includes(v as string);
}

interface ScoringResult {
  judgement: string | null;
  isComplete: boolean;
}

// --- Per-domain scoring (callback-based) ---

function scoreDomain1A(get: (q: string) => string | null): ScoringResult {
  const q1 = normalize(get('d1a_1'));
  const q2 = normalize(get('d1a_2'));
  const q3 = normalize(get('d1a_3'));
  const q4 = normalize(get('d1a_4'));

  if (q1 === null) return { judgement: null, isComplete: false };

  if (inSet(q1, 'SN', 'NI')) {
    if (q4 === null) return { judgement: null, isComplete: false };
    if (isNoPPN(q4)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
    if (isYesPY(q4)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
  }

  if (isYesPY(q1)) {
    if (q3 === null) return { judgement: null, isComplete: false };
    if (isYesPY(q3)) {
      if (q4 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q4)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (isYesPY(q4)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
    }
    if (isNoPPNNI(q3)) {
      if (q2 === null) return { judgement: null, isComplete: false };
      if (inSet(q2, 'SN', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (isYesPY(q2) || q2 === 'WN') {
        if (q4 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q4)) return { judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING, isComplete: true };
        if (isYesPY(q4)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      }
    }
  }

  if (q1 === 'WN') {
    if (q3 === null) return { judgement: null, isComplete: false };
    if (isYesPY(q3)) {
      if (q4 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q4)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (isYesPY(q4)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
    }
    if (isNoPPNNI(q3)) {
      if (q2 === null) return { judgement: null, isComplete: false };
      if (inSet(q2, 'SN', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (isYesPY(q2) || q2 === 'WN') {
        if (q4 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q4)) return { judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING, isComplete: true };
        if (isYesPY(q4)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      }
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain1B(get: (q: string) => string | null): ScoringResult {
  const q1 = normalize(get('d1b_1'));
  const q2 = normalize(get('d1b_2'));
  const q3 = normalize(get('d1b_3'));
  const q4 = normalize(get('d1b_4'));
  const q5 = normalize(get('d1b_5'));

  if (q1 === null) return { judgement: null, isComplete: false };

  if (isNoPPNNI(q1)) {
    if (q4 === null) return { judgement: null, isComplete: false };
    if (isYesPY(q4)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
    if (isNoPPNNI(q4)) {
      if (q5 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q5)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (isYesPY(q5)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
    }
  }

  if (isYesPY(q1)) {
    if (q2 === null) return { judgement: null, isComplete: false };
    if (inSet(q2, 'SN', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };

    if (isYesPY(q2)) {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (inSet(q3, 'SN', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (isYesPY(q3)) {
        if (q5 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q5)) return { judgement: JUDGEMENTS.LOW, isComplete: true };
        if (isYesPY(q5)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      }
      if (q3 === 'WN') {
        if (q5 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q5)) return { judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING, isComplete: true };
        if (isYesPY(q5)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      }
    }

    if (q2 === 'WN') {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (inSet(q3, 'SN', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (isYesPY(q3) || q3 === 'WN') {
        if (q5 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q5)) return { judgement: JUDGEMENTS.LOW_EXCEPT_CONFOUNDING, isComplete: true };
        if (isYesPY(q5)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      }
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain2(get: (q: string) => string | null): ScoringResult {
  const q1 = normalize(get('d2_1'));
  const q2 = normalize(get('d2_2'));
  const q3 = normalize(get('d2_3'));
  const q4 = normalize(get('d2_4'));
  const q5 = normalize(get('d2_5'));

  if (q1 === null) return { judgement: null, isComplete: false };

  if (isYesPY(q1)) {
    if (q4 === null) return { judgement: null, isComplete: false };
    if (q4 === 'SY') {
      if (q5 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q5)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
    }
    if (inSet(q4, 'WY', 'NI')) {
      if (q5 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q5)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
    }
    if (isNoPPN(q4)) {
      if (q5 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q5)) return { judgement: JUDGEMENTS.LOW, isComplete: true };
      if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
    }
  }

  if (isNoPPNNI(q1)) {
    if (q2 === null) return { judgement: null, isComplete: false };
    if (isYesPY(q2)) {
      if (q4 === null) return { judgement: null, isComplete: false };
      if (q4 === 'SY') {
        if (q5 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q5)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
        if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
      }
      if (inSet(q4, 'WY', 'NI')) {
        if (q5 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q5)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
        if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
      }
      if (isNoPPN(q4)) {
        if (q5 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q5)) return { judgement: JUDGEMENTS.LOW, isComplete: true };
        if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      }
    }
    if (isNoPPNNI(q2)) {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q3)) {
        if (q4 === null) return { judgement: null, isComplete: false };
        if (inSet(q4, 'SY', 'WY', 'NI')) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
        if (isNoPPN(q4)) {
          if (q5 === null) return { judgement: null, isComplete: false };
          if (isNoPPN(q5)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
          if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
        }
      }
      if (inSet(q3, 'SY', 'WY', 'NI')) {
        if (q4 === null) return { judgement: null, isComplete: false };
        if (q4 === 'SY') {
          if (q5 === null) return { judgement: null, isComplete: false };
          if (isNoPPN(q5)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
          if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
        }
        if (isNoPPN(q4)) {
          if (q5 === null) return { judgement: null, isComplete: false };
          if (isNoPPN(q5)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
          if (inSet(q5, 'Y', 'PY', 'NI')) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
        }
      }
    }
  }

  return { judgement: null, isComplete: false };
}

interface PartResult {
  result: string | null;
  isComplete: boolean;
}

function scoreDomain3PartA(get: (q: string) => string | null): PartResult {
  const q1 = normalize(get('d3_1'));
  const q2 = normalize(get('d3_2'));

  if (q1 === null) return { result: null, isComplete: false };
  if (q1 === 'SN') return { result: 'Serious', isComplete: true };
  if (inSet(q1, 'WN', 'NI')) return { result: 'Moderate', isComplete: true };

  if (isYesPY(q1)) {
    if (q2 === null) return { result: null, isComplete: false };
    if (isNoPPNNI(q2)) return { result: 'Low', isComplete: true };
    if (isYesPY(q2)) return { result: 'Moderate', isComplete: true };
  }

  return { result: null, isComplete: q2 !== null };
}

function scoreDomain3PartB(get: (q: string) => string | null): PartResult {
  const q3 = normalize(get('d3_3'));
  const q4 = normalize(get('d3_4'));
  const q5 = normalize(get('d3_5'));

  if (q3 === null) return { result: null, isComplete: false };
  if (isNoPPN(q3)) return { result: 'Low', isComplete: true };
  if (q3 === 'NI') return { result: 'Moderate', isComplete: true };

  if (isYesPY(q3)) {
    if (q4 === null) return { result: null, isComplete: false };
    if (isNoPPN(q4)) return { result: 'Low', isComplete: true };
    if (q4 === 'NI') return { result: 'Moderate', isComplete: true };
    if (isYesPY(q4)) {
      if (q5 === null) return { result: null, isComplete: false };
      if (isNoPPNNI(q5)) return { result: 'Moderate', isComplete: true };
      if (isYesPY(q5)) return { result: 'Serious', isComplete: true };
    }
  }

  return { result: null, isComplete: [q3, q4, q5].every(a => a !== null) };
}

function scoreDomain3(get: (q: string) => string | null): ScoringResult {
  const partA = scoreDomain3PartA(get);
  const partB = scoreDomain3PartB(get);

  if (!partA.isComplete || !partB.isComplete) return { judgement: null, isComplete: false };

  const q6 = normalize(get('d3_6'));
  const q7 = normalize(get('d3_7'));
  const q8 = normalize(get('d3_8'));

  const rankMap: Record<string, number> = { Low: 0, Moderate: 1, Serious: 2 };
  const aRank = rankMap[partA.result || ''] ?? 0;
  const bRank = rankMap[partB.result || ''] ?? 0;
  const worstRank = Math.max(aRank, bRank);

  if (partA.result === 'Low' && partB.result === 'Low') {
    return { judgement: JUDGEMENTS.LOW, isComplete: true };
  }

  if (worstRank <= 1) {
    return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
  }

  if (worstRank >= 2) {
    if (isYesPY(q6)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
    if (isNoPPNNI(q6)) {
      if (isYesPY(q7)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      if (isNoPPNNI(q7)) {
        if (q8 === null) return { judgement: null, isComplete: false };
        if (isNoPPNNI(q8)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
        if (isYesPY(q8)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
      }
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain4(get: (q: string) => string | null): ScoringResult {
  const q1 = normalize(get('d4_1'));
  const q2 = normalize(get('d4_2'));
  const q3 = normalize(get('d4_3'));

  if ([q1, q2, q3].some(a => a === null)) return { judgement: null, isComplete: false };
  if ([q1, q2, q3].every(a => isYesPY(a))) return { judgement: JUDGEMENTS.LOW, isComplete: true };

  if ([q1, q2, q3].some(a => isNoPPNNI(a))) {
    const q4 = normalize(get('d4_4'));
    if (q4 === null) return { judgement: null, isComplete: false };

    // Complete-case path
    if (isYesPY(q4) || q4 === 'NI') {
      const q5 = normalize(get('d4_5'));
      if (q5 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q5)) return { judgement: JUDGEMENTS.LOW, isComplete: true };

      if (isYesPY(q5) || q5 === 'NI') {
        const q6 = normalize(get('d4_6'));
        const q11 = normalize(get('d4_11'));
        if (q6 === null) return { judgement: null, isComplete: false };

        if (isYesPY(q6)) {
          if (q11 === null) return { judgement: null, isComplete: false };
          if (isYesPY(q11)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
          if (isNoPPN(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
        }
        if (inSet(q6, 'WN', 'NI')) {
          if (q11 === null) return { judgement: null, isComplete: false };
          if (isYesPY(q11)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
          if (isNoPPN(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
        }
        if (q6 === 'SN') {
          if (q11 === null) return { judgement: null, isComplete: false };
          if (isYesPY(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
          if (isNoPPN(q11)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
        }
      }
    }

    // Not complete-case path
    if (isNoPPN(q4)) {
      const q7 = normalize(get('d4_7'));
      if (q7 === null) return { judgement: null, isComplete: false };

      // Imputation path
      if (isYesPY(q7)) {
        const q8 = normalize(get('d4_8'));
        if (q8 === null) return { judgement: null, isComplete: false };

        if (isYesPY(q8)) {
          const q9 = normalize(get('d4_9'));
          if (q9 === null) return { judgement: null, isComplete: false };
          if (isYesPY(q9)) return { judgement: JUDGEMENTS.LOW, isComplete: true };

          const q11 = normalize(get('d4_11'));
          if (inSet(q9, 'WN', 'NI')) {
            if (q11 === null) return { judgement: null, isComplete: false };
            if (isYesPY(q11)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
            if (isNoPPN(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
          }
          if (q9 === 'SN') {
            if (q11 === null) return { judgement: null, isComplete: false };
            if (isYesPY(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
            if (isNoPPN(q11)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
          }
        }

        if (isNoPPNNI(q8)) {
          const q11 = normalize(get('d4_11'));
          if (q11 === null) return { judgement: null, isComplete: false };
          if (isYesPY(q11)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
          if (isNoPPN(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
        }
      }

      // Alternative method path
      if (isNoPPNNI(q7)) {
        const q10 = normalize(get('d4_10'));
        if (q10 === null) return { judgement: null, isComplete: false };
        if (isYesPY(q10)) return { judgement: JUDGEMENTS.LOW, isComplete: true };

        const q11 = normalize(get('d4_11'));
        if (inSet(q10, 'WN', 'NI')) {
          if (q11 === null) return { judgement: null, isComplete: false };
          if (isYesPY(q11)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
          if (isNoPPN(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
        }
        if (q10 === 'SN') {
          if (q11 === null) return { judgement: null, isComplete: false };
          if (isYesPY(q11)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
          if (isNoPPN(q11)) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
        }
      }
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain5(get: (q: string) => string | null): ScoringResult {
  const q1 = normalize(get('d5_1'));
  const q2 = normalize(get('d5_2'));
  const q3 = normalize(get('d5_3'));

  if (q1 === null) return { judgement: null, isComplete: false };

  if (isYesPY(q1)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };

  if (isNoPPN(q1)) {
    if (q2 === null) return { judgement: null, isComplete: false };
    if (isNoPPN(q2)) return { judgement: JUDGEMENTS.LOW, isComplete: true };
    if (inSet(q2, 'Y', 'PY', 'NI')) {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q3)) return { judgement: JUDGEMENTS.LOW, isComplete: true };
      if (inSet(q3, 'WY', 'NI')) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      if (q3 === 'SY') return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
    }
  }

  if (q1 === 'NI') {
    if (q2 === null) return { judgement: null, isComplete: false };
    if (isNoPPN(q2)) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
    if (inSet(q2, 'Y', 'PY', 'NI')) {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (inSet(q3, 'WY', 'N', 'PN', 'NI')) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
      if (q3 === 'SY') return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain6(get: (q: string) => string | null): ScoringResult {
  const q1 = normalize(get('d6_1'));
  const q2 = normalize(get('d6_2'));
  const q3 = normalize(get('d6_3'));
  const q4 = normalize(get('d6_4'));

  if (q1 === null) return { judgement: null, isComplete: false };
  if (isYesPY(q1)) return { judgement: JUDGEMENTS.LOW, isComplete: true };

  if (isNoPPNNI(q1)) {
    if ([q2, q3, q4].some(a => a === null)) return { judgement: null, isComplete: false };

    const selections = [q2, q3, q4];
    const yesCount = selections.filter(a => isYesPY(a)).length;
    const hasNI = selections.some(a => a === 'NI');
    const allNI = selections.every(a => a === 'NI');
    const allNPN = selections.every(a => isNoPPN(a));

    if (allNPN) return { judgement: JUDGEMENTS.LOW, isComplete: true };
    if (yesCount === 0 && hasNI && !allNI) return { judgement: JUDGEMENTS.MODERATE, isComplete: true };
    if (yesCount === 1 || (yesCount === 0 && allNI)) return { judgement: JUDGEMENTS.SERIOUS, isComplete: true };
    if (yesCount >= 2) return { judgement: JUDGEMENTS.CRITICAL, isComplete: true };
  }

  return { judgement: null, isComplete: false };
}

// --- Dispatch ---

const DOMAIN_SCORERS: Record<string, (get: (q: string) => string | null) => ScoringResult> = {
  domain1a: scoreDomain1A,
  domain1b: scoreDomain1B,
  domain2: scoreDomain2,
  domain3: scoreDomain3,
  domain4: scoreDomain4,
  domain5: scoreDomain5,
  domain6: scoreDomain6,
};

export function scoreROBINSIDomain(
  domainKey: string,
  get: (q: string) => string | null,
): ScoringResult {
  const scorer = DOMAIN_SCORERS[domainKey];
  if (!scorer) return { judgement: null, isComplete: false };
  return scorer(get);
}

export function scoreROBINSI(
  getAnswer: (key: string) => string | null,
  isPerProtocol: boolean,
): ROBINSIScore {
  const active = getActiveDomainKeys(isPerProtocol);
  const judgements: Judgement[] = [];

  for (const domainKey of active) {
    const result = scoreROBINSIDomain(domainKey, getAnswer);
    if (!result.isComplete) return 'Incomplete';
    judgements.push(result.judgement as Judgement);
  }

  if (judgements.includes(JUDGEMENTS.CRITICAL)) return JUDGEMENTS.CRITICAL;
  if (judgements.includes(JUDGEMENTS.SERIOUS)) return JUDGEMENTS.SERIOUS;
  if (judgements.includes(JUDGEMENTS.MODERATE)) return JUDGEMENTS.MODERATE;
  return JUDGEMENTS.LOW;
}
