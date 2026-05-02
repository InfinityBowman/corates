export const ROB2_RESPONSES = ['Y', 'PY', 'PN', 'N', 'NI'] as const;

export const RESPONSE_LABELS: Record<string, string> = {
  Y: 'Yes',
  PY: 'Probably Yes',
  PN: 'Probably No',
  N: 'No',
  NI: 'No Information',
  NA: 'Not Applicable',
};

export const JUDGEMENT_LABELS = {
  Low: 'Low',
  'Some concerns': 'Some concerns',
  High: 'High',
} as const;

export type ROB2Score = 'Low' | 'Some concerns' | 'High' | 'Incomplete';

const SCORE_COLORS: Record<ROB2Score, string> = {
  Low: '#16a34a',
  'Some concerns': '#ca8a04',
  High: '#dc2626',
  Incomplete: '#94a3b8',
};

export function getROB2ScoreColor(score: ROB2Score): string {
  return SCORE_COLORS[score];
}

export const AIM_OPTIONS = {
  ASSIGNMENT: 'Effect of assignment to intervention',
  ADHERING: 'Effect of adhering to intervention',
} as const;

export interface ROB2Question {
  id: string;
  number: string;
  text: string;
  hasNA: boolean;
}

export interface ROB2Domain {
  id: string;
  name: string;
  subtitle?: string;
  questions: ROB2Question[];
}

export const ROB2_DOMAINS: Record<string, ROB2Domain> = {
  domain1: {
    id: 'domain1',
    name: 'Domain 1: Bias arising from the randomization process',
    questions: [
      { id: 'd1_1', number: '1.1', text: 'Was the allocation sequence random?', hasNA: false },
      { id: 'd1_2', number: '1.2', text: 'Was the allocation sequence concealed until participants were enrolled and assigned to interventions?', hasNA: false },
      { id: 'd1_3', number: '1.3', text: 'Did baseline differences between intervention groups suggest a problem with the randomization process?', hasNA: false },
    ],
  },
  domain2a: {
    id: 'domain2a',
    name: 'Domain 2: Deviations from intended interventions',
    subtitle: 'Effect of assignment to intervention',
    questions: [
      { id: 'd2a_1', number: '2.1', text: 'Were participants aware of their assigned intervention during the trial?', hasNA: false },
      { id: 'd2a_2', number: '2.2', text: 'Were carers and people delivering the interventions aware of participants\' assigned intervention?', hasNA: false },
      { id: 'd2a_3', number: '2.3', text: 'Were there deviations from the intended intervention that arose because of the trial context?', hasNA: true },
      { id: 'd2a_4', number: '2.4', text: 'Were these deviations likely to have affected the outcome?', hasNA: true },
      { id: 'd2a_5', number: '2.5', text: 'Were these deviations from intended intervention balanced between groups?', hasNA: true },
      { id: 'd2a_6', number: '2.6', text: 'Was an appropriate analysis used to estimate the effect of assignment to intervention?', hasNA: false },
      { id: 'd2a_7', number: '2.7', text: 'Was there potential for a substantial impact of the failure to analyse participants in the group to which they were randomized?', hasNA: true },
    ],
  },
  domain2b: {
    id: 'domain2b',
    name: 'Domain 2: Deviations from intended interventions',
    subtitle: 'Effect of adhering to intervention',
    questions: [
      { id: 'd2b_1', number: '2.1', text: 'Were participants aware of their assigned intervention during the trial?', hasNA: false },
      { id: 'd2b_2', number: '2.2', text: 'Were carers and people delivering the interventions aware of participants\' assigned intervention?', hasNA: false },
      { id: 'd2b_3', number: '2.3', text: 'Were important non-protocol interventions balanced across intervention groups?', hasNA: true },
      { id: 'd2b_4', number: '2.4', text: 'Were there failures in implementing the intervention that could have affected the outcome?', hasNA: true },
      { id: 'd2b_5', number: '2.5', text: 'Was there non-adherence to the assigned intervention regimen that could have affected participants\' outcomes?', hasNA: true },
      { id: 'd2b_6', number: '2.6', text: 'Was an appropriate analysis used to estimate the effect of adhering to the intervention?', hasNA: true },
    ],
  },
  domain3: {
    id: 'domain3',
    name: 'Domain 3: Missing outcome data',
    questions: [
      { id: 'd3_1', number: '3.1', text: 'Were data for this outcome available for all, or nearly all, participants randomized?', hasNA: false },
      { id: 'd3_2', number: '3.2', text: 'Is there evidence that the result was not biased by missing outcome data?', hasNA: true },
      { id: 'd3_3', number: '3.3', text: 'Could missingness in the outcome depend on its true value?', hasNA: true },
      { id: 'd3_4', number: '3.4', text: 'Is it likely that missingness in the outcome depended on its true value?', hasNA: true },
    ],
  },
  domain4: {
    id: 'domain4',
    name: 'Domain 4: Measurement of the outcome',
    questions: [
      { id: 'd4_1', number: '4.1', text: 'Was the method of measuring the outcome inappropriate?', hasNA: false },
      { id: 'd4_2', number: '4.2', text: 'Could measurement or ascertainment of the outcome have differed between intervention groups?', hasNA: false },
      { id: 'd4_3', number: '4.3', text: 'Were outcome assessors aware of the intervention received by study participants?', hasNA: true },
      { id: 'd4_4', number: '4.4', text: 'Could assessment of the outcome have been influenced by knowledge of intervention received?', hasNA: true },
      { id: 'd4_5', number: '4.5', text: 'Is it likely that assessment of the outcome was influenced by knowledge of intervention received?', hasNA: true },
    ],
  },
  domain5: {
    id: 'domain5',
    name: 'Domain 5: Selection of the reported result',
    questions: [
      { id: 'd5_1', number: '5.1', text: 'Were the data that produced this result analysed in accordance with a pre-specified analysis plan?', hasNA: false },
      { id: 'd5_2', number: '5.2', text: 'Is the numerical result being assessed likely to have been selected from multiple eligible outcome measurements?', hasNA: false },
      { id: 'd5_3', number: '5.3', text: 'Is the numerical result being assessed likely to have been selected from multiple eligible analyses of the data?', hasNA: false },
    ],
  },
};

