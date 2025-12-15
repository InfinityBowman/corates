// ROBINS-I V2 Checklist Map
// Risk Of Bias In Non-randomized Studies – of Interventions, Version 2

// Response option types used across different questions
export const RESPONSE_TYPES = {
  YN: ['Y', 'N'], // Yes, No
  STANDARD: ['Y', 'PY', 'PN', 'N'], // Yes, Probably Yes, Probably No, No
  WITH_NI: ['Y', 'PY', 'PN', 'N', 'NI'], // With No Information
  WITH_NA: ['NA', 'Y', 'PY', 'PN', 'N', 'NI'], // With Not Applicable
  WEAK_STRONG_NO: ['Y', 'PY', 'WN', 'SN', 'NI'], // With Weak No, Strong No
  WEAK_STRONG_NO_NA: ['NA', 'Y', 'PY', 'WN', 'SN', 'NI'],
  WEAK_STRONG_YES: ['SY', 'WY', 'PN', 'N', 'NI'], // Strong Yes, Weak Yes
  WEAK_STRONG_YES_NA: ['NA', 'SY', 'WY', 'PN', 'N', 'NI'],
};

// Human-readable labels for response options
export const RESPONSE_LABELS = {
  Y: 'Yes',
  PY: 'Probably Yes',
  PN: 'Probably No',
  N: 'No',
  NI: 'No Information',
  NA: 'Not Applicable',
  WN: 'No, but not substantial',
  SN: 'No, and probably substantial',
  SY: 'Yes, substantially',
  WY: 'Yes, but not substantially',
};

// Risk of bias judgement options
export const ROB_JUDGEMENTS = [
  'Low',
  'Low (except for concerns about uncontrolled confounding)',
  'Moderate',
  'Serious',
  'Critical',
];

// Overall ROB includes special option for confounding
export const OVERALL_ROB_JUDGEMENTS = [
  'Low risk of bias except for concerns about uncontrolled confounding',
  'Moderate risk',
  'Serious risk',
  'Critical risk',
];

// Bias direction options
export const BIAS_DIRECTIONS = [
  'Upward bias (overestimate the effect)',
  'Downward bias (underestimate the effect)',
  'Favours intervention',
  'Favours comparator',
  'Towards null',
  'Away from null',
  'Unpredictable',
];

// Domain 1 specific directions (subset)
export const DOMAIN1_DIRECTIONS = [
  'Upward bias (overestimate the effect)',
  'Downward bias (underestimate the effect)',
  'Unpredictable',
];

// Information sources for Section D
export const INFORMATION_SOURCES = [
  'Journal article(s)',
  'Study protocol',
  'Statistical analysis plan (SAP)',
  'Non-commercial registry record (e.g. ClinicalTrials.gov)',
  'Company-owned registry record',
  'Grey literature (e.g. unpublished thesis)',
  'Conference abstract(s)',
  'Regulatory document (e.g. CSR, approval package)',
  'Individual participant data',
  'Research ethics application',
  'Grant database summary (e.g. NIH RePORTER)',
  'Personal communication with investigator',
  'Personal communication with sponsor',
  'Other',
];

// Checklist type definition
export const CHECKLIST_TYPES = {
  ROBINS_I: {
    name: 'ROBINS-I V2',
    description: 'Risk Of Bias In Non-randomized Studies – of Interventions (Version 2)',
  },
};

// Section B: Decide whether to proceed with a risk-of-bias assessment
export const SECTION_B = {
  b1: {
    id: 'b1',
    text: 'Did the authors make any attempt to control for confounding in the result being assessed?',
    responseType: 'STANDARD',
  },
  b2: {
    id: 'b2',
    text: 'If N/PN to B1: Is there sufficient potential for confounding that this result should not be considered further?',
    responseType: 'STANDARD',
    info: "If the answer to B2 is 'Yes' or 'Probably yes', the result should be considered to be at 'Critical risk of bias' and no further assessment is required.",
  },
  b3: {
    id: 'b3',
    text: 'Was the method of measuring the outcome inappropriate?',
    responseType: 'STANDARD',
    info: "If the answer to B3 is 'Yes' or 'Probably yes', the result should be considered to be at 'Critical risk of bias' and no further assessment is required.",
  },
};

