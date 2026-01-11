/**
 * ROB-2 Checklist Schema
 *
 * Risk of Bias 2 tool for assessing risk of bias in randomized trials.
 * Based on the Cochrane RoB 2.0 tool.
 */

// Response option types
export const RESPONSE_TYPES = {
  STANDARD: ['Y', 'PY', 'PN', 'N', 'NI'] as const,
  WITH_NA: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] as const,
} as const;

export type ResponseType = keyof typeof RESPONSE_TYPES;
export type ResponseValue = (typeof RESPONSE_TYPES)[ResponseType][number];

// Human-readable labels for response options
export const RESPONSE_LABELS: Record<string, string> = {
  NA: 'Not Applicable',
  Y: 'Yes',
  PY: 'Probably Yes',
  PN: 'Probably No',
  N: 'No',
  NI: 'No Information',
};

// Risk of bias judgement options
export const JUDGEMENTS = {
  LOW: 'Low',
  SOME_CONCERNS: 'Some concerns',
  HIGH: 'High',
} as const;

export type Judgement = (typeof JUDGEMENTS)[keyof typeof JUDGEMENTS];

// Bias direction options
export const BIAS_DIRECTIONS = [
  'NA',
  'Favours experimental',
  'Favours comparator',
  'Towards null',
  'Away from null',
  'Unpredictable',
] as const;

// Study design options
export const STUDY_DESIGNS = [
  'Individually-randomized parallel-group trial',
  'Cluster-randomized parallel-group trial',
  'Individually randomized cross-over (or other matched) trial',
] as const;

// Aim options (determines Domain 2 variant)
export const AIM_OPTIONS = {
  ASSIGNMENT: 'to assess the effect of assignment to intervention (the intention-to-treat effect)',
  ADHERING: 'to assess the effect of adhering to intervention (the per-protocol effect)',
} as const;

// Deviations to address (for adhering aim)
export const DEVIATION_OPTIONS = [
  'occurrence of non-protocol interventions',
  'failures in implementing the intervention that could have affected the outcome',
  'non-adherence to their assigned intervention by trial participants',
] as const;

// Information sources
export const INFORMATION_SOURCES = [
  'Journal article(s)',
  'Trial protocol',
  'Statistical analysis plan (SAP)',
  'Non-commercial trial registry record (e.g. ClinicalTrials.gov record)',
  'Company-owned trial registry record (e.g. GSK Clinical Study Register record)',
  'Grey literature (e.g. unpublished thesis)',
  'Conference abstract(s) about the trial',
  'Regulatory document (e.g. Clinical Study Report, Drug Approval Package)',
  'Research ethics application',
  'Grant database summary (e.g. NIH RePORTER or Research Councils UK Gateway to Research)',
  'Personal communication with trialist',
  'Personal communication with the sponsor',
] as const;

export interface ROB2Question {
  id: string;
  number?: string;
  text: string;
  responseType: ResponseType;
  info?: string;
}

export interface ROB2Domain {
  id: string;
  name: string;
  subtitle?: string;
  questions: Record<string, ROB2Question>;
  hasDirection: boolean;
}

// Preliminary Section Schema
export const PRELIMINARY_SECTION = {
  studyDesign: {
    id: 'studyDesign',
    label: 'Study design',
    options: STUDY_DESIGNS,
  },
  experimental: {
    id: 'experimental',
    label: 'Experimental intervention',
    placeholder: 'Specify the experimental intervention...',
  },
  comparator: {
    id: 'comparator',
    label: 'Comparator',
    placeholder: 'Specify the comparator intervention...',
  },
  numericalResult: {
    id: 'numericalResult',
    label: 'Specify the numerical result being assessed',
    placeholder: 'e.g. RR = 1.52 (95% CI 0.83 to 2.77) or reference to table/figure',
  },
  aim: {
    id: 'aim',
    label: "Is the review team's aim for this result...?",
    options: AIM_OPTIONS,
  },
  deviationsToAddress: {
    id: 'deviationsToAddress',
    label: 'Select the deviations from intended intervention that should be addressed',
    options: DEVIATION_OPTIONS,
    info: 'At least one must be checked when assessing the effect of adhering to intervention',
  },
  sources: {
    id: 'sources',
    label: 'Which sources were obtained to help inform the risk-of-bias assessment?',
    options: INFORMATION_SOURCES,
  },
} as const;

