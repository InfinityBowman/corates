// Map the checklist state to actual checklist data for plotting and import/export

// Available checklist types
export const CHECKLIST_TYPES = {
  AMSTAR2: {
    name: 'AMSTAR 2',
    description: 'A MeaSurement Tool to Assess systematic Reviews (version 2)',
  },
}

export const AMSTAR_CHECKLIST = {
  q1: {
    info: 'To score Yes, appraisers should be confident that the 4 elements of PICO (population, intervention, control group and outcome) are described somewhere in the report.',
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
    info: 'The research questions and the review study methods should have been planned ahead of conducting the review. At a minimum this should be stated in the report (scores Partial Yes). To score Yes authors should demonstrate that they worked with a written protocol with independent verification (by a registry, publication of the protocol, or another independent body, e.g. research ethics board or research office) before the review was undertaken.',
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
          'justification for any derivations from the protocol',
        ],
      },
      {
        label: '',
        options: ['Yes', 'Partial Yes', 'No'],
      },
    ],
  },
  q3: {
    info: 'Review authors should justify their choice of study designs. A Yes rating requires evidence that the selection was intentional (e.g., why RCTs alone were sufficient or why nonrandomized studies were needed to capture outcomes or harms), rather than arbitrary.',
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
    info: 'To score Yes, appraisers should be satisfied that all relevant aspects of the search have been addressed by review authors.',
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
    info: 'A Yes rating requires that study selection was conducted by at least two independent reviewers, with a clear consensus process for resolving disagreements. If one reviewer screened all studies, a second reviewer must have checked a representative sample and demonstrated strong agreement (e.g., κ ≥ 0.80).',
    text: '5. Did the review authors perform study selection in duplicate?',
    columns: [
      {
        label: 'For Yes, either ONE of the following:',
        options: [
          'at least two reviewers independently agreed on selection of eligible studies and achieved consensus on which studies to include',
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
    info: 'A Yes rating requires that data extraction was performed by at least two independent reviewers, with a consensus process for resolving disagreements. If one reviewer extracted all data, a second reviewer must have checked a sample and demonstrated strong agreement (e.g., κ ≥ 0.80).',
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
    info: 'A Yes rating requires a list of excluded studies with a clear justification for each exclusion. Exclusions should be based on eligibility criteria (e.g., population, intervention, comparator, outcomes), not risk of bias, which is assessed separately.',
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
        options: [
          'Justified the exclusion from the review of each potentially relevant study',
        ],
      },
      {
        label: '',
        options: ['Yes', 'Partial Yes', 'No'],
      },
    ],
  },
  q8: {
    info: 'A Yes rating requires sufficiently detailed descriptions of the included studies (e.g., population, intervention, comparator, outcomes, design, and setting) to allow readers to judge PICO relevance, applicability to practice or policy, and sources of heterogeneity.',
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
          'described intervention in detail (including doses where relevant)',
          'described comparator in detail (including doses where relevant)',
          'described study’s setting',
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
    info: 'A Yes rating requires that review authors conducted a systematic, design-appropriate assessment of risk of bias for included studies, using a recognized or clearly justified tool that addresses key sources of bias relevant to the study designs.',
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
    info: 'A Yes rating requires that review authors reported the funding sources for the included studies, or clearly stated when funding information was not available.',
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
    info: 'A Yes rating requires that meta-analysis was clearly justified and conducted using appropriate statistical methods, including suitable effect models, assessment of heterogeneity, and, when both RCTs and nonrandomized studies are included, separate pooling by study design or clear justification for combined analyses.',
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
    info: 'A Yes rating requires that review authors examined how risk of bias in included studies may affect the synthesis results, such as through sensitivity analyses, subgroup analyses, or narrative discussion when meta-analysis was not performed.',
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
    info: 'A Yes rating requires explicit discussion of how risk of bias may influence the review’s results/conclusions or the authors included only low risk of bias RCTs.',
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
    info: 'A Yes rating requires that review authors examined and discussed sources of heterogeneity, such as differences in populations, interventions, outcomes, study design, or risk of bias, and considered how heterogeneity affects the interpretation of results and conclusions.',
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
    info: 'A Yes rating requires that review authors investigated potential publication (small-study) bias using appropriate methods (e.g., funnel plots, statistical tests, sensitivity analyses) and discussed how publication bias may affect the results, recognizing the limitations of these approaches.',
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
    info: 'A Yes rating requires that the review authors reported potential conflicts of interest related to the conduct of the review, including funding sources for the review itself and any relevant financial or professional ties, or clearly stated that no conflicts were identified.',
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
}
