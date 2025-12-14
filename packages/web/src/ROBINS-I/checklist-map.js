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
  WN: 'Weak No',
  SN: 'Strong No',
  SY: 'Strong Yes',
  WY: 'Weak Yes',
};

// Risk of bias judgement options
export const ROB_JUDGEMENTS = ['Low', 'Moderate', 'Serious', 'Critical'];

// Overall ROB includes special option for confounding
export const OVERALL_ROB_JUDGEMENTS = [
  'Low (except confounding)',
  'Moderate',
  'Serious',
  'Critical',
];

// Bias direction options
export const BIAS_DIRECTIONS = [
  'Upward',
  'Downward',
  'Favours intervention',
  'Favours comparator',
  'Towards null',
  'Away from null',
  'Unpredictable',
];

// Domain 1 specific directions (subset)
export const DOMAIN1_DIRECTIONS = ['Upward', 'Downward', 'Unpredictable'];

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

// Section B: Decide whether to proceed
export const SECTION_B = {
  b1: {
    id: 'b1',
    text: 'Did the authors attempt to control for confounding?',
    responseType: 'STANDARD',
  },
  b2: {
    id: 'b2',
    text: 'If N/PN to B1: Is there sufficient potential for confounding that this result should not be considered further?',
    responseType: 'STANDARD',
    info: 'If Yes or Probably Yes, classify as Critical risk of bias and stop assessment.',
  },
  b3: {
    id: 'b3',
    text: 'Was the method of measuring the outcome inappropriate?',
    responseType: 'STANDARD',
    info: 'If Yes or Probably Yes, classify as Critical risk of bias and stop assessment.',
  },
};

// Domain 1A: Bias due to confounding (Intention-to-Treat Effect)
export const DOMAIN_1A = {
  id: 'domain1a',
  name: 'Domain 1: Bias Due to Confounding',
  subtitle: 'Variant A - Intention-to-Treat Effect (C4 = No)',
  questions: {
    d1a_1: {
      id: 'd1a_1',
      number: '1.1',
      text: 'Control for all important confounders?',
      responseType: 'WEAK_STRONG_NO',
    },
    d1a_2: {
      id: 'd1a_2',
      number: '1.2',
      text: 'Valid & reliable measurement of controlled confounders?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d1a_3: {
      id: 'd1a_3',
      number: '1.3',
      text: 'Controlled for post-intervention variables?',
      responseType: 'WITH_NA',
    },
    d1a_4: {
      id: 'd1a_4',
      number: '1.4',
      text: 'Evidence of serious uncontrolled confounding?',
      responseType: 'STANDARD',
    },
  },
  hasDirection: true,
  directionOptions: DOMAIN1_DIRECTIONS,
};

// Domain 1B: Bias due to confounding (Per-Protocol Effect)
export const DOMAIN_1B = {
  id: 'domain1b',
  name: 'Domain 1: Bias Due to Confounding',
  subtitle: 'Variant B - Per-Protocol Effect (C4 = Yes)',
  questions: {
    d1b_1: {
      id: 'd1b_1',
      number: '1.1',
      text: 'Appropriate method for time-varying confounding?',
      responseType: 'WITH_NI',
    },
    d1b_2: {
      id: 'd1b_2',
      number: '1.2',
      text: 'Controlled all important baseline & time-varying confounders?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d1b_3: {
      id: 'd1b_3',
      number: '1.3',
      text: 'Valid & reliable measurement?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d1b_4: {
      id: 'd1b_4',
      number: '1.4',
      text: 'Controlled post-intervention variables?',
      responseType: 'WITH_NA',
    },
    d1b_5: {
      id: 'd1b_5',
      number: '1.5',
      text: 'Evidence of serious uncontrolled confounding?',
      responseType: 'STANDARD',
    },
  },
  hasDirection: true,
  directionOptions: DOMAIN1_DIRECTIONS,
};

// Domain 2: Bias in classification of interventions
export const DOMAIN_2 = {
  id: 'domain2',
  name: 'Domain 2: Bias in Classification of Interventions',
  questions: {
    d2_1: {
      id: 'd2_1',
      number: '2.1',
      text: 'Distinguishable strategies at follow-up start?',
      responseType: 'WITH_NI',
    },
    d2_2: {
      id: 'd2_2',
      number: '2.2',
      text: 'Outcomes occurred after strategies distinguishable?',
      responseType: 'WITH_NA',
    },
    d2_3: {
      id: 'd2_3',
      number: '2.3',
      text: 'Analysis avoided classification problems?',
      responseType: 'WEAK_STRONG_YES_NA',
    },
    d2_4: {
      id: 'd2_4',
      number: '2.4',
      text: 'Classification influenced by outcome knowledge?',
      responseType: 'WEAK_STRONG_YES',
    },
    d2_5: {
      id: 'd2_5',
      number: '2.5',
      text: 'Other classification errors likely?',
      responseType: 'WITH_NI',
    },
  },
  hasDirection: true,
  directionOptions: BIAS_DIRECTIONS,
};