// Domain 1A: Bias due to confounding (Intention-to-Treat Effect)
export const DOMAIN_1A = {
  id: 'domain1a',
  name: 'Domain 1: Bias due to confounding',
  subtitle:
    'Variant A (the analysis is estimating the intention-to-treat effect so only baseline confounding needs to be addressed)',
  questions: {
    d1a_1: {
      id: 'd1a_1',
      number: '1.1',
      text: 'Did the authors control for all the important confounding factors for which this was necessary?',
      responseType: 'WEAK_STRONG_NO',
    },
    d1a_2: {
      id: 'd1a_2',
      number: '1.2',
      text: 'If Y/PY/WN to 1.1: Were confounding factors that were controlled for (and for which control was necessary) measured validly and reliably by the variables available in this study?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d1a_3: {
      id: 'd1a_3',
      number: '1.3',
      text: 'If Y/PY/WN to 1.1: Did the authors control for any post-intervention variables that could have been affected by the intervention?',
      responseType: 'WITH_NA',
    },
    d1a_4: {
      id: 'd1a_4',
      number: '1.4',
      text: 'Did the use of negative controls, quantitative bias analysis, or other considerations, suggest serious uncontrolled confounding?',
      responseType: 'STANDARD',
    },
  },
  hasDirection: true,
  directionOptions: DOMAIN1_DIRECTIONS,
};

// Domain 1B: Bias due to confounding (Per-Protocol Effect)
export const DOMAIN_1B = {
  id: 'domain1b',
  name: 'Domain 1: Bias due to confounding',
  subtitle:
    'Variant B (the analysis is estimating the per-protocol effect so both baseline and time-varying confounding need to be addressed)',
  questions: {
    d1b_1: {
      id: 'd1b_1',
      number: '1.1',
      text: 'Did the authors use an analysis method that was appropriate to control for time-varying as well as baseline confounding?',
      responseType: 'WITH_NI',
    },
    d1b_2: {
      id: 'd1b_2',
      number: '1.2',
      text: 'If Y/PY to 1.1: Did the authors control for all the important baseline and time-varying confounding factors for which this was necessary?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d1b_3: {
      id: 'd1b_3',
      number: '1.3',
      text: 'If Y/PY/WN to 1.2: Were confounding factors that were controlled for (and for which control was necessary) measured validly and reliably by the variables available in this study?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d1b_4: {
      id: 'd1b_4',
      number: '1.4',
      text: 'If N/PN/NI to 1.1: Did the authors control for time-varying factors or other variables measured after the start of intervention?',
      responseType: 'WITH_NA',
    },
    d1b_5: {
      id: 'd1b_5',
      number: '1.5',
      text: 'Did the use of negative controls, or other considerations, suggest serious uncontrolled confounding?',
      responseType: 'STANDARD',
    },
  },
  hasDirection: true,
  directionOptions: DOMAIN1_DIRECTIONS,
};

// Domain 2: Bias in classification of interventions
export const DOMAIN_2 = {
  id: 'domain2',
  name: 'Domain 2: Bias in classification of interventions',
  questions: {
    d2_1: {
      id: 'd2_1',
      number: '2.1',
      text: 'Were the intervention strategies distinguishable at the time when follow-up would have started in the target trial?',
      responseType: 'WITH_NI',
    },
    d2_2: {
      id: 'd2_2',
      number: '2.2',
      text: 'If N/PN/NI to 2.1: Did all or nearly all outcome events occur after the intervention and comparator strategies could be distinguished?',
      responseType: 'WITH_NA',
    },
    d2_3: {
      id: 'd2_3',
      number: '2.3',
      text: 'If N/PN/NI to 2.2: Did the analysis avoid problems arising from intervention strategies that are not distinguishable at the start of follow-up?',
      responseType: 'WEAK_STRONG_YES_NA',
    },
    d2_4: {
      id: 'd2_4',
      number: '2.4',
      text: 'Was classification of intervention status influenced by knowledge of the outcome or risk of the outcome?',
      responseType: 'WEAK_STRONG_YES',
    },
    d2_5: {
      id: 'd2_5',
      number: '2.5',
      text: 'Were further classification errors (not influenced by knowledge of the outcome or risk of the outcome) likely?',
      responseType: 'WITH_NI',
    },
  },
  hasDirection: true,
  directionOptions: BIAS_DIRECTIONS,
};

