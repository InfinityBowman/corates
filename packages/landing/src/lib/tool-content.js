/**
 * Tool Content Configuration
 *
 * Centralized content for all appraisal tool resource pages.
 * Each tool contains all the data needed to render its resource page.
 */

export const TOOL_CONTENT = {
  amstar2: {
    id: 'amstar2',
    name: 'AMSTAR 2',
    slug: 'amstar2',
    description:
      "The AMSTAR 2 (A MeaSurement Tool to Assess systematic Reviews) is a critical appraisal tool used to assess the methodological quality and risk of bias of systematic reviews of interventions, including reviews that incorporate randomized and non-randomized studies. It evaluates 16 domains and supports judgments about confidence in a review's findings (high to critically low), helping users determine how much trust to place in review results.",
    bestUsedFor: 'Appraising systematic reviews of interventions.',
    referenceLinks: [
      {
        href: 'https://www.bmj.com/content/358/bmj.j4008',
        text: 'AMSTAR 2 paper',
      },
      {
        href: 'https://www.bmj.com/highwire/filestream/951408/field_highwire_adjunct_files/1/sheb036104.ww1.pdf',
        text: 'AMSTAR 2 Guidance document',
      },
    ],
    scoringDescription:
      "CoRATES automatically generates the overall score using decision rules that follow the scoring guidance published in the AMSTAR 2 paper, ensuring consistency with the tool's intended interpretation.",
    scoreLevels: [
      {
        name: 'High',
        description:
          'No or one non-critical weakness: the systematic review provides an accurate and comprehensive summary of the results of the available studies that address the question of interest.',
        color: 'green',
      },
      {
        name: 'Moderate',
        description:
          'More than one non-critical weakness*: the systematic review has more than one weakness but no critical flaws. It may provide an accurate summary of the results of the available studies that were included in the review.',
        note: '*Multiple non-critical weaknesses may diminish confidence in the review and it may be appropriate to move the overall appraisal down from moderate to low confidence.',
        color: 'yellow',
      },
      {
        name: 'Low',
        description:
          'One critical flaw with or without non-critical weaknesses: the review has a critical flaw and may not provide an accurate and comprehensive summary of the available studies that address the question of interest.',
        color: 'orange',
      },
      {
        name: 'Critically Low',
        description:
          'More than one critical flaw with or without non-critical weaknesses: the review has more than one critical flaw and should not be relied on to provide an accurate and comprehensive summary of the available studies.',
        color: 'red',
      },
    ],
  },

  robinsI: {
    id: 'robinsI',
    name: 'ROBINS-I V2',
    slug: 'robins-i',
    description:
      'ROBINS-I V2 (Risk Of Bias In Non-randomized Studies - of Interventions, Version 2) is a tool for assessing risk of bias in the results of non-randomized studies that compare the health effects of two or more interventions. It covers seven domains through which bias might be introduced: confounding, selection of participants, classification of interventions, deviations from intended interventions, missing data, measurement of outcomes, and selection of reported results.',
    bestUsedFor: 'Assessing risk of bias in non-randomized studies of interventions (NRSI).',
    referenceLinks: [
      {
        href: 'https://www.riskofbias.info/welcome/robins-i-v2',
        text: 'ROBINS-I V2 tool',
      },
      {
        href: 'https://methods.cochrane.org/bias/risk-bias-non-randomized-studies-interventions',
        text: 'Cochrane ROBINS-I guidance',
      },
    ],
    scoringDescription:
      'CoRATES automatically generates the overall risk of bias judgement using algorithms that map signalling question responses to domain-level and overall assessments, following the ROBINS-I V2 methodology.',
    scoreLevels: [
      {
        name: 'Low',
        description:
          'The study is comparable to a well-performed randomized trial with regard to this domain. Bias is unlikely to alter the results.',
        color: 'green',
      },
      {
        name: 'Moderate',
        description:
          'The study is sound for a non-randomized study with regard to this domain but cannot be considered comparable to a well-performed randomized trial. There is some concern that the result may be biased.',
        color: 'yellow',
      },
      {
        name: 'Serious',
        description:
          'The study has some important problems in this domain. There is a serious risk that the result is biased.',
        color: 'orange',
      },
      {
        name: 'Critical',
        description:
          'The study is too problematic in this domain to provide any useful evidence. The result should not be used in any synthesis or considered further.',
        color: 'red',
      },
      {
        name: 'Incomplete',
        description:
          'There is insufficient information to make a judgement about risk of bias for this domain.',
        color: 'gray',
      },
    ],
  },

  rob2: {
    id: 'rob2',
    name: 'RoB 2',
    slug: 'rob2',
    description:
      'RoB 2 (Risk of Bias 2) is the revised Cochrane tool for assessing risk of bias in randomized trials. It addresses five domains through which bias might be introduced into the trial result: the randomization process, deviations from intended interventions, missing outcome data, measurement of the outcome, and selection of the reported result. RoB 2 is structured as a series of signalling questions that lead to domain-level and overall judgements.',
    bestUsedFor: 'Assessing risk of bias in randomized controlled trials (RCTs).',
    referenceLinks: [
      {
        href: 'https://www.riskofbias.info/welcome/rob-2-0-tool/current-version-of-rob-2',
        text: 'RoB 2 tool and templates',
      },
      {
        href: 'https://methods.cochrane.org/bias/resources/rob-2-revised-cochrane-risk-bias-tool-randomized-trials',
        text: 'Cochrane RoB 2 guidance',
      },
    ],
    scoringDescription:
      'CoRATES automatically generates risk of bias judgements based on responses to signalling questions within each domain, following the RoB 2 algorithm for deriving domain-level and overall judgements.',
    scoreLevels: [
      {
        name: 'Low',
        description:
          'The trial is judged to be at low risk of bias for all domains. Any departures from the intended intervention are not expected to affect the result.',
        color: 'green',
      },
      {
        name: 'Some concerns',
        description:
          'The trial is judged to raise some concerns in at least one domain, but not to be at high risk of bias for any domain. The result may be affected by bias.',
        color: 'yellow',
      },
      {
        name: 'High',
        description:
          'The trial is judged to be at high risk of bias in at least one domain, or there are some concerns for multiple domains in a way that substantially lowers confidence in the result.',
        color: 'red',
      },
      {
        name: 'Incomplete',
        description:
          'There is insufficient information to make a judgement about risk of bias for one or more domains.',
        color: 'gray',
      },
    ],
  },
};

/**
 * Get tool content by slug
 * @param {string} slug - The tool slug (e.g., 'amstar2', 'robins-i', 'rob2')
 * @returns {Object|null} Tool content or null if not found
 */
export function getToolBySlug(slug) {
  return getAllTools().find(tool => tool.slug === slug) || null;
}

/**
 * Get all tools for listing
 * @returns {Array} Array of tool content objects
 */
export function getAllTools() {
  return Object.values(TOOL_CONTENT);
}
