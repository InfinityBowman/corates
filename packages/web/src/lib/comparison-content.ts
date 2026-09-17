/**
 * Comparison page content
 *
 * Content for the /resources/*-vs-* pages that help a reviewer choose between
 * two appraisal tools, or between two versions of one tool. Each page answers
 * the choice first, then explains the differences that matter in practice.
 *
 * Same copyright constraint as tool-content.ts: describe the tools and cite the
 * official sources, never reproduce signalling questions or scoring tables.
 * Statements about Cochrane guidance were checked against the current Handbook
 * chapters (8, 23, 24, 25, V) and riskofbias.info in September 2026.
 */

import type { FaqEntry } from '@/lib/tool-content';

export interface ComparisonTable {
  /** First column holds the row label; remaining columns match `columns`. */
  columns: string[];
  rows: string[][];
}

export type DecisionNode =
  | { kind: 'question'; text: string; branches: { label: string; node: DecisionNode }[] }
  | { kind: 'result'; tool: string; detail: string; tone: 'tool' | 'none' };

export interface DomainMappingNode {
  label: string;
  sub?: string;
}

export interface DomainMapping {
  leftTitle: string;
  rightTitle: string;
  left: DomainMappingNode[];
  right: DomainMappingNode[];
  /** `to: null` draws the edge to a "No equivalent" endpoint */
  edges: { from: number; to: number | null; dashed?: boolean }[];
  /** Explains the dashed edges; shown under the figure */
  caption: string;
  /** Screen-reader description of what the figure shows */
  description: string;
}

export interface ComparisonSection {
  heading: string;
  paragraphs: string[];
  decisionTree?: DecisionNode;
  domainMapping?: DomainMapping;
  table?: ComparisonTable;
}

export interface QuickAnswer {
  situation: string;
  answer: string;
  detail: string;
}

interface ReferenceLink {
  href: string;
  text: string;
}

interface Citation {
  authors: string;
  year: string;
  title: string;
  source: string;
  url?: string;
}

export interface ComparisonContent {
  slug: string;
  /** Page heading and breadcrumb name */
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  quickAnswers: QuickAnswer[];
  sections: ComparisonSection[];
  faq: FaqEntry[];
  referenceLinks: ReferenceLink[];
  citations: Citation[];
  /** Slugs from tool-content.ts whose checklist the CTA links to */
  ctaTools: string[];
  /** Shown beside the CTA when one side of the comparison is not in CoRATES */
  ctaNote?: string;
  related: { to: string; label: string }[];
}

const HANDBOOK = 'https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current';