// Domain 3: Bias in selection of participants
export const DOMAIN_3 = {
  id: 'domain3',
  name: 'Domain 3: Bias in Selection of Participants',
  subsections: {
    a: {
      name: 'A. Prevalent User Bias / Immortal Time',
      questions: {
        d3_1: {
          id: 'd3_1',
          number: '3.1',
          text: 'Follow-up began at intervention start?',
          responseType: 'WEAK_STRONG_NO',
        },
        d3_2: {
          id: 'd3_2',
          number: '3.2',
          text: 'Early outcome events excluded?',
          responseType: 'WITH_NI',
        },
      },
    },
    b: {
      name: 'B. Other Selection Bias',
      questions: {
        d3_3: {
          id: 'd3_3',
          number: '3.3',
          text: 'Selection based on post-intervention characteristics?',
          responseType: 'WITH_NI',
        },
        d3_4: {
          id: 'd3_4',
          number: '3.4',
          text: 'Associated with intervention?',
          responseType: 'WITH_NA',
        },
        d3_5: {
          id: 'd3_5',
          number: '3.5',
          text: 'Influenced by outcome or cause of outcome?',
          responseType: 'WITH_NA',
        },
      },
    },
    c: {
      name: 'C. Analysis & Severity',
      questions: {
        d3_6: {
          id: 'd3_6',
          number: '3.6',
          text: 'Analysis corrected selection bias?',
          responseType: 'WITH_NA',
        },
        d3_7: {
          id: 'd3_7',
          number: '3.7',
          text: 'Sensitivity analyses showed minimal impact?',
          responseType: 'WITH_NA',
        },
        d3_8: {
          id: 'd3_8',
          number: '3.8',
          text: 'Bias too severe for quantitative synthesis?',
          responseType: 'WITH_NA',
        },
      },
    },
  },
  hasDirection: false,
};

// Domain 4: Bias due to missing data
export const DOMAIN_4 = {
  id: 'domain4',
  name: 'Domain 4: Bias Due to Missing Data',
  questions: {
    d4_1: {
      id: 'd4_1',
      number: '4.1',
      text: 'Complete intervention data?',
      responseType: 'WITH_NI',
    },
    d4_2: {
      id: 'd4_2',
      number: '4.2',
      text: 'Complete outcome data?',
      responseType: 'WITH_NI',
    },
    d4_3: {
      id: 'd4_3',
      number: '4.3',
      text: 'Complete confounder data?',
      responseType: 'WITH_NI',
    },
    d4_4: {
      id: 'd4_4',
      number: '4.4',
      text: 'Complete case analysis used?',
      responseType: 'WITH_NA',
    },
    d4_5: {
      id: 'd4_5',
      number: '4.5',
      text: 'Missingness related to outcome?',
      responseType: 'WITH_NA',
    },
    d4_6: {
      id: 'd4_6',
      number: '4.6',
      text: 'Explained by model variables?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d4_7: {
      id: 'd4_7',
      number: '4.7',
      text: 'Imputation used?',
      responseType: 'WITH_NA',
      note: 'Response options: NA / Y / PY / PN / NI',
    },
    d4_8: {
      id: 'd4_8',
      number: '4.8',
      text: 'MAR/MCAR assumption reasonable?',
      responseType: 'WITH_NA',
    },
    d4_9: {
      id: 'd4_9',
      number: '4.9',
      text: 'Imputation appropriate?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d4_10: {
      id: 'd4_10',
      number: '4.10',
      text: 'Alternative correction used?',
      responseType: 'WEAK_STRONG_NO_NA',
    },
    d4_11: {
      id: 'd4_11',
      number: '4.11',
      text: 'Evidence result not biased?',
      responseType: 'WITH_NA',
      note: 'Response options: NA / Y / PY / PN / N',
    },
  },
  hasDirection: false,
};

// Domain 5: Bias in measurement of the outcome
export const DOMAIN_5 = {
  id: 'domain5',
  name: 'Domain 5: Bias in Measurement of the Outcome',
  questions: {
    d5_1: {
      id: 'd5_1',
      number: '5.1',
      text: 'Outcome measurement differed by group?',
      responseType: 'WITH_NI',
    },
    d5_2: {
      id: 'd5_2',
      number: '5.2',
      text: 'Assessors aware of intervention?',
      responseType: 'WITH_NI',
    },
    d5_3: {
      id: 'd5_3',
      number: '5.3',
      text: 'Assessment influenced by awareness?',
      responseType: 'WEAK_STRONG_YES_NA',
    },
  },
  hasDirection: false,
};

// Domain 6: Bias in selection of the reported result
export const DOMAIN_6 = {
  id: 'domain6',
  name: 'Domain 6: Bias in Selection of the Reported Result',
  questions: {
    d6_1: {
      id: 'd6_1',
      number: '6.1',
      text: 'Reported per pre-specified plan?',
      responseType: 'WITH_NI',
    },
    d6_2: {
      id: 'd6_2',
      number: '6.2',
      text: 'Selected from multiple outcome measures?',
      responseType: 'WITH_NI',
    },
    d6_3: {
      id: 'd6_3',
      number: '6.3',
      text: 'Selected from multiple analyses?',
      responseType: 'WITH_NI',
    },
    d6_4: {
      id: 'd6_4',
      number: '6.4',
      text: 'Selected from multiple subgroups?',
      responseType: 'WITH_NI',
    },
  },
  hasDirection: false,
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