// Domain 1: Bias arising from the randomization process
export const DOMAIN_1: ROB2Domain = {
  id: 'domain1',
  name: 'Domain 1: Bias arising from the randomization process',
  questions: {
    d1_1: {
      id: 'd1_1',
      number: '1.1',
      text: 'Was the allocation sequence random?',
      responseType: 'STANDARD',
      info: "Answer 'Yes' if a random component was used in the sequence generation process (e.g. computer-generated random numbers, random number table, coin tossing). Answer 'No' if no random element was used or the sequence is predictable.",
    },
    d1_2: {
      id: 'd1_2',
      number: '1.2',
      text: 'Was the allocation sequence concealed until participants were enrolled and assigned to interventions?',
      responseType: 'STANDARD',
      info: "Answer 'Yes' if the trial used remote or centrally administered allocation, or if envelopes/drug containers were used appropriately.",
    },
    d1_3: {
      id: 'd1_3',
      number: '1.3',
      text: 'Did baseline differences between intervention groups suggest a problem with the randomization process?',
      responseType: 'STANDARD',
      info: "Answer 'No' if no imbalances are apparent or if any observed imbalances are compatible with chance.",
    },
  },
  hasDirection: true,
};

// Domain 2a: Deviations from intended interventions (effect of assignment)
export const DOMAIN_2A: ROB2Domain = {
  id: 'domain2a',
  name: 'Domain 2: Risk of bias due to deviations from the intended interventions',
  subtitle: 'Effect of assignment to intervention',
  questions: {
    d2a_1: {
      id: 'd2a_1',
      number: '2.1',
      text: 'Were participants aware of their assigned intervention during the trial?',
      responseType: 'STANDARD',
    },
    d2a_2: {
      id: 'd2a_2',
      number: '2.2',
      text: "Were carers and people delivering the interventions aware of participants' assigned intervention during the trial?",
      responseType: 'STANDARD',
    },
    d2a_3: {
      id: 'd2a_3',
      number: '2.3',
      text: 'If Y/PY/NI to 2.1 or 2.2: Were there deviations from the intended intervention that arose because of the trial context?',
      responseType: 'WITH_NA',
      info: "Answer 'Yes' only if there is evidence that the trial context led to failure to implement the protocol interventions.",
    },
    d2a_4: {
      id: 'd2a_4',
      number: '2.4',
      text: 'If Y/PY to 2.3: Were these deviations likely to have affected the outcome?',
      responseType: 'WITH_NA',
    },
    d2a_5: {
      id: 'd2a_5',
      number: '2.5',
      text: 'If Y/PY/NI to 2.4: Were these deviations from intended intervention balanced between groups?',
      responseType: 'WITH_NA',
    },
    d2a_6: {
      id: 'd2a_6',
      number: '2.6',
      text: 'Was an appropriate analysis used to estimate the effect of assignment to intervention?',
      responseType: 'STANDARD',
      info: 'Both ITT and modified ITT analyses should be considered appropriate. Per-protocol and as-treated analyses should be considered inappropriate.',
    },
    d2a_7: {
      id: 'd2a_7',
      number: '2.7',
      text: 'If N/PN/NI to 2.6: Was there potential for a substantial impact (on the result) of the failure to analyse participants in the group to which they were randomized?',
      responseType: 'WITH_NA',
    },
  },
  hasDirection: true,
};

// Domain 2b: Deviations from intended interventions (effect of adhering)
export const DOMAIN_2B: ROB2Domain = {
  id: 'domain2b',
  name: 'Domain 2: Risk of bias due to deviations from the intended interventions',
  subtitle: 'Effect of adhering to intervention',
  questions: {
    d2b_1: {
      id: 'd2b_1',
      number: '2.1',
      text: 'Were participants aware of their assigned intervention during the trial?',
      responseType: 'STANDARD',
    },
    d2b_2: {
      id: 'd2b_2',
      number: '2.2',
      text: "Were carers and people delivering the interventions aware of participants' assigned intervention during the trial?",
      responseType: 'STANDARD',
    },
    d2b_3: {
      id: 'd2b_3',
      number: '2.3',
      text: '[If applicable:] If Y/PY/NI to 2.1 or 2.2: Were important non-protocol interventions balanced across intervention groups?',
      responseType: 'WITH_NA',
    },
    d2b_4: {
      id: 'd2b_4',
      number: '2.4',
      text: '[If applicable:] Were there failures in implementing the intervention that could have affected the outcome?',
      responseType: 'WITH_NA',
    },
    d2b_5: {
      id: 'd2b_5',
      number: '2.5',
      text: "[If applicable:] Was there non-adherence to the assigned intervention regimen that could have affected participants' outcomes?",
      responseType: 'WITH_NA',
    },
    d2b_6: {
      id: 'd2b_6',
      number: '2.6',
      text: 'If N/PN/NI to 2.3, or Y/PY/NI to 2.4 or 2.5: Was an appropriate analysis used to estimate the effect of adhering to the intervention?',
      responseType: 'WITH_NA',
      info: 'Naïve per-protocol and as-treated analyses are usually inappropriate. Appropriate methods include instrumental variable analyses or inverse probability weighting.',
    },
  },
  hasDirection: true,
};

