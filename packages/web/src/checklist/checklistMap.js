// Map the checklist state to actual checklist data for plotting and import/export

// Available checklist types
export const CHECKLIST_TYPES = {
  AMSTAR2: {
    name: 'AMSTAR 2',
    description: 'A MeaSurement Tool to Assess systematic Reviews (version 2)',
  },
};

export const AMSTAR_CHECKLIST = {
  q1: {
    text: '1. Did the research questions and inclusion criteria for the review include the components of PICO?',
    columns: [
      {
        label: 'For Yes:',
        options: ['Population', 'Intervention', 'Comparator group', 'Outcome'],
      },
      {
        label: 'Optional (recommended):',
        options: ['Timeframe for follow-up'],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
  q2: {
    text: '2. Did the report of the review contain an explicit statement that the review methods were established prior to the conduct of the review and did the report justify any significant deviations from the protocol?',
    columns: [
      {
        label: 'For Partial Yes:',
        description:
          'The authors state that they had a written protocol or guide that included ALL the following:',
        options: [
          'review question(s)',
          'a search strategy',
          'inclusion/exclusion criteria',
          'risk of bias assessment',
        ],
      },
      {
        label: 'For Yes:',
        description:
          'As for Partial Yes, plus the protocol should be registered and should also have specified:',
        options: [
          'a meta-analysis/synthesis plan, if appropriate, and',
          'a plan for investigating causes of heterogeneity',
          'a plan for investigating causes of heterogeneity',
        ],
      },
      {
        label: '',
        description: '',
        options: ['Yes', 'Partial Yes', 'No'],
      },
    ],
  },
  q3: {
    text: '3. Did the review authors explain their selection of the study designs for inclusion in the review?',
    columns: [
      {
        label: 'For Yes, the review should satisfy ONE of the following:',
        options: [
          'Explanation for including only RCTs ',
          'OR Explanation for including only NRSI',
          'OR Explanation for including both RCTs and NRSI',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
  q4: {
    text: '4. Did the review authors use a comprehensive literature search strategy? ',
    columns: [
      {
        label: 'For Partial Yes (all the following):',
        options: [
          'searched at least 2 databases (relevant to research question)',
          'provided key word and/or search strategy',
          'justified publication restrictions (e.g. language)',
        ],
      },
      {
        label: 'For Yes, should also have (all the following):',
        options: [
          'searched the reference lists / bibliographies of included studies',
          'searched trial/study registries',
          'included/consulted content experts in the field',
          'where relevant, searched for grey literature',
          'conducted search within 24 months of completion of the review',
        ],
      },
      {
        label: '',
        options: ['Yes', 'Partial Yes', 'No'],
      },
    ],
  },
  q5: {
    text: '5. Did the review authors perform study selection in duplicate?',
    columns: [
      {
        label: 'For Yes, either ONE of the following:',
        options: [
          'at least two reviewers achieved consensus on which data to extract from included studies',
          'OR two reviewers extracted data from a sample of eligible studies and achieved good agreement (at least 80 percent), with the remainder extracted by one reviewer.',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
  q6: {
    text: '6. Did the review authors perform data extraction in duplicate?',
    columns: [
      {
        label: 'For Yes, either ONE of the following:',
        options: [
          'at least two reviewers achieved consensus on which data to extract from included studies',
          'OR two reviewers extracted data from a sample of eligible studies and achieved good agreement (at least 80 percent), with the remainder extracted by one reviewer.',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
  q7: {
    text: '7. Did the review authors provide a list of excluded studies and justify the exclusions?',
    columns: [
      {
        label: 'For Partial Yes:',
        options: [
          'provided a list of all potentially relevant studies that were read in full-text form but excluded from the review',
        ],
      },
      {
        label: 'For Yes, must also have:',
        options: ['Justified the exclusion from the review of each potentially relevant study'],
      },
      {
        label: '',
        options: ['Yes', 'Partial Yes', 'No'],
      },
    ],
  },
  q8: {
    text: '8. Did the review authors describe the included studies in adequate detail?',
    columns: [
      {
        label: 'For Partial Yes (ALL the following):',
        options: [
          'described populations',
          'described interventions',
          'described comparators',
          'described outcomes',
          'described research designs',
        ],
      },
      {
        label: 'For Yes, should also have ALL the following:',
        options: [
          'described population in detail',
          'described comparator in detail (including doses where relevant)',
          'described study’s setting in detail',
          'timeframe for follow-up',
        ],
      },
      {
        label: '',
        options: ['Yes', 'Partial Yes', 'No'],
      },
    ],
  },
  q9: {
    text: '9. Did the review authors use a satisfactory technique for assessing the risk of bias (RoB) in individual studies that were included in the review?',
    subtitle: 'RCTs',
    columns: [
      {
        label: 'For Partial Yes, must have assessed RoB from',
        options: [
          'unconcealed allocation, and',
          'lack of blinding of patients and assessors when assessing outcomes (unnecessary for objective outcomes such as all-cause mortality)',
        ],
      },
      {
        label: 'For Yes, must also have assessed RoB from:',
        options: [
          'allocation sequence that was not truly random, and',
          'selection of the reported result from among multiple measurements or analyses of a specified outcome',
        ],
      },
      {
        label: '',
        description: '',
        options: ['Yes', 'Partial Yes', 'No', ' Includes only NRSI'],
      },
    ],
    subtitle2: 'NRSI',
    columns2: [
      {
        label: 'For Partial Yes, must have assessed RoB:',
        options: ['from confounding, and', 'from selection bias'],
      },
      {
        label: 'For Yes, must also have assessed RoB:',
        options: [
          'methods used to ascertain exposures and outcomes, and',
          'selection of the reported result from among multiple measurements or analyses of a specified outcome',
        ],
      },
      {
        label: '',
        options: ['Yes', 'Partial Yes', 'No', 'Includes only RCTs'],
      },
    ],
  },
  q10: {
    text: '10. Did the review authors report on the sources of funding for the studies included in the review?',
    columns: [
      {
        label: 'For Yes:',
        options: [
          'Must have reported on the sources of funding for individual studies included in the review. Note: Reporting that the reviewers looked for this information but it was not reported by study authors also qualifies',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
  q11: {
    text: '11. If meta-analysis was performed did the review authors use appropriate methods for statistical combination of results?',
    subtitle: 'RCTs',
    columns: [
      {
        label: 'For Yes:',
        options: [
          'The authors justified combining the data in a meta-analysis',
          'AND they used an appropriate weighted technique to combine study results and adjusted for heterogeneity if present.',
          'AND investigated the causes of any heterogeneity',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No', 'No meta-analysis conducted'],
      },
    ],
    subtitle2: 'NRSI',
    columns2: [
      {
        label: 'For Yes:',
        options: [
          'The authors justified combining the data in a meta-analysis',
          'AND they used an appropriate weighted technique to combine study results, adjusting for heterogeneity if present',
          'AND they statistically combined effect estimates from NRSI that were adjusted for confounding, rather than combining raw data, or justified combining raw data when adjusted effect estimates were not available',
          'AND they reported separate summary estimates for RCTs and NRSI separately when both were included in the review',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No', 'No meta-analysis conducted'],
      },
    ],
  },
  q12: {
    text: '12. If meta-analysis was performed, did the review authors assess the potential impact of RoB in individual studies on the results of the meta-analysis or other evidence synthesis?',
    columns: [
      {
        label: 'For Yes:',
        options: [
          'included only low risk of bias RCTs',
          'OR, if the pooled estimate was based on RCTs and/or NRSI at variable RoB, the authors performed analyses to investigate possible impact of RoB on summary estimates of effect.',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No', 'No meta-analysis conducted'],
      },
    ],
  },
  q13: {
    text: '13. Did the review authors account for RoB in individual studies when interpreting/ discussing the results of the review?',
    columns: [
      {
        label: 'For Yes:',
        options: [
          'included only low risk of bias RCTs',
          'OR, if RCTs with moderate or high RoB, or NRSI were included the review provided a discussion of the likely impact of RoB on the results',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
  q14: {
    text: '14. Did the review authors provide a satisfactory explanation for, and discussion of, any heterogeneity observed in the results of the review?',
    columns: [
      {
        label: 'For Yes:',
        options: [
          'There was no significant heterogeneity in the results',
          'OR if heterogeneity was present the authors performed an investigation of sources of any heterogeneity in the results and discussed the impact of this on the results of the review',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
  q15: {
    text: '15. If they performed quantitative synthesis did the review authors carry out an adequate investigation of publication bias (small study bias) and discuss its likely impact on the results of the review?',
    columns: [
      {
        label: 'For Yes:',
        options: [
          'performed graphical or statistical tests for publication bias and discussed the likelihood and magnitude of impact of publication bias',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No', 'No meta-analysis conducted'],
      },
    ],
  },
  q16: {
    text: '16. Did the review authors report any potential sources of conflict of interest, including any funding they received for conducting the review?',
    options: ['Yes', 'Partial Yes', 'No'],
    columns: [
      {
        label: 'For Yes:',
        options: [
          'The authors reported no competing interests OR',
          'The authors described their funding sources and how they managed potential conflicts of interest',
        ],
      },
      {
        label: '',
        options: ['Yes', 'No'],
      },
    ],
  },
};