// Domain 3: Bias in selection of participants into the study (or into the analysis)
export const DOMAIN_3 = {
  id: 'domain3',
  name: 'Domain 3: Bias in selection of participants into the study (or into the analysis)',
  subsections: {
    a: {
      name: 'A. Questions about prevalent user bias and immortal time',
      questions: {
        d3_1: {
          id: 'd3_1',
          number: '3.1',
          text: 'Did follow up in the analysis begin at the start of the intervention strategies being compared?',
          responseType: 'WEAK_STRONG_NO',
        },
        d3_2: {
          id: 'd3_2',
          number: '3.2',
          text: 'If Y/PY to 3.1: Were outcome events during a period of follow-up after the start of the interventions excluded from the analysis?',
          responseType: 'WITH_NI',
        },
      },
    },
    b: {
      name: 'B. Questions about other types of selection bias',
      questions: {
        d3_3: {
          id: 'd3_3',
          number: '3.3',
          text: 'Was selection of participants into the study (or into the analysis) based on participant characteristics observed after the start of intervention (additional to the situations addressed in 3.1 and 3.2)?',
          responseType: 'WITH_NI',
        },
        d3_4: {
          id: 'd3_4',
          number: '3.4',
          text: 'If Y/PY to 3.3: Were the post-intervention variables that influenced selection likely to be associated with intervention?',
          responseType: 'WITH_NA',
        },
        d3_5: {
          id: 'd3_5',
          number: '3.5',
          text: 'If Y/PY to 3.4: Were the post-intervention variables that influenced selection likely to be influenced by the outcome or a cause of the outcome?',
          responseType: 'WITH_NA',
        },
      },
    },
    c: {
      name: 'C. Questions about analysis, sensitivity analyses and severity of the problem',
      questions: {
        d3_6: {
          id: 'd3_6',
          number: '3.6',
          text: 'If SN to 3.1 or Y/PY to 3.5: Is it likely that the analysis corrected for all of the potential selection biases identified above?',
          responseType: 'WITH_NA',
        },
        d3_7: {
          id: 'd3_7',
          number: '3.7',
          text: 'If N/PN/NI to 3.6: Did sensitivity analyses demonstrate that the likely impact of the potential selection biases identified above was minimal?',
          responseType: 'WITH_NA',
        },
        d3_8: {
          id: 'd3_8',
          number: '3.8',
          text: 'If N/PN/NI to 3.7: Were potential selection biases identified above sufficiently severe that the result should not be included in a quantitative synthesis?',
          responseType: 'WITH_NA',
        },
      },
    },
  },
  hasDirection: true,
  directionOptions: BIAS_DIRECTIONS,
};

// Domain 4: Bias due to missing data
export const DOMAIN_4 = {
  id: 'domain4',
  name: 'Domain 4: Bias due to missing data',
  questions: {
    d4_1: {
      id: 'd4_1',
      number: '4.1',
      text: 'Were complete data on intervention status available for all, or nearly all, participants?',
      responseType: 'WITH_NI',
    },
    d4_2: {
      id: 'd4_2',
      number: '4.2',
      text: 'Were complete data on the outcome available for all, or nearly all, participants?',
      responseType: 'WITH_NI',
    },
    d4_3: {
      id: 'd4_3',
      number: '4.3',
      text: 'Were complete data on important confounding variables available for all, or nearly all, participants?',
      responseType: 'WITH_NI',
    },
    d4_4: {
      id: 'd4_4',
      number: '4.4',
      text: 'If N/PN/NI to 4.1, 4.2 or 4.3: Is the result based on a complete case analysis?',
      responseType: 'WITH_NA',
    },
    d4_5: {
      id: 'd4_5',
      number: '4.5',
      text: 'If Y/PY/NI to 4.4: Was exclusion from the analysis because of missing data (in intervention, confounders or the outcome) likely to be related to the true value of the outcome?',
      responseType: 'WITH_NA',
    },
    d4_6: {
      id: 'd4_6',
      number: '4.6',
      text: 'If Y/PY/NI to 4.5: Is the relationship between the outcome and missingness likely to be explained by the variables in the analysis model?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d4_7: {
      id: 'd4_7',
      number: '4.7',
      text: 'If N/PN to 4.4: Was the analysis based on imputing missing values?',
      responseType: 'WITH_NA',
      note: 'Response options: NA / Y / PY / PN / NI',
    },
    d4_8: {
      id: 'd4_8',
      number: '4.8',
      text: "If Y/PY to 4.7: Is it reasonable to assume that data were 'missing at random' (MAR) or 'missing completely at random' (MCAR)?",
      responseType: 'WITH_NA',
    },
    d4_9: {
      id: 'd4_9',
      number: '4.9',
      text: 'If Y/PY to 4.8: Was imputation performed appropriately?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d4_10: {
      id: 'd4_10',
      number: '4.10',
      text: 'If N/PN/NI to 4.7: Was an appropriate alternative method used to correct for bias due to missing data?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d4_11: {
      id: 'd4_11',
      number: '4.11',
      text: 'If PN/N/NI to 4.1, 4.2 or 4.3 AND (Y/PY/NI to 4.5 OR WN/SN/NI to 4.9 OR WN/SN/NI to 4.10): Is there evidence that the result was not biased by missing data?',
      responseType: 'WITH_NA',
      note: 'Response options: NA / Y / PY / PN / N',
    },
  },
  hasDirection: true,
  directionOptions: BIAS_DIRECTIONS,
};