// Domain 3: Missing outcome data
export const DOMAIN_3: ROB2Domain = {
  id: 'domain3',
  name: 'Domain 3: Risk of bias due to missing outcome data',
  questions: {
    d3_1: {
      id: 'd3_1',
      number: '3.1',
      text: 'Were data for this outcome available for all, or nearly all, participants randomized?',
      responseType: 'STANDARD',
      info: 'For continuous outcomes, availability of data from 95% of participants will often be sufficient.',
    },
    d3_2: {
      id: 'd3_2',
      number: '3.2',
      text: 'If N/PN/NI to 3.1: Is there evidence that the result was not biased by missing outcome data?',
      responseType: 'WITH_NA',
    },
    d3_3: {
      id: 'd3_3',
      number: '3.3',
      text: 'If N/PN to 3.2: Could missingness in the outcome depend on its true value?',
      responseType: 'WITH_NA',
    },
    d3_4: {
      id: 'd3_4',
      number: '3.4',
      text: 'If Y/PY/NI to 3.3: Is it likely that missingness in the outcome depended on its true value?',
      responseType: 'WITH_NA',
    },
  },
  hasDirection: true,
};

// Domain 4: Measurement of the outcome
export const DOMAIN_4: ROB2Domain = {
  id: 'domain4',
  name: 'Domain 4: Risk of bias in measurement of the outcome',
  questions: {
    d4_1: {
      id: 'd4_1',
      number: '4.1',
      text: 'Was the method of measuring the outcome inappropriate?',
      responseType: 'STANDARD',
    },
    d4_2: {
      id: 'd4_2',
      number: '4.2',
      text: 'Could measurement or ascertainment of the outcome have differed between intervention groups?',
      responseType: 'STANDARD',
    },
    d4_3: {
      id: 'd4_3',
      number: '4.3',
      text: 'If N/PN/NI to 4.1 and 4.2: Were outcome assessors aware of the intervention received by study participants?',
      responseType: 'WITH_NA',
    },
    d4_4: {
      id: 'd4_4',
      number: '4.4',
      text: 'If Y/PY/NI to 4.3: Could assessment of the outcome have been influenced by knowledge of intervention received?',
      responseType: 'WITH_NA',
    },
    d4_5: {
      id: 'd4_5',
      number: '4.5',
      text: 'If Y/PY/NI to 4.4: Is it likely that assessment of the outcome was influenced by knowledge of intervention received?',
      responseType: 'WITH_NA',
    },
  },
  hasDirection: true,
};

// Domain 5: Selection of the reported result
export const DOMAIN_5: ROB2Domain = {
  id: 'domain5',
  name: 'Domain 5: Risk of bias in selection of the reported result',
  questions: {
    d5_1: {
      id: 'd5_1',
      number: '5.1',
      text: 'Were the data that produced this result analysed in accordance with a pre-specified analysis plan that was finalized before unblinded outcome data were available for analysis?',
      responseType: 'STANDARD',
    },
    d5_2: {
      id: 'd5_2',
      number: '5.2',
      text: 'Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible outcome measurements (e.g. scales, definitions, time points) within the outcome domain?',
      responseType: 'STANDARD',
    },
    d5_3: {
      id: 'd5_3',
      number: '5.3',
      text: 'Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible analyses of the data?',
      responseType: 'STANDARD',
    },
  },
  hasDirection: true,
};

// Complete ROB-2 checklist structure
export const ROB2_CHECKLIST = {
  domain1: DOMAIN_1,
  domain2a: DOMAIN_2A,
  domain2b: DOMAIN_2B,
  domain3: DOMAIN_3,
  domain4: DOMAIN_4,
  domain5: DOMAIN_5,
} as const;

export type DomainKey = 'domain1' | 'domain2a' | 'domain2b' | 'domain3' | 'domain4' | 'domain5';

// Get all domain keys
export function getDomainKeys(): DomainKey[] {
  return ['domain1', 'domain2a', 'domain2b', 'domain3', 'domain4', 'domain5'];
}

// Get active domain keys based on aim selection
export function getActiveDomainKeys(isAdhering: boolean): DomainKey[] {
  return isAdhering ?
      ['domain1', 'domain2b', 'domain3', 'domain4', 'domain5']
    : ['domain1', 'domain2a', 'domain3', 'domain4', 'domain5'];
}

// Get questions for a domain
export function getDomainQuestions(domainKey: string): Record<string, ROB2Question> {
  const domain = ROB2_CHECKLIST[domainKey as keyof typeof ROB2_CHECKLIST];
  if (!domain) return {};
  return domain.questions || {};
}

// Get response options for a response type
export function getResponseOptions(responseType: ResponseType): readonly string[] {
  return RESPONSE_TYPES[responseType] || RESPONSE_TYPES.STANDARD;
}