const COMPARISON_CONTENT: Record<string, ComparisonContent> = {
  'rob2-vs-robins-i': {
    slug: 'rob2-vs-robins-i',
    title: 'RoB 2 vs ROBINS-I: which risk-of-bias tool for your study?',
    metaTitle: 'RoB 2 vs ROBINS-I: Which Risk of Bias Tool to Use | CoRATES',
    metaDescription:
      'RoB 2 assesses randomized trials and ROBINS-I V2 assesses non-randomized studies of interventions. A design-by-design guide to choosing, the differences that matter, and how to handle a review with both.',
    intro: [
      'RoB 2 and ROBINS-I are companion tools from the Cochrane Bias Methods Group, and the line between them is drawn by study design rather than by topic, by quality, or by what the study calls itself. If participants were allocated to interventions by a genuinely random process, use RoB 2. If they were not, use ROBINS-I. Most of the questions people bring to this choice are about designs near that line, or about what to do when a review includes both.',
      'This page gives the short answer first, then a design-by-design guide, a side-by-side comparison, and the differences that matter once you start reporting and synthesising results. It describes the tools; it does not reproduce their signalling questions, which belong to the tool developers and are linked at the end.',
    ],
    quickAnswers: [
      {
        situation: 'Randomized trial',
        answer: 'RoB 2',
        detail:
          'Parallel-group trials use the main version. Cluster-randomized and crossover trials use the RoB 2 variants written for those designs, which add design-specific signalling questions.',
      },
      {
        situation: 'Non-randomized study of an intervention',
        answer: 'ROBINS-I V2',
        detail:
          'Cohort-type follow-up studies in which intervention groups were not formed by randomization: prospective and retrospective cohorts, registry and database analyses, non-randomized controlled trials, and quasi-randomized designs.',
      },
      {
        situation: 'Review that includes both',
        answer: 'Both, kept separate',
        detail:
          'Apply each tool to the studies it was designed for, present the assessments separately, and analyse the two groups separately. The two judgement scales are related but not interchangeable.',
      },
    ],
    sections: [
      {
        heading: 'Choose by study design',
        paragraphs: [
          'The Cochrane Handbook scopes RoB 2 to randomized trials and ROBINS-I to non-randomized studies of interventions. Work down the questions below, then use the table for the designs reviewers most often ask about, including the ones that fall outside both tools.',
        ],
        decisionTree: {
          kind: 'question',
          text: 'Were participants allocated to interventions by a genuinely random process?',
          branches: [
            {
              label: 'Yes',
              node: {
                kind: 'question',
                text: 'Which randomized design?',
                branches: [
                  {
                    label: 'Parallel-group',
                    node: {
                      kind: 'result',
                      tone: 'tool',
                      tool: 'RoB 2',
                      detail: 'The main version of the tool, assessed per result.',
                    },
                  },
                  {
                    label: 'Cluster-randomized',
                    node: {
                      kind: 'result',
                      tone: 'tool',
                      tool: 'RoB 2, cluster variant',
                      detail:
                        'Adds a domain for bias from the timing of identification and recruitment.',
                    },
                  },
                  {
                    label: 'Crossover',
                    node: {
                      kind: 'result',
                      tone: 'tool',
                      tool: 'RoB 2, crossover variant',
                      detail: 'Adds questions on carry-over and period effects.',
                    },
                  },
                ],
              },
            },
            {
              label: 'No, including quasi-randomized',
              node: {
                kind: 'question',
                text: 'Is there a comparison between intervention groups?',
                branches: [
                  {
                    label: 'No',
                    node: {
                      kind: 'result',
                      tone: 'none',
                      tool: 'Neither tool',
                      detail:
                        'Single-arm studies and case series have no effect estimate whose bias can be assessed.',
                    },
                  },
                  {
                    label: 'Yes',
                    node: {
                      kind: 'question',
                      text: 'Is it a follow-up (cohort-type) design?',
                      branches: [
                        {
                          label: 'Yes',
                          node: {
                            kind: 'result',
                            tone: 'tool',
                            tool: 'ROBINS-I V2',
                            detail:
                              'Cohorts, registry and database analyses, non-randomized controlled trials.',
                          },
                        },
                        {
                          label: 'No',
                          node: {
                            kind: 'result',
                            tone: 'none',
                            tool: 'Outside the current V2 scope',
                            detail:
                              'Case-control and before-after designs. Document the approach you take.',
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
        table: {
          columns: ['Study design', 'Tool', 'Why'],
          rows: [
            [
              'Parallel-group randomized trial',
              'RoB 2',
              'The main version of the tool. Assess each result of interest separately: a result is one outcome, at one time point, from one analysis.',
            ],
            [
              'Cluster-randomized trial',
              'RoB 2, cluster variant',
              'Adds a domain for bias arising from the timing of identification and recruitment of participants, because people recruited after their cluster was allocated may have been selected with knowledge of the intervention. Do not use the parallel-group version.',
            ],
            [
              'Crossover trial',
              'RoB 2, crossover variant',
              'Adds signalling questions about carry-over and period effects. Do not use the parallel-group version.',
            ],
            [
              'Quasi-randomized trial (allocation by alternation, date of birth, record number)',
              'ROBINS-I V2',
              'A predictable allocation rule is not randomization, so the groups cannot be assumed free of confounding. Cochrane treats these as non-randomized controlled trials, which fall within the scope of ROBINS-I.',
            ],
            [
              'Non-randomized controlled trial',
              'ROBINS-I V2',
              'Investigator-assigned groups without randomization. The Cochrane Handbook lists this design among the follow-up studies ROBINS-I covers, however the study is labelled.',
            ],
            [
              'Prospective or retrospective cohort study',
              'ROBINS-I V2',
              'The design ROBINS-I V2 is written for. Confounding is usually the decisive domain, and the confounders to look for should be listed at protocol stage.',
            ],
            [
              'Registry, electronic health record or claims database analysis',
              'ROBINS-I V2',
              'Treated as a cohort study. Classification of intervention, immortal time and prevalent-user bias are the usual trouble spots, and V2 asks about them explicitly.',
            ],
            [
              'Controlled before-after study, interrupted time series',
              'ROBINS-I, with care',
              'The Cochrane Handbook discusses these designs under ROBINS-I, but the V2 document currently released covers follow-up (cohort) studies and the developers have signalled variants for other designs. Say in your protocol which version and guidance you followed.',
            ],
            [
              'Case-control study',
              'Outside current scope',
              'Neither tool is written for case-control designs. ROBINS-I variants for further designs are anticipated; until then, justify and report whatever approach you take rather than applying the cohort tool silently.',
            ],
            [
              'Single-arm study, case series',
              'Neither',
              'Both tools assess the result of a comparison between intervention groups. Without a comparator there is no effect estimate whose bias can be assessed.',
            ],
            [
              'Systematic review',
              'AMSTAR 2 or ROBIS',
              'Neither RoB 2 nor ROBINS-I appraises a review. See the AMSTAR 2 vs ROBIS comparison linked below.',
            ],
          ],
        },
      },
      {
        heading: 'Side by side',
        paragraphs: [],
        table: {
          columns: ['', 'RoB 2', 'ROBINS-I V2'],
          rows: [
            [
              'Published',
              'August 2019 (Sterne et al., BMJ). Replaces the original Cochrane tool of 2008 and 2011.',
              'October 2016 (Sterne et al., BMJ). Version 2 first released November 2024; the current document was posted on 20 November 2025 and is still marked by the developers as a draft subject to change.',
            ],
            [
              'Study designs',
              'Randomized trials. Variants for cluster-randomized and crossover trials.',
              'Non-randomized follow-up (cohort) studies of interventions. Variants for further designs anticipated.',
            ],
            [
              'Unit of assessment',
              'A specific result: one outcome, time point and analysis.',
              'A specific result, judged against a target randomized trial that the study is taken to emulate.',
            ],
            [
              'Before you start',
              'Decide whether you are assessing the effect of assignment to intervention or the effect of adhering to it. Domain 2 differs between the two.',
              'List the important confounders at protocol stage, specify the target trial, and decide whether the analysis estimates an intention-to-treat or per-protocol effect. Domain 1 differs between the two.',
            ],
            [
              'Bias domains',
              'Five: the randomization process; deviations from intended interventions; missing outcome data; measurement of the outcome; selection of the reported result.',
              'Six: confounding; classification of intervention; selection of participants into the study or analysis; missing data; measurement of the outcome; selection of the reported result.',
            ],
            [
              'Triage',
              'None. Every result receives the full assessment.',
              'Preliminary questions can send a result straight to Critical risk of bias, for example when the authors made no attempt to control confounding, so the full assessment is skipped.',
            ],
            [
              'Signalling question responses',
              'Yes, Probably yes, Probably no, No, No information.',
              'The same five, plus graded options on some questions that separate a substantial problem from a minor one.',
            ],
            [
              'Domain judgements',
              'Low risk, Some concerns, High risk.',
              'Low, Moderate, Serious, Critical, or No information. In V2 the confounding domain can also return Low except for concerns about uncontrolled confounding.',
            ],
            [
              'What Low means',
              'The result is comparable to a well-conducted trial for that domain.',
              'Comparable to a well-performed randomized trial for that domain. The Handbook expects this to be rare for confounding in non-randomized studies.',
            ],
            [
              'Overall judgement',
              'High if any domain is High, or if Some concerns in several domains substantially lowers confidence. Low only if every domain is Low.',
              'Driven by the worst domain. Critical means the result is too biased to be useful and should not be included in synthesis.',
            ],
            [
              'Algorithms',
              'Published algorithms propose the domain judgement from the responses. Reviewers may override with a documented reason.',
              'Added in V2. The 2016 version gave guidance but left the mapping to the reviewer.',
            ],
            [
              'Expertise',
              'Methodological. Knowledge of the clinical area helps with the deviations and measurement domains.',
              'Methodological and content expertise together. The Cochrane Handbook recommends involving both methodologists and health professionals who know the prognostic factors.',
            ],
            [
              'Cochrane status',
              'Recommended tool for randomized trials in Cochrane Reviews.',
              'Recommended tool for non-randomized studies of interventions in Cochrane Reviews.',
            ],
            ['In CoRATES', 'Supported (parallel-group version).', 'Supported (V2).'],
          ],
        },
      },
      {
        heading: 'Confounding is the reason ROBINS-I exists',
        paragraphs: [
          'RoB 2 has no confounding domain because a properly generated and concealed random allocation deals with confounding by design; its first domain therefore asks whether the randomization actually worked. ROBINS-I starts from the opposite premise. Its first domain asks whether the study measured and adjusted for the confounders that matter, which means the review team must know the clinical area well enough to name those confounders before assessment begins. This is the main reason ROBINS-I assessments take longer, and the reason the Cochrane Handbook asks for content expertise on the team.',
        ],
      },
      {
        heading: 'The scales look similar but do not line up',
        paragraphs: [
          'RoB 2 has three judgement levels and ROBINS-I has four. ROBINS-I anchors Low to a well-performed randomized trial, so a non-randomized study rated Low overall is unusual, and the Handbook says as much. Moderate means the study is sound for a non-randomized study; it is not a synonym for Some concerns. Critical has no counterpart in RoB 2 at all: it means the result is too biased to be informative and should be left out of the synthesis rather than downweighted.',
          'Keep the two sets of judgements in separate tables and figures, and describe each scale in your methods. A single traffic-light plot that colours Moderate and Some concerns the same yellow invites readers to treat them as equivalent.',
        ],
      },
      {
        heading: 'The target trial',
        paragraphs: [
          'ROBINS-I asks you to describe the hypothetical randomized trial the study is emulating: the eligible participants, the intervention strategy, the comparator strategy, and whether the analysis estimates the effect of starting the intervention or of starting and adhering to it. Every judgement is then made relative to that trial rather than to an idealised observational study. RoB 2 contains a lighter version of the same idea. You state whether you are assessing the effect of assignment or of adherence, and the second domain changes accordingly.',
        ],
      },
      {
        heading: 'Triage in ROBINS-I V2',
        paragraphs: [
          'V2 adds a short preliminary section before the full assessment. If the authors made no attempt to control for confounding and the potential for confounding is sufficient, or if the method of measuring the outcome was inappropriate, the result is at Critical risk of bias and no further assessment is required. RoB 2 has no equivalent; every result receives the full assessment. In a review built on large database studies the triage step can save a great deal of time, but note that it asks about any attempt to control confounding, so a crude adjustment still leads to the full assessment.',
        ],
      },
      {
        heading: 'Time, training and agreement',
        paragraphs: [
          'Both tools are more demanding than their predecessors. An evaluation of RoB 2 found only slight inter-rater agreement on the overall judgement among experienced reviewers without calibration, at roughly half an hour per result (Minozzi et al., 2020). A follow-up study found agreement improved substantially once the team wrote review-specific implementation instructions (Minozzi et al., 2022). The Handbook describes ROBINS-I as more involved again.',
          'Whichever tool you use, plan a calibration exercise on a few studies, write down how you will answer the questions that gave trouble, and use two independent reviewers with a documented reconciliation step.',
        ],
      },
      {
        heading: 'Reviews that include both randomized and non-randomized studies',
        paragraphs: [
          'Apply each tool to the studies it was designed for and say so in the protocol. If a study reports both a randomized comparison and a non-randomized comparison, for example a patient-preference or comprehensive cohort design, assess the randomized result with RoB 2 and the non-randomized result with ROBINS-I as separate results.',
          'Present the two sets of assessments separately, in separate risk-of-bias tables and separate summary figures. The Cochrane Handbook advises that randomized trials and non-randomized studies should not be combined in a single meta-analysis and that their results should be presented and analysed separately, so the risk-of-bias presentation should follow the same split.',
          'The choice of tool also reaches into GRADE. Under the GRADE guidance written for ROBINS-I (Schunemann et al., 2019), a body of non-randomized evidence assessed with ROBINS-I starts at high certainty and is rated down for the bias actually found, instead of starting at low certainty because of its design. The Handbook notes that the final rating is still usually low or very low. That approach only holds up if the ROBINS-I assessment was done rigorously, with confounders pre-specified and a target trial stated.',
        ],
      },
    ],
    faq: [
      {
        question: 'Can I use RoB 2 for a non-randomized study that is designed like a trial?',
        answer:
          'No. The first RoB 2 domain assumes a random allocation process existed and asks whether it was carried out properly. Without randomization there is no way within RoB 2 to consider confounding, which is usually the largest source of bias in a non-randomized comparison. Use ROBINS-I.',
      },
      {
        question: 'Which tool should I use for a quasi-randomized trial?',
        answer:
          'ROBINS-I. Allocation by alternation, date of birth, hospital number or day of the week is predictable, so recruiters can foresee the next assignment and the groups cannot be assumed comparable. Cochrane treats such studies as non-randomized controlled trials.',
      },
      {
        question: 'Which tool should I use for a pilot or feasibility randomized trial?',
        answer:
          'RoB 2, as for any randomized trial. A small sample is a question of imprecision, which GRADE handles separately; it is not a source of bias.',
      },
      {
        question: 'Which tool should I use for a cohort study?',
        answer:
          'ROBINS-I V2. Cohort and other follow-up designs are exactly what V2 is written for. Start by listing the confounders you expect to matter and specifying the target trial, then assess one result at a time.',
      },
      {
        question: 'Can I use ROBINS-I V2 for a case-control study?',
        answer:
          'The V2 document currently released covers follow-up (cohort) studies, and the developers have indicated that variants for other designs are in preparation. If you must assess a case-control study now, say in your protocol what you did and why, and treat the resulting judgements with caution.',
      },
      {
        question: 'Is Moderate in ROBINS-I the same as Some concerns in RoB 2?',
        answer:
          'No. Moderate in ROBINS-I means the study is sound for a non-randomized study but not comparable to a well-performed trial; it is the expected result for a good cohort study in the confounding domain. Some concerns in RoB 2 is a judgement about a randomized trial that falls short of Low for a specific reason. Report each on its own scale.',
      },
      {
        question: 'When do I need ROBINS-E instead?',
        answer:
          'When the question is about an exposure rather than an intervention: a pollutant, a diet, an occupational hazard. ROBINS-E (Higgins et al., 2024) is the companion tool for those studies and shares the same family structure. ROBINS-I is for interventions that could, at least in principle, be assigned in a trial.',
      },
      {
        question: 'Does CoRATES support both tools?',
        answer:
          'Yes. CoRATES implements RoB 2 for randomized trials and ROBINS-I V2 for non-randomized studies, applies the official algorithms to propose domain and overall judgements, and supports independent assessment by several reviewers followed by reconciliation. Each tool keeps its own judgement scale.',
      },
    ],
    referenceLinks: [
      {
        href: 'https://www.riskofbias.info/welcome/rob-2-0-tool/current-version-of-rob-2',
        text: 'RoB 2 official tool and templates (riskofbias.info)',
      },
      {
        href: 'https://www.riskofbias.info/welcome/robins-i-v2',
        text: 'ROBINS-I V2 official tool and guidance (riskofbias.info)',
      },
      {
        href: `${HANDBOOK}/chapter-08`,
        text: 'Cochrane Handbook Chapter 8: Assessing risk of bias in a randomized trial',
      },
      {
        href: `${HANDBOOK}/chapter-24`,
        text: 'Cochrane Handbook Chapter 24: Including non-randomized studies on intervention effects',
      },
      {
        href: `${HANDBOOK}/chapter-25`,
        text: 'Cochrane Handbook Chapter 25: Assessing risk of bias in a non-randomized study',
      },
    ],
    citations: [
      {
        authors: 'Sterne JAC, Savovic J, Page MJ, et al.',
        year: '2019',
        title: 'RoB 2: a revised tool for assessing risk of bias in randomised trials',
        source: 'BMJ 2019;366:l4898',
        url: 'https://www.bmj.com/content/366/bmj.l4898',
      },
      {
        authors: 'Sterne JA, Hernan MA, Reeves BC, et al.',
        year: '2016',
        title:
          'ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions',
        source: 'BMJ 2016;355:i4919',
        url: 'https://www.bmj.com/content/355/bmj.i4919',
      },
      {
        authors: 'Higgins JPT, Morgan RL, Rooney AA, et al.',
        year: '2024',
        title:
          'A tool to assess risk of bias in non-randomized follow-up studies of exposure effects (ROBINS-E)',
        source: 'Environment International, 186, 108602',
        url: 'https://doi.org/10.1016/j.envint.2024.108602',
      },
      {
        authors: 'Schunemann HJ, Cuello C, Akl EA, et al.',
        year: '2019',
        title:
          'GRADE guidelines: 18. How ROBINS-I and other tools to assess risk of bias in nonrandomized studies should be used to rate the certainty of a body of evidence',
        source: 'Journal of Clinical Epidemiology, 111, 105-114',
        url: 'https://doi.org/10.1016/j.jclinepi.2018.01.012',
      },
      {
        authors: 'Minozzi S, Cinquini M, Gianola S, Gonzalez-Lorenzo M, Banzi R.',
        year: '2020',
        title:
          'The revised Cochrane risk of bias tool for randomized trials (RoB 2) showed low interrater reliability and challenges in its application',
        source: 'Journal of Clinical Epidemiology, 126, 37-44',
        url: 'https://doi.org/10.1016/j.jclinepi.2020.06.015',
      },
      {
        authors: 'Minozzi S, Dwan K, Borrelli F, Filippini G.',
        year: '2022',
        title:
          'Reliability of the revised Cochrane risk-of-bias tool for randomised trials (RoB2) improved with the use of implementation instruction',
        source: 'Journal of Clinical Epidemiology, 141, 99-105',
        url: 'https://doi.org/10.1016/j.jclinepi.2021.09.021',
      },
    ],
    ctaTools: ['rob2', 'robins-i'],
    related: [
      { to: '/resources/rob2', label: 'RoB 2 guide' },
      { to: '/resources/robins-i', label: 'ROBINS-I V2 guide' },
      { to: '/resources/rob1-vs-rob2', label: 'RoB 1 vs RoB 2' },
      { to: '/resources/robins-i-v1-vs-v2', label: "What's new in ROBINS-I V2" },
      { to: '/resources/amstar2-vs-robis', label: 'AMSTAR 2 vs ROBIS' },
    ],
  },

  'amstar2-vs-robis': {
    slug: 'amstar2-vs-robis',
    title: 'AMSTAR 2 vs ROBIS: which tool for appraising systematic reviews?',
    metaTitle: 'AMSTAR 2 vs ROBIS: Appraising Systematic Reviews | CoRATES',
    metaDescription:
      'AMSTAR 2 rates the methodological quality of intervention reviews. ROBIS assesses risk of bias in reviews of any question type. When each fits, how they differ, and how to use them in an umbrella review.',
    intro: [
      "AMSTAR 2 and ROBIS are the two tools most often used to appraise systematic reviews, whether in an umbrella review, in guideline development, or in a health technology assessment that leans on an existing review. They cover much of the same ground and their verdicts usually agree, but they ask different questions. AMSTAR 2 asks how well the review was conducted; ROBIS asks whether the review's conclusions are likely to be biased. The Cochrane Handbook's chapter on overviews does not recommend one over the other, citing a lack of empirical evidence, so the choice needs to be made and justified in your protocol.",
      'This page sets out when each tool fits, the structural differences, what the empirical comparisons found, and the mistakes that show up most often in practice.',
    ],
    quickAnswers: [
      {
        situation: 'Overview or umbrella review of intervention reviews',
        answer: 'AMSTAR 2, usually',
        detail:
          'Written for reviews of healthcare interventions, quicker to apply, and its overall confidence rating is designed for exactly this use. The Handbook notes it may be preferred for future Cochrane overviews.',
      },
      {
        situation: 'Reviews of diagnostic accuracy, prognosis or aetiology',
        answer: 'ROBIS',
        detail:
          'AMSTAR 2 is scoped to intervention reviews and several of its items assume that context. ROBIS was built to cover interventions, diagnosis, prognosis and aetiology.',
      },
      {
        situation: 'A guideline or HTA decision resting on one review',
        answer: 'ROBIS, or both',
        detail:
          "ROBIS was designed with guideline developers in mind, and its final phase judges whether the review's interpretation of its findings is trustworthy, which is the question a panel is actually asking.",
      },
    ],
    sections: [
      {
        heading: 'Side by side',
        paragraphs: [],
        table: {
          columns: ['', 'AMSTAR 2', 'ROBIS'],
          rows: [
            [
              'Published',
              '2017 (Shea et al., BMJ). A substantive revision of the 2007 AMSTAR.',
              '2016 (Whiting et al., Journal of Clinical Epidemiology).',
            ],
            [
              'What it assesses',
              'Methodological quality: how well the review was conducted and, on some items, reported.',
              'Risk of bias: whether the review process and the interpretation of its findings could have distorted the conclusions.',
            ],
            [
              'Review types',
              'Systematic reviews of healthcare interventions that include randomized trials, non-randomized studies, or both.',
              'Systematic reviews of interventions, diagnosis, prognosis and aetiology.',
            ],
            [
              'Structure',
              '16 items, seven of which are designated critical.',
              'Three phases: assess relevance (optional); identify concerns with the review process across four domains; judge the overall risk of bias in the review.',
            ],
            [
              'Domains',
              'Not domain-based. The critical items cover protocol registration, search adequacy, justification of exclusions, risk-of-bias assessment of included studies, meta-analytical methods, consideration of risk of bias in interpretation, and publication bias.',
              'Study eligibility criteria; identification and selection of studies; data collection and study appraisal; synthesis and findings.',
            ],
            [
              'Responses',
              'Per item: Yes, No, and Partial Yes on some items.',
              'Per signalling question: Yes, Probably yes, Probably no, No, No information. Per domain: Low, High or Unclear concern.',
            ],
            [
              'Output',
              'Overall confidence in the results of the review: High, Moderate, Low or Critically Low.',
              'Overall risk of bias in the review: Low, High or Unclear.',
            ],
            [
              'How the output is reached',
              'Decision rules based on the pattern of critical and non-critical weaknesses. One critical flaw gives Low; more than one gives Critically Low.',
              'Reviewer judgement across the domain concerns and the phase 3 questions about whether the interpretation addressed them. No decision rules.',
            ],
            [
              'Score',
              'Explicitly none. The developers warn against reporting an item count or percentage.',
              'None.',
            ],
            [
              'Intended users',
              'Broad: clinicians, guideline developers, overview authors, methodologists, journal editors.',
              'Primarily guideline developers and overview authors, plus review authors who want to avoid bias in their own reviews.',
            ],
            [
              'Effort',
              'Lower. Items are concrete and most can be answered from the review report. Perry et al. (2021) found it more straightforward to use.',
              'Higher. Each domain judgement is a reasoned decision, and reviews without a formal synthesis are harder to rate.',
            ],
            ['In CoRATES', 'Supported.', 'Not currently supported.'],
          ],
        },
      },
      {
        heading: 'Quality and bias are different questions',
        paragraphs: [
          'A review can follow good practice on every item and still reach a biased conclusion, if it interprets its findings without regard to the limitations of the included studies. Equally, a review with several process weaknesses can still land on the right answer. AMSTAR 2 counts weaknesses in conduct and reporting and turns them into a confidence rating. ROBIS asks, for each weakness, whether it could actually have distorted the result, and then in phase 3 whether the review authors took it into account when they interpreted their findings.',
          'AMSTAR 2 is not blind to interpretation. Its thirteenth item asks whether risk of bias in the primary studies was accounted for when interpreting the results, and it is one of the seven critical items. But in ROBIS the appropriateness of the conclusions is a full phase of the assessment, and the relevance question from phase 1 feeds into it. If your purpose is to decide whether to act on a review, that phase is what you are paying for.',
        ],
      },
      {
        heading: 'Scope: what each tool was written for',
        paragraphs: [
          'AMSTAR 2 is written for reviews of healthcare interventions. Its items about randomized and non-randomized designs, meta-analytical methods and the funding of included studies assume that context. Applied to a review of diagnostic accuracy or prognostic factors, several items do not fit, and adapting them silently produces a rating that readers will misread as a standard AMSTAR 2 result.',
          'ROBIS was built to apply across question types. That flexibility is why guideline programmes with mixed evidence often reach for it, and why some overview authors find it vaguer than AMSTAR 2 for a pure intervention question.',
        ],
      },
      {
        heading: 'The critical-item mechanism in AMSTAR 2',
        paragraphs: [
          "AMSTAR 2's rating rules are severe by design. Any one critical flaw caps the review at Low confidence, and two cap it at Critically Low, regardless of how many other items were satisfied. In published overviews the large majority of reviews land in those two categories, most often because of a missing protocol or an incomplete list of excluded studies.",
          'The developers allow assessors to adjust which items are treated as critical for a particular field, but only if the choice is made in advance and reported. Changing the critical set after seeing the ratings is the AMSTAR 2 equivalent of outcome switching.',
        ],
      },
      {
        heading: 'What the empirical comparisons found',
        paragraphs: [
          "Head-to-head studies find the two tools closely related rather than identical. Lorenz et al. (2019) reported high concordance between overall AMSTAR 2 and ROBIS ratings, with inter-rater reliability moderate for AMSTAR 2 and fair for ROBIS. Perry et al. (2021) applied both to the same 31 reviews and found identical median agreement between raters, with AMSTAR 2 more straightforward to use and ROBIS easier to apply to reviews that included a meta-analysis. Buhn et al. (2017) found ROBIS had fair reliability and good construct validity, and that reliability depended on the raters' experience.",
          'The practical lesson is the same for either tool: pilot on a handful of reviews, write down how you will handle the items that caused disagreement, and use two independent assessors with a reconciliation step. Neither tool is reliable in the hands of a single untrained reviewer.',
        ],
      },
      {
        heading: 'Using both, and what neither does',
        paragraphs: [
          'Applying both tools to the same reviews is common in methods research and occasionally in overviews. If you do, present both sets of results and decide in advance how a discordant verdict will be reported; do not merge them into a single rating. If you only have capacity for one, choose it on scope and purpose, state the choice in the protocol, and apply it to every included review.',
          'Neither tool is a reporting checklist: PRISMA tells authors what to report and should not be used to appraise a review. And neither rates the certainty of the evidence: that is GRADE, applied to the body of evidence within a review, not to the review as a document.',
        ],
      },
    ],
    faq: [
      {
        question: 'Which tool is more widely used?',
        answer:
          'AMSTAR 2, by a wide margin, in published overviews and umbrella reviews. ROBIS is used more by guideline developers and in methods research. The Cochrane Handbook chapter on overviews describes both, says it cannot currently recommend one over the other, and notes that AMSTAR 2 may be preferred for future Cochrane overviews.',
      },
      {
        question: 'Can I report an AMSTAR 2 result as a score out of 16?',
        answer:
          'No. The developers state that AMSTAR 2 is not intended to produce an overall score, because the items are not of equal importance. Report the overall confidence rating and, ideally, the item-level responses so readers can see which weaknesses drove it.',
      },
      {
        question:
          'Can I use AMSTAR 2 on a review that includes both randomized and non-randomized studies?',
        answer:
          'Yes. That is the main reason AMSTAR 2 was developed. Several items ask separately about randomized and non-randomized designs, and the risk-of-bias item expects an appropriate tool to have been used for each.',
      },
      {
        question: 'Is ROBIS suitable for reviews of diagnostic test accuracy?',
        answer:
          'Yes. ROBIS was designed for reviews of interventions, diagnosis, prognosis and aetiology. AMSTAR 2 was not.',
      },
      {
        question: 'Can I appraise the primary studies with AMSTAR 2 or ROBIS?',
        answer:
          'No. Both appraise the review. The studies inside it need a tool for their own design: RoB 2 for randomized trials, ROBINS-I for non-randomized studies of interventions.',
      },
      {
        question: 'Should I use PRISMA to assess the quality of a review?',
        answer:
          'No. PRISMA is a reporting guideline. A review can be fully PRISMA-compliant and still be at high risk of bias, and a poorly reported review may have been well conducted. Use AMSTAR 2 or ROBIS for appraisal.',
      },
      {
        question: 'Do the two tools give the same verdict?',
        answer:
          "Usually, but not always. Overall ratings correlate strongly, and disagreements tend to arise where AMSTAR 2 assigns Critically Low for a critical flaw that ROBIS treats as a concern the review's interpretation addressed. Expect some discordant reviews and decide beforehand how to report them.",
      },
      {
        question: 'Does CoRATES support ROBIS?',
        answer:
          'Not at present. CoRATES supports AMSTAR 2, including the official decision rules for the overall confidence rating, multi-reviewer appraisal and reconciliation. If ROBIS support matters for your work, tell us through the contact page.',
      },
    ],
    referenceLinks: [
      {
        href: 'https://www.bmj.com/content/358/bmj.j4008',
        text: 'Shea et al. (2017): AMSTAR 2 publication, BMJ',
      },
      {
        href: 'https://amstar.ca/Amstar-2.php',
        text: 'AMSTAR 2 official website (amstar.ca)',
      },
      {
        href: 'https://www.bristol.ac.uk/population-health-sciences/projects/robis/',
        text: 'ROBIS tool and guidance (University of Bristol)',
      },
      {
        href: `${HANDBOOK}/chapter-v`,
        text: 'Cochrane Handbook Chapter V: Overviews of reviews',
      },
    ],
    citations: [
      {
        authors: 'Shea BJ, Reeves BC, Wells G, et al.',
        year: '2017',
        title:
          'AMSTAR 2: a critical appraisal tool for systematic reviews that include randomised or non-randomised studies of healthcare interventions, or both',
        source: 'BMJ 2017;358:j4008',
        url: 'https://www.bmj.com/content/358/bmj.j4008',
      },
      {
        authors: 'Whiting P, Savovic J, Higgins JPT, et al.',
        year: '2016',
        title: 'ROBIS: A new tool to assess risk of bias in systematic reviews was developed',
        source: 'Journal of Clinical Epidemiology, 69, 225-234',
        url: 'https://doi.org/10.1016/j.jclinepi.2015.06.005',
      },
      {
        authors: 'Perry R, Whitmarsh A, Leach V, Davies P.',
        year: '2021',
        title:
          'A comparison of two assessment tools used in overviews of systematic reviews: ROBIS versus AMSTAR-2',
        source: 'Systematic Reviews, 10, 273',
        url: 'https://doi.org/10.1186/s13643-021-01819-x',
      },
      {
        authors: 'Lorenz RC, Matthias K, Pieper D, et al.',
        year: '2019',
        title:
          'A psychometric study found AMSTAR 2 to be a valid and moderately reliable appraisal tool',
        source: 'Journal of Clinical Epidemiology, 114, 133-140',
        url: 'https://doi.org/10.1016/j.jclinepi.2019.05.028',
      },
      {
        authors: 'Buhn S, Mathes T, Prengel P, et al.',
        year: '2017',
        title:
          'The risk of bias in systematic reviews tool showed fair reliability and good construct validity',
        source: 'Journal of Clinical Epidemiology, 91, 121-128',
        url: 'https://doi.org/10.1016/j.jclinepi.2017.06.019',
      },
    ],
    ctaTools: ['amstar2'],
    ctaNote: 'ROBIS is not currently available in CoRATES.',
    related: [
      { to: '/resources/amstar2', label: 'AMSTAR 2 guide' },
      { to: '/resources/rob2-vs-robins-i', label: 'RoB 2 vs ROBINS-I' },
    ],
  },

  'rob1-vs-rob2': {
    slug: 'rob1-vs-rob2',
    title: 'RoB 1 vs RoB 2: what changed in the Cochrane risk-of-bias tool',
    metaTitle: 'RoB 1 vs RoB 2: What Changed and Which to Use | CoRATES',
    metaDescription:
      'How the original Cochrane risk-of-bias tool differs from RoB 2: the domain mapping, the end of Unclear, per-result assessment, and what to do with a review that used the older tool.',
    intro: [
      'The original Cochrane risk-of-bias tool was introduced in 2008 and revised in 2011. Most people now call it RoB 1, although that name was never official. RoB 2 was published in 2019 and is the recommended tool for randomized trials in Cochrane Reviews. The two cover the same ground, but RoB 2 is a replacement rather than a new edition: it restructured the domains, replaced free judgements with signalling questions and algorithms, dropped the Unclear category, and moved the unit of assessment from the trial to the result.',
      'This page maps the old domains onto the new ones, explains where the two tools genuinely disagree about the same trial, and covers the practical question that generates most searches: what to do with a review, or an update, that used RoB 1.',
    ],
    quickAnswers: [
      {
        situation: 'Starting a new review',
        answer: 'RoB 2',
        detail:
          'Cochrane recommends it for randomized trials, and most journals and funders now expect it. The variants for cluster-randomized and crossover trials are also RoB 2.',
      },
      {
        situation: 'Updating a review that used RoB 1',
        answer: 'Either, but not both',
        detail:
          'Cochrane says it will never be mandatory to switch during an update. Switch if you expect many new studies and can re-assess the old ones; continue with RoB 1 if few are expected. Decide before you start and apply one tool to every result.',
      },
      {
        situation: 'Reading a review that used RoB 1',
        answer: 'Its judgements stand',
        detail:
          'They are valid for the tool that produced them. Do not translate them: Unclear is not Some concerns, and a High for blinding under RoB 1 does not predict the RoB 2 verdict.',
      },
    ],
    sections: [
      {
        heading: 'How the domains map',
        paragraphs: [
          'The mapping below is approximate by necessity. RoB 2 did not rename the old domains; it asked different questions about the same sources of bias and moved some concerns between them.',
        ],
        domainMapping: {
          leftTitle: 'RoB 1 (2011)',
          rightTitle: 'RoB 2 (2019)',
          left: [
            { label: 'Random sequence generation' },
            { label: 'Allocation concealment' },
            { label: 'Blinding', sub: 'participants and personnel' },
            { label: 'Blinding', sub: 'outcome assessment' },
            { label: 'Incomplete outcome data' },
            { label: 'Selective reporting' },
            { label: 'Other bias' },
          ],
          right: [
            { label: 'Domain 1', sub: 'Randomization process' },
            { label: 'Domain 2', sub: 'Deviations from intended interventions' },
            { label: 'Domain 3', sub: 'Missing outcome data' },
            { label: 'Domain 4', sub: 'Measurement of the outcome' },
            { label: 'Domain 5', sub: 'Selection of the reported result' },
          ],
          edges: [
            { from: 0, to: 0 },
            { from: 1, to: 0 },
            { from: 2, to: 1 },
            { from: 3, to: 3 },
            { from: 4, to: 2 },
            { from: 4, to: 1, dashed: true },
            { from: 5, to: 4 },
            { from: 6, to: null, dashed: true },
          ],
          caption:
            'Dashed lines: exclusions after randomization, previously part of incomplete outcome data, are now considered under Domain 2; other bias has no equivalent in RoB 2.',
          description:
            'Sequence generation and allocation concealment merge into Domain 1. Blinding of participants and personnel feeds Domain 2 and blinding of outcome assessment feeds Domain 4. Incomplete outcome data becomes Domain 3, with exclusions after randomization moving to Domain 2. Selective reporting becomes Domain 5. Other bias has no equivalent.',
        },
        table: {
          columns: ['RoB 1 domain', 'RoB 2 domain', 'What changed'],
          rows: [
            [
              'Random sequence generation',
              'Domain 1: bias arising from the randomization process',
              'Merged with allocation concealment, and a signalling question on baseline imbalance was added as evidence about whether the randomization process was sound.',
            ],
            [
              'Allocation concealment',
              'Domain 1: bias arising from the randomization process',
              'As above.',
            ],
            [
              'Blinding of participants and personnel',
              'Domain 2: bias due to deviations from intended interventions',
              'Blinding is no longer a domain in its own right. Domain 2 asks whether awareness of assignment led to deviations from the intended intervention that were unbalanced and likely to affect the outcome, and whether an appropriate analysis was used. An open-label trial is not automatically at high risk.',
            ],
            [
              'Blinding of outcome assessment',
              'Domain 4: bias in measurement of the outcome',
              'Asks whether outcome assessors were aware of assignment and, if so, whether the assessment could have been influenced by that knowledge, which depends on the type of outcome.',
            ],
            [
              'Incomplete outcome data',
              'Domain 3: bias due to missing outcome data',
              'Moves from the proportion missing to whether the result is likely to be biased by the missingness: were data available for nearly all participants, is there evidence the result was not biased, and could missingness depend on the true value of the outcome. Exclusions after randomization are now considered under Domain 2.',
            ],
            [
              'Selective reporting',
              'Domain 5: bias in selection of the reported result',
              'Narrowed to selection among multiple measurements or analyses of the same outcome, which requires checking a pre-specified plan. Non-reporting of whole outcomes is handled at the synthesis level rather than within the tool.',
            ],
            [
              'Other bias',
              'No equivalent',
              'Dropped. Design-specific concerns for cluster-randomized and crossover trials are handled by the RoB 2 variants for those designs. Baseline imbalance moved into Domain 1. Concerns that are not biases in the RoB 2 sense, such as applicability or imprecision, belong in GRADE instead.',
            ],
          ],
        },
      },
      {
        heading: 'Side by side',
        paragraphs: [],
        table: {
          columns: ['', 'RoB 1', 'RoB 2'],
          rows: [
            [
              'Published',
              '2008 in the Cochrane Handbook; revised 2011 (Higgins et al., BMJ).',
              '2019 (Sterne et al., BMJ).',
            ],
            [
              'Unit of assessment',
              'The trial, with some domains assessed per outcome.',
              'Each result: one outcome, time point and analysis.',
            ],
            [
              'Domains',
              'Seven, including an open-ended other bias domain.',
              'Five fixed domains. No other bias domain.',
            ],
            [
              'How judgements are reached',
              'Reviewer judgement per domain, supported by quoted text and the Handbook criteria.',
              'Signalling questions answered Yes, Probably yes, Probably no, No or No information, and a published algorithm that proposes the judgement. Reviewers can override with a recorded reason.',
            ],
            [
              'Judgement categories',
              'Low risk, High risk, Unclear risk.',
              'Low risk, Some concerns, High risk.',
            ],
            [
              'Missing information',
              'Unclear risk.',
              'No information is a response to a signalling question, not a verdict. The algorithm turns it into Some concerns or High depending on where the gap is.',
            ],
            [
              'Overall judgement',
              'No formal rule. Reviewers summarised across domains in different ways.',
              'Defined rules. High if any domain is High, or if Some concerns in several domains substantially lowers confidence; Some concerns if any domain is Some concerns and none is High; Low only if every domain is Low.',
            ],
            [
              'Effect of interest',
              'Not specified.',
              'Chosen in advance: the effect of assignment to intervention or the effect of adhering to it. Domain 2 differs between them.',
            ],
            [
              'Trial designs',
              'Handbook guidance for cluster-randomized and crossover trials.',
              'Dedicated variants for cluster-randomized and crossover trials that add design-specific questions.',
            ],
            [
              'Documents needed',
              'Usually the trial report.',
              'The trial report plus the protocol, registry entry or statistical analysis plan for Domain 5.',
            ],
            [
              'Cochrane status',
              'Superseded. Still permitted when updating a review that used it.',
              'Recommended for randomized trials in Cochrane Reviews.',
            ],
            ['In CoRATES', 'Not supported.', 'Supported (parallel-group version).'],
          ],
        },
      },
      {
        heading: 'Unclear is gone, and Some concerns is not its replacement',
        paragraphs: [
          'Unclear in RoB 1 covered two different situations: information not reported, and information reported but ambiguous. RoB 2 separates them. No information is an answer to a single signalling question, and the algorithm decides what it implies. For a question that would reveal a problem, no information means no evidence of that problem; for something a trial should have reported, it raises concern. A trial that was Unclear across the board under RoB 1 may come out as Some concerns or as High under RoB 2, and there is no way to tell which without re-assessing it.',
        ],
      },
      {
        heading: 'Blinding is an input, not a verdict',
        paragraphs: [
          'Under RoB 1, an open-label trial usually received High risk for both blinding domains. Under RoB 2 the question is whether the lack of blinding mattered for this result. An open-label trial with an objective outcome, no differential deviations and an intention-to-treat analysis can be Low in Domains 2 and 4. This is the single biggest source of changed judgements when trials are re-assessed, and it usually moves them towards lower risk.',
          'Domain 5 often moves the other way. If no protocol, registration or analysis plan can be found, RoB 2 does not let a result reach Low for selection of the reported result, where RoB 1 reviewers frequently recorded Unclear and moved on.',
        ],
      },
      {
        heading: 'Per result, not per trial',
        paragraphs: [
          'A trial with a blinded clinician-assessed primary outcome and an unblinded patient-reported secondary outcome gets a separate RoB 2 assessment for each result, and may get different verdicts. This multiplies the work but produces judgements that map onto the specific rows of the meta-analysis. RoB 1 let reviewers assess per outcome for some domains but was usually applied once per trial.',
        ],
      },
      {
        heading: 'The overall judgement has rules',
        paragraphs: [
          'RoB 1 never defined how domain judgements combine, so reviews summarised them in incompatible ways. RoB 2 does: any High domain makes the result High overall, and Some concerns in several domains can too. The Handbook stresses that risk of bias means risk of material bias, so a Some concerns judgement should reflect a plausible effect on the result rather than a formality.',
        ],
      },
      {
        heading: 'It takes longer, and agreement does not improve by itself',
        paragraphs: [
          'Minozzi et al. (2020) measured about half an hour per result and only slight agreement on the overall judgement among four experienced raters. Their follow-up (2022) found that a calibration exercise and a written, review-specific implementation document raised agreement to moderate and cut the time per result substantially. The tool rewards teams that plan for it and punishes teams that treat it as a longer RoB 1.',
        ],
      },
      {
        heading: 'What to do with an existing review that used RoB 1',
        paragraphs: [
          'Do not convert. There is no valid mapping from Low, High and Unclear to Low, Some concerns and High, because the tools ask different questions and combine them differently. Re-assess with RoB 2 or keep the RoB 1 judgements as they are.',
          'For a Cochrane update, the editorial position is that switching to RoB 2 will never be mandatory if the previous version used the original tool. The suggested rule of thumb is to switch when many new studies are expected and to continue with RoB 1 when few are. If you switch, update the methods before starting and assess every result, old and new, with RoB 2. Mixing the two tools within one review is not acceptable.',
          'For GRADE, the risk-of-bias domain is a judgement about a body of evidence, so it can draw on either tool. State which tool applies to which trials, and remember that a RoB 2 overall of Some concerns is not automatically a downgrade; the question is whether the concerns are likely to have changed the pooled result.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is RoB 1 still acceptable?',
        answer:
          'It is not wrong, but it is superseded. Cochrane recommends RoB 2 for randomized trials in new reviews, and many journals and funders expect it. RoB 1 remains acceptable when updating a review that used it, and the judgements in existing reviews remain valid for what they measured.',
      },
      {
        question: 'Can I convert RoB 1 judgements to RoB 2?',
        answer:
          'No. The domains, the questions and the rules for combining them differ. Re-assess with RoB 2 or report the RoB 1 judgements on their own scale.',
      },
      {
        question: 'Does Some concerns mean the same as Unclear?',
        answer:
          'No. Unclear meant the reviewer could not judge. Some concerns is a substantive judgement that the result may be affected by bias without the evidence supporting High. RoB 2 handles missing information through the No information response to individual signalling questions instead.',
      },
      {
        question: 'Why did RoB 2 drop the other bias domain?',
        answer:
          'To keep the tool to specific, defined sources of bias, each with its own signalling questions. Open-ended domains were applied inconsistently. Design-specific issues moved to the cluster-randomized and crossover variants; applicability, imprecision and similar concerns belong in GRADE.',
      },
      {
        question: 'Is RoB 2 harder to apply?',
        answer:
          'Yes. It needs more documents, per-result assessment and more time. Empirical studies found low agreement without calibration and much better agreement once teams wrote down review-specific instructions. Plan for a calibration round and two independent reviewers.',
      },
      {
        question: 'Which tool should a non-Cochrane review use?',
        answer:
          'RoB 2, unless the journal or funder specifies otherwise. The Cochrane Handbook describes RoB 2 as the recommended tool, and there is no methodological reason to prefer RoB 1 for a new review.',
      },
      {
        question: 'How do I make a traffic-light plot for RoB 2?',
        answer:
          'The robvis package and web app (McGuinness and Higgins, 2021) has templates for both RoB 1 and RoB 2. CoRATES exports RoB 2 assessments as traffic-light and weighted bar plots directly.',
      },
      {
        question: 'Does CoRATES support RoB 1?',
        answer:
          'No. CoRATES implements RoB 2, with the official algorithms proposing domain and overall judgements, and supports independent assessment by several reviewers followed by reconciliation.',
      },
    ],
    referenceLinks: [
      {
        href: 'https://www.riskofbias.info/welcome/rob-2-0-tool/current-version-of-rob-2',
        text: 'RoB 2 official tool and templates (riskofbias.info)',
      },
      {
        href: `${HANDBOOK}/chapter-08`,
        text: 'Cochrane Handbook Chapter 8: Assessing risk of bias in a randomized trial',
      },
      {
        href: 'https://www.cochrane.org/learn/courses-and-resources/cochrane-methodology/risk-bias/about-risk-bias-2-rob-2',
        text: 'Cochrane: About Risk of Bias 2 (RoB 2), including guidance for review updates',
      },
      {
        href: 'https://www.bmj.com/content/343/bmj.d5928',
        text: 'Higgins et al. (2011): the original Cochrane risk-of-bias tool, BMJ',
      },
      {
        href: 'https://www.riskofbias.info/welcome/robvis-visualization-tool',
        text: 'robvis: risk-of-bias visualization tool',
      },
    ],
    citations: [
      {
        authors: 'Higgins JPT, Altman DG, Gotzsche PC, et al.',
        year: '2011',
        title: "The Cochrane Collaboration's tool for assessing risk of bias in randomised trials",
        source: 'BMJ 2011;343:d5928',
        url: 'https://www.bmj.com/content/343/bmj.d5928',
      },
      {
        authors: 'Sterne JAC, Savovic J, Page MJ, et al.',
        year: '2019',
        title: 'RoB 2: a revised tool for assessing risk of bias in randomised trials',
        source: 'BMJ 2019;366:l4898',
        url: 'https://www.bmj.com/content/366/bmj.l4898',
      },
      {
        authors: 'Minozzi S, Cinquini M, Gianola S, Gonzalez-Lorenzo M, Banzi R.',
        year: '2020',
        title:
          'The revised Cochrane risk of bias tool for randomized trials (RoB 2) showed low interrater reliability and challenges in its application',
        source: 'Journal of Clinical Epidemiology, 126, 37-44',
        url: 'https://doi.org/10.1016/j.jclinepi.2020.06.015',
      },
      {
        authors: 'Minozzi S, Dwan K, Borrelli F, Filippini G.',
        year: '2022',
        title:
          'Reliability of the revised Cochrane risk-of-bias tool for randomised trials (RoB2) improved with the use of implementation instruction',
        source: 'Journal of Clinical Epidemiology, 141, 99-105',
        url: 'https://doi.org/10.1016/j.jclinepi.2021.09.021',
      },
      {
        authors: 'McGuinness LA, Higgins JPT.',
        year: '2021',
        title:
          'Risk-of-bias VISualization (robvis): An R package and Shiny web app for visualizing risk-of-bias assessments',
        source: 'Research Synthesis Methods, 12, 55-61',
        url: 'https://doi.org/10.1002/jrsm.1411',
      },
    ],
    ctaTools: ['rob2'],
    ctaNote: 'RoB 1 is not available in CoRATES.',
    related: [
      { to: '/resources/rob2', label: 'RoB 2 guide' },
      { to: '/resources/rob2-vs-robins-i', label: 'RoB 2 vs ROBINS-I' },
    ],
  },

  'robins-i-v1-vs-v2': {
    slug: 'robins-i-v1-vs-v2',
    title: "What's new in ROBINS-I V2: version 1 vs version 2",
    metaTitle: 'ROBINS-I V2: What Changed From Version 1 | CoRATES',
    metaDescription:
      'ROBINS-I V2 drops a domain, adds algorithms, a triage step, graded responses and immortal-time questions, and narrows its scope to cohort studies. What changed, and what it means for a review in progress.',
    intro: [
      'ROBINS-I was published in 2016 and became the recommended risk-of-bias tool for non-randomized studies of interventions in Cochrane Reviews. Version 2 was first released in November 2024, and the current document, posted on 20 November 2025, is still described by the developers as a draft subject to change. It keeps the ideas that defined the original: assessment of one result at a time against a target trial, confounding as the central concern, and a four-level scale anchored to a well-performed randomized trial. But it changes enough of the structure that V1 and V2 assessments are not interchangeable.',
      'This page lists what changed, explains the reasoning behind the larger changes, and sets out what a review team should do if it started under V1.',
    ],
    quickAnswers: [
      {
        situation: 'Starting a new review',
        answer: 'V2',
        detail:
          'It is the current version at riskofbias.info and the version CoRATES implements. Note the draft status in your methods and record the document date you used.',
      },
      {
        situation: 'Review in progress with V1 assessments',
        answer: 'Finish with V1, or re-assess everything',
        detail:
          'Do not mix versions within a review. Re-assessing under V2 is a substantial job, because the domains, questions and response options differ.',
      },
      {
        situation: 'Designs other than cohort studies',
        answer: 'Check the released documents',
        detail:
          'The V2 document currently available covers follow-up (cohort) studies. The Cochrane Handbook notes that variants for several other designs are in preparation.',
      },
    ],
    sections: [
      {
        heading: 'How the domains map',
        paragraphs: [
          'Five of the seven 2016 domains carry over with the same scope. Classification of intervention and selection of participants swap places, and the deviations domain is absorbed into the per-protocol variant of the confounding domain.',
        ],
        domainMapping: {
          leftTitle: 'ROBINS-I (2016)',
          rightTitle: 'ROBINS-I V2',
          left: [
            { label: 'Confounding' },
            { label: 'Selection of participants' },
            { label: 'Classification of interventions' },
            { label: 'Deviations', sub: 'from intended interventions' },
            { label: 'Missing data' },
            { label: 'Measurement of outcomes' },
            { label: 'Selection of the reported result' },
          ],
          right: [
            { label: 'Domain 1', sub: 'Confounding, variant A or B' },
            { label: 'Domain 2', sub: 'Classification of intervention' },
            { label: 'Domain 3', sub: 'Selection of participants' },
            { label: 'Domain 4', sub: 'Missing data' },
            { label: 'Domain 5', sub: 'Measurement of the outcome' },
            { label: 'Domain 6', sub: 'Selection of the reported result' },
          ],
          edges: [
            { from: 0, to: 0 },
            { from: 1, to: 2 },
            { from: 2, to: 1 },
            { from: 3, to: 0, dashed: true },
            { from: 4, to: 3 },
            { from: 5, to: 4 },
            { from: 6, to: 5 },
          ],
          caption:
            'Dashed line: when the analysis estimates a per-protocol effect, the concerns of the deviations domain are assessed as time-varying confounding within Domain 1, variant B.',
          description:
            'Confounding, missing data, measurement of outcomes and selection of the reported result carry over. Selection of participants and classification of interventions swap order. Deviations from intended interventions is absorbed into the confounding domain when a per-protocol effect is assessed.',
        },
      },
      {
        heading: 'What changed',
        paragraphs: [],
        table: {
          columns: ['', 'ROBINS-I (2016)', 'ROBINS-I V2 (2024 onwards)'],
          rows: [
            [
              'Bias domains',
              'Seven: confounding; selection of participants; classification of interventions; deviations from intended interventions; missing data; measurement of outcomes; selection of the reported result.',
              'Six. The deviations domain is gone, and classification of intervention now comes before selection of participants.',
            ],
            [
              'Where deviations went',
              'A separate domain covering co-interventions, switches and adherence.',
              'Handled through the effect of interest. If the analysis estimates a per-protocol effect, the confounding domain expands to cover time-varying confounding. The requirement to pre-specify co-interventions was removed.',
            ],
            [
              'Confounding domain',
              'One set of questions covering baseline and time-varying confounding.',
              'Two variants chosen by the effect of interest: one for the intention-to-treat effect, where only baseline confounding needs to be addressed, and one for the per-protocol effect, where baseline and time-varying confounding are both assessed.',
            ],
            [
              'Planning',
              'List important confounders and co-interventions at protocol stage; describe the target trial.',
              'List confounders at protocol stage. For each result: specify the numerical result and outcome, answer the triage questions, and describe the target trial including whether the analysis accounted for switches and deviations during follow-up.',
            ],
            [
              'Triage',
              'None. Every result received the full assessment.',
              'New preliminary questions send a result straight to Critical risk of bias when the authors made no attempt to control confounding and the potential for confounding is sufficient, or when the outcome measurement was inappropriate.',
            ],
            [
              'Responses',
              'Yes, Probably yes, Probably no, No, No information.',
              'The same five, plus graded options on some questions that distinguish a substantial problem from a minor one, for example No but not substantial versus No and probably substantial.',
            ],
            [
              'How domain judgements are reached',
              'Guidance described patterns of responses, but the reviewer decided.',
              'Algorithms map the responses to a proposed judgement for each domain. The reviewer can override with a recorded reason.',
            ],
            [
              'Judgement categories',
              'Low, Moderate, Serious, Critical, No information.',
              'The same, plus a qualified judgement, Low except for concerns about uncontrolled confounding, which recognises that unmeasured confounding can never be ruled out in a non-randomized study.',
            ],
            [
              'Immortal time and prevalent users',
              'Discussed in the guidance.',
              'Explicit signalling questions in the classification and selection domains.',
            ],
            [
              'Missing data',
              'Focused on the amount of missing data and the analysis used.',
              'Substantially reconceived and expanded, following the approach taken in RoB 2.',
            ],
            [
              'Scope',
              'Cohort-type designs, with Handbook guidance extending to controlled before-after and interrupted time series designs.',
              'Follow-up (cohort) studies. Variants for other designs anticipated.',
            ],
            [
              'Information sources',
              'Recorded in free text alongside the judgements.',
              'A structured list of the sources used: journal articles, protocol, statistical analysis plan, registry records, regulatory documents, individual participant data, correspondence with investigators.',
            ],
          ],
        },
      },
      {
        heading: 'Why the deviations domain went away',
        paragraphs: [
          'In V1 the deviations domain overlapped with confounding whenever the effect of interest was the effect of starting and adhering to the intervention, and it was frequently applied to intention-to-treat analyses where it did not belong. V2 resolves this by making the effect of interest a switch that changes the tool. When the analysis estimates the effect of assignment, only baseline confounding is assessed. When it estimates the effect of adhering, the confounding domain also covers time-varying confounding, which is where switches, co-interventions and adherence actually bias a non-randomized comparison.',
          'Reviewers who learned V1 will look for the deviations domain and not find it. The concern has not been dropped; it has been placed where the causal structure says it belongs.',
        ],
      },
      {
        heading: 'Triage changes how you plan',
        paragraphs: [
          'Under V1 a study with no adjustment for confounding received a Critical judgement only after a full pass through every domain. Under V2 the preliminary questions can end the assessment early. This matters most in reviews built on large numbers of registry or database studies, where a substantial fraction may fail triage. The questions ask whether the authors made any attempt to control confounding and whether the potential for confounding is sufficient to set the result aside, so a crude adjustment still leads to the full assessment. Do not use triage as a shortcut for studies that adjusted badly; that is what the confounding domain is for.',
        ],
      },
      {
        heading: 'Algorithms and graded responses',
        paragraphs: [
          'V1 gave detailed guidance on how patterns of responses should map to judgements but left the final step to the reviewer. V2 follows RoB 2 in proposing the judgement algorithmically, which improves consistency across reviewers and makes overrides visible, because an override has to be recorded with a reason. The graded response options serve the same end. Being able to answer that a confounder was not controlled but the omission is probably not substantial, rather than a bare No, lets the algorithm distinguish a Moderate from a Serious judgement for reasons a reader can follow.',
        ],
      },
      {
        heading: 'Immortal time and prevalent users',
        paragraphs: [
          'Immortal time arises when the period between entry into a cohort and the start of treatment is counted as exposed time, or is excluded from only one group, so that treated participants appear to survive longer by construction (Suissa, 2008). Prevalent-user designs compare people already established on a treatment with non-users, which conditions on having tolerated it. Both are common in database studies and both were discussed in the V1 guidance. V2 adds explicit signalling questions in the classification and selection domains so that they are asked about every time.',
        ],
      },
      {
        heading: 'Scope narrowed to follow-up studies',
        paragraphs: [
          'V1 was written for cohort-type designs, and the Cochrane Handbook extended it, with caveats, to controlled before-after and interrupted time series designs. The V2 document currently released is scoped to follow-up (cohort) studies, and the Handbook notes that a new version is under preparation with variants for several types of non-randomized design. Until those variants appear, a review including other designs should state which document it followed and why, and should not present a V2 cohort assessment of a case-control or before-after study as if it were routine.',
        ],
      },
      {
        heading: 'What this means for a review in progress',
        paragraphs: [
          'Pick one version and apply it to every result. If your protocol said ROBINS-I without a version, state the version in the methods now. Mixing V1 and V2 assessments within one review produces judgements with different domain structures, and a reader cannot tell which studies were assessed which way.',
          'Re-assessing under V2 is not a light touch. The domains differ, the confounding domain depends on a per-result decision about the effect of interest, the response options differ, and the triage step may remove studies from full assessment. Budget for it as new work. If the review is close to completion, finishing under V1 and saying so is the honest choice.',
          'Record the document date. V2 remains a draft and the developers have revised it since the first release. A review that reports the ROBINS-I V2 version dated 20 November 2025 is reproducible; one that reports only ROBINS-I V2 is not.',
        ],
      },
    ],
    faq: [
      {
        question: 'Is ROBINS-I V2 mandatory?',
        answer:
          'No published Cochrane guidance requires it. V2 is the current version at riskofbias.info and the natural choice for a new review. Follow your protocol and any journal or editorial requirement, and state the version and document date you used.',
      },
      {
        question: 'Are V1 assessments now wrong?',
        answer:
          'No. They are valid for the tool that produced them. Report the version and do not convert them to V2.',
      },
      {
        question: 'Can I combine V1 and V2 assessments in one review?',
        answer:
          'No. The domain structures differ, so the two sets of judgements cannot be presented in one table without misleading readers. Use one version throughout.',
      },
      {
        question: 'Does V2 still assess one result at a time?',
        answer:
          'Yes. Each assessment starts by specifying the numerical result and the outcome it relates to, and the target trial is described for that result.',
      },
      {
        question: 'Is there a V2 for case-control studies?',
        answer:
          'Not in the currently released documents, which cover follow-up (cohort) studies. The Cochrane Handbook notes that variants for several other designs are in preparation.',
      },
      {
        question:
          'Why is there a Low except for concerns about uncontrolled confounding judgement?',
        answer:
          'Because a non-randomized study can never demonstrate that all confounding has been controlled. The qualified judgement lets a well-designed, well-adjusted study be recognised as such without claiming the equivalence to a randomized trial that a plain Low would imply.',
      },
      {
        question: 'How is ROBINS-I V2 related to ROBINS-E?',
        answer:
          'ROBINS-E (Higgins et al., 2024) is the companion tool for non-randomized studies of exposures rather than interventions. It was developed alongside the V2 work and shares the same family design, but it is a separate tool with its own domains and should not be substituted for ROBINS-I.',
      },
      {
        question: 'How does CoRATES implement V2?',
        answer:
          'CoRATES follows the V2 structure: the planning list of confounders, the result and outcome specification, the triage questions, the target trial description including the intention-to-treat or per-protocol choice, the confounding variant that follows from it, the six domains with graded responses, and the algorithms that propose domain and overall judgements. Several reviewers can assess independently and reconcile. CoRATES does not modify the official algorithms.',
      },
    ],
    referenceLinks: [
      {
        href: 'https://www.riskofbias.info/welcome/robins-i-v2',
        text: 'ROBINS-I V2 official tool and guidance (riskofbias.info)',
      },
      {
        href: 'https://www.bmj.com/content/355/bmj.i4919',
        text: 'Sterne et al. (2016): original ROBINS-I publication, BMJ',
      },
      {
        href: `${HANDBOOK}/chapter-25`,
        text: 'Cochrane Handbook Chapter 25: Assessing risk of bias in a non-randomized study',
      },
      {
        href: 'https://www.riskofbias.info/welcome/robins-e-tool',
        text: 'ROBINS-E tool (riskofbias.info)',
      },
    ],
    citations: [
      {
        authors: 'Sterne JA, Hernan MA, Reeves BC, et al.',
        year: '2016',
        title:
          'ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions',
        source: 'BMJ 2016;355:i4919',
        url: 'https://www.bmj.com/content/355/bmj.i4919',
      },
      {
        authors: 'Higgins JPT, Morgan RL, Rooney AA, et al.',
        year: '2024',
        title:
          'A tool to assess risk of bias in non-randomized follow-up studies of exposure effects (ROBINS-E)',
        source: 'Environment International, 186, 108602',
        url: 'https://doi.org/10.1016/j.envint.2024.108602',
      },
      {
        authors: 'Hernan MA, Robins JM.',
        year: '2016',
        title: 'Using Big Data to Emulate a Target Trial When a Randomized Trial Is Not Available',
        source: 'American Journal of Epidemiology, 183, 758-764',
        url: 'https://doi.org/10.1093/aje/kwv254',
      },
      {
        authors: 'Suissa S.',
        year: '2008',
        title: 'Immortal time bias in pharmaco-epidemiology',
        source: 'American Journal of Epidemiology, 167, 492-499',
        url: 'https://doi.org/10.1093/aje/kwm324',
      },
      {
        authors: 'Schunemann HJ, Cuello C, Akl EA, et al.',
        year: '2019',
        title:
          'GRADE guidelines: 18. How ROBINS-I and other tools to assess risk of bias in nonrandomized studies should be used to rate the certainty of a body of evidence',
        source: 'Journal of Clinical Epidemiology, 111, 105-114',
        url: 'https://doi.org/10.1016/j.jclinepi.2018.01.012',
      },
    ],
    ctaTools: ['robins-i'],
    related: [
      { to: '/resources/robins-i', label: 'ROBINS-I V2 guide' },
      { to: '/resources/rob2-vs-robins-i', label: 'RoB 2 vs ROBINS-I' },
    ],
  },
};

export function getComparisonBySlug(slug: string): ComparisonContent | null {
  return COMPARISON_CONTENT[slug] || null;
}

export function getAllComparisons(): ComparisonContent[] {
  return Object.values(COMPARISON_CONTENT);
}