export const ROB2_DOMAIN_KEYS = Object.keys(ROB2_DOMAINS);

export function getActiveDomainKeys(aim: string | null): string[] {
  if (aim === 'ADHERING') {
    return ['domain1', 'domain2b', 'domain3', 'domain4', 'domain5'];
  }
  return ['domain1', 'domain2a', 'domain3', 'domain4', 'domain5'];
}

export function domainJudgementKey(domainId: string): string {
  return `${domainId}.judgement`;
}

export function domainDirectionKey(domainId: string): string {
  return `${domainId}.direction`;
}

// --- Scoring helpers ---

function isYesPY(v: string | null): boolean {
  return v === 'Y' || v === 'PY';
}

function isNoPPN(v: string | null): boolean {
  return v === 'N' || v === 'PN';
}

function isNoPPNNI(v: string | null): boolean {
  return v === 'N' || v === 'PN' || v === 'NI';
}

interface ScoringResult {
  judgement: string | null;
  isComplete: boolean;
}

function scoreDomain1(get: (q: string) => string | null): ScoringResult {
  const q1 = get('d1_1');
  const q2 = get('d1_2');
  const q3 = get('d1_3');

  if (q2 === null) return { judgement: null, isComplete: false };
  if (isNoPPN(q2)) return { judgement: 'High', isComplete: true };

  if (isYesPY(q2)) {
    if (q1 === null) return { judgement: null, isComplete: false };
    if (isNoPPN(q1)) return { judgement: 'Some concerns', isComplete: true };
    if (isYesPY(q1) || q1 === 'NI') {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (isNoPPNNI(q3)) return { judgement: 'Low', isComplete: true };
      if (isYesPY(q3)) return { judgement: 'Some concerns', isComplete: true };
    }
  }

  if (q2 === 'NI') {
    if (q3 === null) return { judgement: null, isComplete: false };
    if (isNoPPNNI(q3)) return { judgement: 'Some concerns', isComplete: true };
    if (isYesPY(q3)) return { judgement: 'High', isComplete: true };
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain2aPart1(get: (q: string) => string | null): ScoringResult {
  const q1 = get('d2a_1');
  const q2 = get('d2a_2');
  const q3 = get('d2a_3');
  const q4 = get('d2a_4');
  const q5 = get('d2a_5');

  if (q1 === null || q2 === null) return { judgement: null, isComplete: false };
  if (isNoPPN(q1) && isNoPPN(q2)) return { judgement: 'Low', isComplete: true };

  if (isYesPY(q1) || isYesPY(q2) || q1 === 'NI' || q2 === 'NI') {
    if (q3 === null) return { judgement: null, isComplete: false };
    if (isNoPPN(q3) || q3 === 'NA') return { judgement: 'Low', isComplete: true };
    if (q3 === 'NI') return { judgement: 'Some concerns', isComplete: true };
    if (isYesPY(q3)) {
      if (q4 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q4) || q4 === 'NA') return { judgement: 'Some concerns', isComplete: true };
      if (isYesPY(q4) || q4 === 'NI') {
        if (q5 === null) return { judgement: null, isComplete: false };
        if (isYesPY(q5) || q5 === 'NA') return { judgement: 'Some concerns', isComplete: true };
        if (isNoPPNNI(q5)) return { judgement: 'High', isComplete: true };
      }
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain2aPart2(get: (q: string) => string | null): ScoringResult {
  const q6 = get('d2a_6');
  const q7 = get('d2a_7');

  if (q6 === null) return { judgement: null, isComplete: false };
  if (isYesPY(q6)) return { judgement: 'Low', isComplete: true };
  if (isNoPPNNI(q6)) {
    if (q7 === null) return { judgement: null, isComplete: false };
    if (isNoPPN(q7) || q7 === 'NA') return { judgement: 'Some concerns', isComplete: true };
    if (isYesPY(q7) || q7 === 'NI') return { judgement: 'High', isComplete: true };
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain2a(get: (q: string) => string | null): ScoringResult {
  const p1 = scoreDomain2aPart1(get);
  const p2 = scoreDomain2aPart2(get);
  if (!p1.isComplete || !p2.isComplete) return { judgement: null, isComplete: false };

  const rank: Record<string, number> = { Low: 0, 'Some concerns': 1, High: 2 };
  const worst = Math.max(rank[p1.judgement!] ?? 0, rank[p2.judgement!] ?? 0);
  const judgement = worst === 2 ? 'High' : worst === 1 ? 'Some concerns' : 'Low';
  return { judgement, isComplete: true };
}

function scoreDomain2b(get: (q: string) => string | null): ScoringResult {
  const q1 = get('d2b_1');
  const q2 = get('d2b_2');
  const q3 = get('d2b_3');
  const q4 = get('d2b_4');
  const q5 = get('d2b_5');
  const q6 = get('d2b_6');

  if (q1 === null || q2 === null) return { judgement: null, isComplete: false };

  if (isNoPPN(q1) && isNoPPN(q2)) {
    if (q4 === null || q5 === null) return { judgement: null, isComplete: false };
    if ((isNoPPN(q4) || q4 === 'NA') && (isNoPPN(q5) || q5 === 'NA'))
      return { judgement: 'Low', isComplete: true };
    if (isYesPY(q4) || isYesPY(q5) || q4 === 'NI' || q5 === 'NI') {
      if (q6 === null) return { judgement: null, isComplete: false };
      if (isYesPY(q6) || q6 === 'NA') return { judgement: 'Some concerns', isComplete: true };
      if (isNoPPNNI(q6)) return { judgement: 'High', isComplete: true };
    }
  }

  if (isYesPY(q1) || isYesPY(q2) || q1 === 'NI' || q2 === 'NI') {
    if (q3 === null) return { judgement: null, isComplete: false };
    if (q3 === 'NA' || isYesPY(q3)) {
      if (q4 === null || q5 === null) return { judgement: null, isComplete: false };
      if ((isNoPPN(q4) || q4 === 'NA') && (isNoPPN(q5) || q5 === 'NA'))
        return { judgement: 'Low', isComplete: true };
      if (isYesPY(q4) || isYesPY(q5) || q4 === 'NI' || q5 === 'NI') {
        if (q6 === null) return { judgement: null, isComplete: false };
        if (isYesPY(q6) || q6 === 'NA') return { judgement: 'Some concerns', isComplete: true };
        if (isNoPPNNI(q6)) return { judgement: 'High', isComplete: true };
      }
    }
    if (isNoPPNNI(q3)) {
      if (q6 === null) return { judgement: null, isComplete: false };
      if (isYesPY(q6) || q6 === 'NA') return { judgement: 'Some concerns', isComplete: true };
      if (isNoPPNNI(q6)) return { judgement: 'High', isComplete: true };
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain3(get: (q: string) => string | null): ScoringResult {
  const q1 = get('d3_1');
  const q2 = get('d3_2');
  const q3 = get('d3_3');
  const q4 = get('d3_4');

  if (q1 === null) return { judgement: null, isComplete: false };
  if (isYesPY(q1)) return { judgement: 'Low', isComplete: true };

  if (isNoPPNNI(q1)) {
    if (q2 === null) return { judgement: null, isComplete: false };
    if (isYesPY(q2)) return { judgement: 'Low', isComplete: true };
    if (isNoPPN(q2) || q2 === 'NI' || q2 === 'NA') {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q3) || q3 === 'NA') return { judgement: 'Low', isComplete: true };
      if (isYesPY(q3) || q3 === 'NI') {
        if (q4 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q4) || q4 === 'NA') return { judgement: 'Some concerns', isComplete: true };
        if (isYesPY(q4) || q4 === 'NI') return { judgement: 'High', isComplete: true };
      }
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain4(get: (q: string) => string | null): ScoringResult {
  const q1 = get('d4_1');
  const q2 = get('d4_2');
  const q3 = get('d4_3');
  const q4 = get('d4_4');
  const q5 = get('d4_5');

  if (q1 === null) return { judgement: null, isComplete: false };
  if (isYesPY(q1)) return { judgement: 'High', isComplete: true };

  if (isNoPPNNI(q1)) {
    if (q2 === null) return { judgement: null, isComplete: false };
    if (isYesPY(q2)) return { judgement: 'High', isComplete: true };

    if (isNoPPN(q2)) {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q3) || q3 === 'NA') return { judgement: 'Low', isComplete: true };
      if (isYesPY(q3) || q3 === 'NI') {
        if (q4 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q4) || q4 === 'NA') return { judgement: 'Low', isComplete: true };
        if (isYesPY(q4) || q4 === 'NI') {
          if (q5 === null) return { judgement: null, isComplete: false };
          if (isNoPPN(q5) || q5 === 'NA') return { judgement: 'Some concerns', isComplete: true };
          if (isYesPY(q5) || q5 === 'NI') return { judgement: 'High', isComplete: true };
        }
      }
    }

    if (q2 === 'NI') {
      if (q3 === null) return { judgement: null, isComplete: false };
      if (isNoPPN(q3) || q3 === 'NA') return { judgement: 'Some concerns', isComplete: true };
      if (isYesPY(q3) || q3 === 'NI') {
        if (q4 === null) return { judgement: null, isComplete: false };
        if (isNoPPN(q4) || q4 === 'NA') return { judgement: 'Some concerns', isComplete: true };
        if (isYesPY(q4) || q4 === 'NI') {
          if (q5 === null) return { judgement: null, isComplete: false };
          if (isNoPPN(q5) || q5 === 'NA') return { judgement: 'Some concerns', isComplete: true };
          if (isYesPY(q5) || q5 === 'NI') return { judgement: 'High', isComplete: true };
        }
      }
    }
  }

  return { judgement: null, isComplete: false };
}

function scoreDomain5(get: (q: string) => string | null): ScoringResult {
  const q1 = get('d5_1');
  const q2 = get('d5_2');
  const q3 = get('d5_3');

  if (q2 === null || q3 === null) return { judgement: null, isComplete: false };
  if (isYesPY(q2) || isYesPY(q3)) return { judgement: 'High', isComplete: true };
  if ((q2 === 'NI' || q3 === 'NI') && !isYesPY(q2) && !isYesPY(q3))
    return { judgement: 'Some concerns', isComplete: true };

  if (isNoPPN(q2) && isNoPPN(q3)) {
    if (q1 === null) return { judgement: null, isComplete: false };
    if (isYesPY(q1)) return { judgement: 'Low', isComplete: true };
    if (isNoPPNNI(q1)) return { judgement: 'Some concerns', isComplete: true };
  }

  return { judgement: null, isComplete: false };
}

const DOMAIN_SCORERS: Record<string, (get: (q: string) => string | null) => ScoringResult> = {
  domain1: scoreDomain1,
  domain2a: scoreDomain2a,
  domain2b: scoreDomain2b,
  domain3: scoreDomain3,
  domain4: scoreDomain4,
  domain5: scoreDomain5,
};

export function scoreROB2Domain(domainKey: string, get: (q: string) => string | null): ScoringResult {
  const scorer = DOMAIN_SCORERS[domainKey];
  if (!scorer) return { judgement: null, isComplete: false };
  return scorer(get);
}

export function scoreROB2(
  getAnswer: (key: string) => string | null,
  aim: string | null,
): ROB2Score {
  const active = getActiveDomainKeys(aim);
  const judgements: string[] = [];

  for (const domainKey of active) {
    const result = scoreROB2Domain(domainKey, getAnswer);
    if (!result.isComplete) return 'Incomplete';
    judgements.push(result.judgement!);
  }

  if (judgements.includes('High')) return 'High';
  if (judgements.includes('Some concerns')) return 'Some concerns';
  return 'Low';
}