// Domain 5: Bias in measurement of the outcome
export const DOMAIN_5 = {
  id: 'domain5',
  name: 'Domain 5: Bias in measurement of the outcome',
  questions: {
    d5_1: {
      id: 'd5_1',
      number: '5.1',
      text: 'Could measurement or ascertainment of the outcome have differed between intervention groups?',
      responseType: 'WITH_NI',
    },
    d5_2: {
      id: 'd5_2',
      number: '5.2',
      text: 'Were outcome assessors aware of the intervention received by study participants?',
      responseType: 'WITH_NI',
    },
    d5_3: {
      id: 'd5_3',
      number: '5.3',
      text: 'If Y/PY/NI to 5.2: Could assessment of the outcome have been influenced by knowledge of the intervention received?',
      responseType: 'WEAK_STRONG_YES_NA',
    },
  },
  hasDirection: true,
  directionOptions: BIAS_DIRECTIONS,
};

// Domain 6: Bias in selection of the reported result
export const DOMAIN_6 = {
  id: 'domain6',
  name: 'Domain 6: Bias in selection of the reported result',
  questions: {
    d6_1: {
      id: 'd6_1',
      number: '6.1',
      text: 'Was the result reported in accordance with an available, pre-determined analysis plan?',
      responseType: 'WITH_NI',
    },
    d6_2: {
      id: 'd6_2',
      number: '6.2',
      text: 'Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple outcome measurements (e.g. scales, definitions, time points) within the outcome domain?',
      responseType: 'WITH_NI',
    },
    d6_3: {
      id: 'd6_3',
      number: '6.3',
      text: 'Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple analyses of the data?',
      responseType: 'WITH_NI',
    },
    d6_4: {
      id: 'd6_4',
      number: '6.4',
      text: 'Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple subgroups?',
      responseType: 'WITH_NI',
    },
  },
  hasDirection: true,
  directionOptions: BIAS_DIRECTIONS,
};

// Complete ROBINS-I checklist structure
export const ROBINS_I_CHECKLIST = {
  sectionB: SECTION_B,
  domain1a: DOMAIN_1A,
  domain1b: DOMAIN_1B,
  domain2: DOMAIN_2,
  domain3: DOMAIN_3,
  domain4: DOMAIN_4,
  domain5: DOMAIN_5,
  domain6: DOMAIN_6,
};

// Get all domain keys (for iteration)
export function getDomainKeys() {
  return ['domain1a', 'domain1b', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6'];
}

// Get domains that should be displayed based on C4 answer
export function getActiveDomainKeys(isPerProtocol) {
  const base = ['domain2', 'domain3', 'domain4', 'domain5', 'domain6'];
  return isPerProtocol ? ['domain1b', ...base] : ['domain1a', ...base];
}

// Get all questions for a domain (flattened)
export function getDomainQuestions(domainKey) {
  const domain = ROBINS_I_CHECKLIST[domainKey];
  if (!domain) return {};

  if (domain.subsections) {
    // Domain 3 has subsections
    let allQuestions = {};
    Object.values(domain.subsections).forEach(subsection => {
      allQuestions = { ...allQuestions, ...subsection.questions };
    });
    return allQuestions;
  }

  return domain.questions || {};
}

// Get response options array for a response type
export function getResponseOptions(responseType) {
  return RESPONSE_TYPES[responseType] || RESPONSE_TYPES.WITH_NI;
}
