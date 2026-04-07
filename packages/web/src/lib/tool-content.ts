/**
 * Tool Content Configuration
 *
 * Centralized content for all appraisal tool resource pages.
 * Each tool contains all the data needed to render its resource page.
 *
 * Note on copyright: AMSTAR 2, ROBINS-I, and RoB 2 are copyrighted instruments.
 * Content here describes them factually and points to the official sources.
 * It must NOT reproduce the signaling questions, scoring tables, or other
 * verbatim content from the official publications.
 */

export interface ReferenceLink {
  href: string;
  text: string;
}

export interface ScoreLevel {
  name: string;
  description: string;
  note?: string;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'gray';
}

export interface DomainSummary {
  name: string;
  shortDescription: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface Citation {
  authors: string;
  year: string;
  title: string;
  source: string;
  url?: string;
}

export interface ToolContent {
  id: string;
  name: string;
  slug: string;
  description: string;
  bestUsedFor: string;
  referenceLinks: ReferenceLink[];
  scoringDescription: string;
  scoreLevels: ScoreLevel[];
  // Optional richer content fields. Pages that include these will render
  // additional sections; pages without them remain minimal.
  fullName?: string;
  developedBy?: string;
  versionNote?: string;
  studyTypes?: string[];
  domains?: DomainSummary[];
  domainsIntro?: string;
  whenToUse?: string;
  whenNotToUse?: string;
  comparisonWithAlternatives?: string;
  versionHistory?: string;
  workflowInCoRATES?: string;
  commonPitfalls?: string[];
  faq?: FaqEntry[];
  citations?: Citation[];
}

export const TOOL_CONTENT: Record<string, ToolContent> = {
  amstar2: {
    id: 'amstar2',
    name: 'AMSTAR 2',
    slug: 'amstar2',
    fullName: 'A MeaSurement Tool to Assess systematic Reviews, version 2',
    developedBy:
      'Beverley J. Shea, Barnaby C. Reeves, George Wells, Micere Thuku, Candyce Hamel, Julian Moran, David Moher, Peter Tugwell, Vivian Welch, Elizabeth Kristjansson, and David A. Henry. The original publication appeared in the BMJ in September 2017 (Shea et al., BMJ 2017;358:j4008).',
    versionNote:
      'AMSTAR 2 was published in 2017 as a substantive revision and expansion of the original AMSTAR (2007). Unlike its predecessor, AMSTAR 2 is designed to appraise systematic reviews that include randomized trials, non-randomized studies of interventions, or both, and explicitly distinguishes between critical and non-critical methodological domains.',
    description:
      'AMSTAR 2 is a critical appraisal tool used to evaluate the methodological quality of systematic reviews of healthcare interventions. It comprises 16 items, seven of which are designated as critical domains because weaknesses in those items can substantially undermine the validity of a review and its conclusions. AMSTAR 2 produces an overall confidence rating for the results of a review (High, Moderate, Low, or Critically Low), based on the pattern of critical and non-critical weaknesses identified during the appraisal. The tool is widely used in evidence synthesis, methods research, and decision-making contexts where users need to distinguish high-quality systematic reviews from those whose conclusions should be interpreted with caution.',
    bestUsedFor:
      'Appraising the methodological quality of systematic reviews of healthcare interventions, including reviews that include randomized trials, non-randomized studies of interventions, or both. AMSTAR 2 is most useful when users need to decide how much confidence to place in the results of a published systematic review.',
    studyTypes: [
      'Systematic reviews of randomized controlled trials of healthcare interventions',
      'Systematic reviews of non-randomized studies of interventions (NRSI)',
      'Systematic reviews that combine randomized and non-randomized study designs',
      'Mixed-methods systematic reviews where the intervention question can be evaluated against the AMSTAR 2 items',
    ],
    domainsIntro:
      'AMSTAR 2 is organised as a 16-item checklist. Seven of the items are designated as "critical domains" because weaknesses in those items can substantially undermine confidence in a review\'s conclusions. The remaining nine items are "non-critical": they affect quality but not as severely. The seven critical domains are listed below by their topic labels; for the actual signalling questions and the detailed response options, consult the official AMSTAR 2 paper and guidance document linked under Reference Documents.',
    domains: [
      {
        name: 'Protocol registered before commencement of the review (Item 2)',
        shortDescription:
          'Whether the review authors registered or otherwise made publicly available a protocol describing their methods before they began the review. A pre-specified protocol guards against post-hoc decisions that can introduce selection and reporting bias into the review process.',
      },
      {
        name: 'Adequacy of the literature search (Item 4)',
        shortDescription:
          'Whether the review authors used a comprehensive literature search strategy that included multiple databases, supplementary search methods, and appropriate keywords and controlled vocabulary. An incomplete search risks missing relevant studies and introducing bias into the synthesised result.',
      },
      {
        name: 'Justification for excluding individual studies (Item 7)',
        shortDescription:
          'Whether the review authors provided a list of studies they considered but excluded, with explicit reasons for each exclusion. Without a justified exclusion list, readers cannot verify whether the review captured the relevant evidence base.',
      },
      {
        name: 'Risk of bias assessment for individual included studies (Item 9)',
        shortDescription:
          'Whether the review authors used a satisfactory technique for assessing the risk of bias in the individual studies included in the review. This is particularly important for reviews of non-randomized studies where confounding and selection bias are major concerns.',
      },
      {
        name: 'Appropriateness of meta-analytical methods (Item 11)',
        shortDescription:
          'When meta-analysis was performed, whether the authors used appropriate statistical methods for combining results, including suitable handling of heterogeneity and choice of fixed-effect or random-effects models.',
      },
      {
        name: 'Consideration of risk of bias when interpreting review results (Item 13)',
        shortDescription:
          'Whether the review authors took the risk of bias of individual included studies into account when interpreting and discussing the results of the review, rather than presenting the synthesised result as if all included studies were equally trustworthy.',
      },
      {
        name: 'Assessment of presence and likely impact of publication bias (Item 15)',
        shortDescription:
          'Whether the review authors carried out an adequate investigation of publication bias (small-study effects), which can systematically distort the synthesised result if studies with non-significant or unfavourable results were less likely to be published.',
      },
    ],
    versionHistory:
      'The original AMSTAR was published in 2007 (Shea et al., BMC Medical Research Methodology) as an 11-item tool for appraising systematic reviews of randomized trials. AMSTAR 2 (Shea et al., BMJ 2017) is a substantive revision: the number of items expanded from 11 to 16, the scope expanded to include non-randomized studies of interventions, the tool introduced the explicit critical/non-critical domain distinction, and the overall confidence rating system (High / Moderate / Low / Critically Low) was added. Some items in the original AMSTAR were merged or split, and several new items were added to better address the methodological challenges of including non-randomized evidence.',
    whenToUse:
      'Use AMSTAR 2 when you need to appraise the methodological quality of a published systematic review of a healthcare intervention. It is particularly appropriate when the review you are appraising includes non-randomized studies or a mixture of designs. AMSTAR 2 is widely used in umbrella reviews (reviews of systematic reviews), in evidence-based clinical guidelines that draw on existing systematic reviews, in health technology assessments, and in methods research that compares the quality of reviews across topic areas. Each AMSTAR 2 appraisal should be performed by at least two independent reviewers with disagreements resolved through discussion or arbitration.',
    whenNotToUse:
      'AMSTAR 2 is not designed to appraise primary studies; for individual randomized trials use RoB 2 and for individual non-randomized cohort studies of interventions use ROBINS-I V2. AMSTAR 2 is also not the right tool for evaluating systematic reviews of diagnostic test accuracy studies, prognostic studies, qualitative research, or epidemiological exposures, all of which have their own dedicated appraisal instruments. Finally, the authors of AMSTAR 2 explicitly caution against using the tool to generate a numerical "score" for a review; the intended output is an overall confidence rating derived from the pattern of weaknesses across the critical and non-critical items.',
    comparisonWithAlternatives:
      'AMSTAR 2 is one of several tools for appraising systematic reviews. ROBIS (Whiting et al., 2016) is an alternative risk-of-bias tool for systematic reviews developed contemporaneously; ROBIS focuses more directly on bias domains while AMSTAR 2 takes a broader methodological-quality perspective. For appraising the underlying primary studies referenced by a review, use RoB 2 (for randomized trials) or ROBINS-I V2 (for non-randomized cohort studies of interventions) instead. AMSTAR 2 and ROBIS are sometimes applied side by side in methods research to triangulate quality judgements. For comparing systematic reviews across multiple appraisal frameworks, CoRATES supports running parallel appraisals against the same body of evidence.',
    scoringDescription:
      'AMSTAR 2 does not produce a numerical score. Instead, the pattern of weaknesses across the seven critical and nine non-critical items determines an overall confidence rating: High, Moderate, Low, or Critically Low. The authors of AMSTAR 2 are explicit on this point: AMSTAR 2 is not intended to generate an overall score, and presenting an AMSTAR 2 result as a percentage or item-count is a misuse of the tool. CoRATES applies the published decision rules to derive the overall rating from the pattern of recorded weaknesses, and reviewers can override the suggested rating with documented rationale where the published rules do not capture the specifics of a review.',
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
          'More than one non-critical weakness: the systematic review has more than one weakness but no critical flaws. It may provide an accurate summary of the results of the available studies that were included in the review.',
        note: 'Multiple non-critical weaknesses may diminish confidence in the review and it may be appropriate to move the overall appraisal down from moderate to low confidence.',
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
    workflowInCoRATES:
      'CoRATES presents AMSTAR 2 as a structured digital workflow rather than a paper checklist or spreadsheet. Each of the 16 items is rendered with its response options in context, and the seven critical items are clearly distinguished from the nine non-critical items so reviewers know which weaknesses carry the most weight. Reviewers can attach rationale and direct quotes from the source review to each judgement. As items are completed, CoRATES applies the published decision rules to derive the overall confidence rating and updates it in real time. Multiple reviewers can complete independent AMSTAR 2 appraisals of the same review in parallel, and CoRATES surfaces disagreements in a side-by-side reconciliation view so they can be resolved before locking the appraisal. Completed appraisals can be exported as publication-ready summaries.',
    commonPitfalls: [
      'Treating AMSTAR 2 as a scoring system. The original authors are explicit that AMSTAR 2 is not designed to produce a numerical score; presenting a result as "13 out of 16" or as a percentage is a misuse of the tool. Report the overall confidence rating instead.',
      "Failing to distinguish critical from non-critical items. The seven critical items are designed to carry disproportionate weight in the overall judgement; treating all 16 items as equal will misrepresent the review's actual quality.",
      'Applying AMSTAR 2 to primary studies instead of systematic reviews. AMSTAR 2 appraises reviews; for individual randomized trials use RoB 2 and for non-randomized cohort studies use ROBINS-I V2.',
      'Using AMSTAR 2 for non-intervention reviews. The tool is scoped to reviews of healthcare interventions. Reviews of diagnostic test accuracy, prognostic factors, or epidemiological exposures should be appraised with tools designed for those study types.',
      "Single-reviewer appraisal. AMSTAR 2 appraisals should be carried out by at least two independent reviewers with disagreements resolved through discussion. Single-reviewer appraisals risk introducing the appraiser's own biases into the result.",
      'Neglecting the publication bias item. Item 15 is one of the seven critical items but is often overlooked in practice because publication bias assessment is technically demanding. A review that does not adequately investigate publication bias should not receive a "high" confidence rating.',
      'Confusing AMSTAR 2 with ROBIS. Both are appraisal tools for systematic reviews but they take different perspectives. AMSTAR 2 emphasises overall methodological quality while ROBIS focuses more directly on bias domains.',
    ],
    faq: [
      {
        question: 'What does AMSTAR stand for?',
        answer:
          'AMSTAR is an acronym for "A MeaSurement Tool to Assess systematic Reviews". The "2" in AMSTAR 2 indicates the second major version, published in 2017 as a substantive revision and expansion of the original 2007 tool.',
      },
      {
        question: 'How is AMSTAR 2 different from the original AMSTAR?',
        answer:
          'AMSTAR 2 expanded the number of items from 11 to 16, broadened the scope from reviews of randomized trials only to reviews that include non-randomized studies of interventions, introduced the explicit distinction between critical and non-critical domains, and added the overall confidence rating system (High / Moderate / Low / Critically Low). Some original items were merged or split, and several new items were added to address the methodological challenges of including non-randomized evidence.',
      },
      {
        question: 'How many items does AMSTAR 2 have?',
        answer:
          "AMSTAR 2 has 16 items in total. Seven of these are designated as critical domains because weaknesses in those items can substantially undermine confidence in a review's conclusions. The remaining nine items are non-critical: they affect quality but not as severely as the critical items.",
      },
      {
        question: 'Does AMSTAR 2 produce a score?',
        answer:
          'No. The authors of AMSTAR 2 are explicit that the tool is not intended to generate an overall numerical score. Instead, AMSTAR 2 produces an overall confidence rating in the results of the review (High, Moderate, Low, or Critically Low), derived from the pattern of weaknesses across the critical and non-critical items.',
      },
      {
        question: 'Should I use AMSTAR 2 or ROBIS?',
        answer:
          'Both tools are valid options for appraising systematic reviews and they take complementary perspectives. AMSTAR 2 focuses on overall methodological quality while ROBIS focuses more directly on risk of bias in the review process. Some methods researchers apply both tools side by side to triangulate their judgements. The choice may also depend on which tool is required by the journal, funder, or guideline body you are reporting to.',
      },
      {
        question: 'Can AMSTAR 2 be used to appraise primary studies?',
        answer:
          'No. AMSTAR 2 is designed to appraise systematic reviews, not the individual studies included within them. To appraise individual randomized trials, use RoB 2. To appraise individual non-randomized cohort studies of interventions, use ROBINS-I V2.',
      },
      {
        question: 'How does CoRATES support AMSTAR 2 appraisals?',
        answer:
          'CoRATES presents the 16 AMSTAR 2 items in a structured digital workflow with critical items clearly distinguished from non-critical items. Reviewers can attach rationale and quotes from the source review to each judgement, and CoRATES applies the published decision rules to derive the overall confidence rating in real time. Multiple reviewers can complete independent appraisals of the same review in parallel; disagreements are surfaced for reconciliation before the appraisal is locked.',
      },
      {
        question: 'Where are the official AMSTAR 2 items and guidance?',
        answer:
          'The official AMSTAR 2 publication is freely available in the BMJ (Shea et al., BMJ 2017;358:j4008), and the AMSTAR website at amstar.ca hosts the checklist and a guidance document with item-level explanations. CoRATES does not reproduce the official content; reviewers should consult the official sources alongside their appraisals. See Reference Documents above for direct links.',
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
        href: 'https://www.bmj.com/highwire/filestream/951408/field_highwire_adjunct_files/1/sheb036104.ww1.pdf',
        text: 'AMSTAR 2 guidance document (PDF)',
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
        authors: 'Shea BJ, Grimshaw JM, Wells GA, et al.',
        year: '2007',
        title:
          'Development of AMSTAR: a measurement tool to assess the methodological quality of systematic reviews',
        source: 'BMC Medical Research Methodology, 7, 10',
        url: 'https://doi.org/10.1186/1471-2288-7-10',
      },
      {
        authors: 'Whiting P, Savovic J, Higgins JPT, et al.',
        year: '2016',
        title: 'ROBIS: A new tool to assess risk of bias in systematic reviews was developed',
        source: 'Journal of Clinical Epidemiology, 69, 225-234',
        url: 'https://doi.org/10.1016/j.jclinepi.2015.06.005',
      },
    ],
  },

  robinsI: {
    id: 'robinsI',
    name: 'ROBINS-I V2',
    slug: 'robins-i',
    fullName: 'Risk Of Bias In Non-randomized Studies - of Interventions, Version 2',
    developedBy:
      'Members of the Cochrane Bias Methods Group and the Cochrane Non-Randomised Studies Methods Group, led by Jonathan Sterne and Julian Higgins. Development of ROBINS-I V2 was funded in part by Medical Research Council (MRC) grant MR/M025209/1.',
    versionNote:
      'Version 2 was first released in November 2024, with the most recent revision posted on November 20, 2025. V2 is currently scoped to follow-up (cohort) studies; further extensions for other non-randomized designs are in development.',
    description:
      'ROBINS-I V2 (Risk Of Bias In Non-randomized Studies - of Interventions, Version 2) is a tool for assessing risk of bias in a specific result from an individual non-randomized study that examines the effect of an intervention on an outcome. ROBINS-I V2 evaluates six bias domains and produces both domain-level and overall risk-of-bias judgements (Low, Moderate, Serious, Critical, or No information). The tool is designed to be used by reviewers conducting systematic reviews that include non-randomized studies of interventions, and is the preferred risk-of-bias tool for non-randomized studies in Cochrane Reviews.',
    bestUsedFor:
      'Assessing risk of bias in the results of follow-up (cohort) studies that compare the health effects of interventions and were not assigned by randomization. ROBINS-I V2 is the recommended risk-of-bias tool for non-randomized studies of interventions in Cochrane systematic reviews.',
    studyTypes: [
      'Cohort studies (the primary design ROBINS-I V2 is currently scoped for)',
      'Other follow-up designs that compare intervention groups without random assignment',
      'Non-randomized studies of interventions (NRSI) where confounding is the dominant source of bias',
    ],
    domainsIntro:
      'ROBINS-I V2 organises the assessment around six bias domains. For each domain, reviewers answer signalling questions that lead to a domain-level judgement, and the domain judgements are then combined into an overall risk-of-bias judgement for the result being assessed. The domain names below match the official ROBINS-I V2 instrument; for the actual signalling questions and detailed guidance, consult the official tool linked under Reference Documents.',
    domains: [
      {
        name: 'Bias due to confounding',
        shortDescription:
          'Considers whether differences in baseline characteristics between intervention groups, or in characteristics that change after the start of the intervention but are influenced by it, could distort the estimated effect. Confounding is typically the dominant source of bias in non-randomized studies and is the domain in which ROBINS-I V2 differs most from tools designed for randomized trials.',
      },
      {
        name: 'Bias arising from classification of intervention',
        shortDescription:
          'Considers whether participants were correctly classified into the intervention groups being compared. Misclassification can occur when intervention status is unclear, changes over time, or is recorded retrospectively from imperfect sources.',
      },
      {
        name: 'Bias in selection of participants into the study',
        shortDescription:
          'Considers whether the way participants were selected into the study, or into the analysis, could be related to both the intervention and the outcome. This includes prevalent-user bias and immortal-time bias, which V2 explicitly addresses with additional signalling questions across multiple domains.',
      },
      {
        name: 'Bias due to missing data',
        shortDescription:
          'Considers the extent of missing data on outcomes, interventions, and confounders, and whether the strategy used to handle missing data could distort the result.',
      },
      {
        name: 'Bias arising from measurement of the outcome',
        shortDescription:
          'Considers whether outcome measurement methods were appropriate, comparable across groups, and unlikely to be influenced by knowledge of the intervention received.',
      },
      {
        name: 'Bias in selection of the reported result',
        shortDescription:
          'Considers whether the reported effect estimate was selected from among multiple analyses of the same data on the basis of the result, including selective reporting of outcomes, populations, or analyses.',
      },
    ],
    versionHistory:
      'The original ROBINS-I tool was published in 2016 (Sterne et al., BMJ). ROBINS-I V2 was released in November 2024 as a substantive update. Notable structural changes from V1 include: (1) the number of bias domains was reduced from seven to six, with the V1 "deviations from intended intervention" domain removed and its concerns redistributed; (2) signalling questions now use "strong" and "weak" response options to better reflect graded judgements; (3) algorithms were added that map signalling question responses to suggested risk-of-bias judgements at the domain level; (4) a new triage section helps reviewers identify studies at critical risk of bias before completing the full assessment; (5) the specification of the effect of interest was refined; and (6) explicit signalling questions were added to address immortal-time bias across multiple domains. V2 is currently scoped specifically for follow-up (cohort) studies, with extensions to other non-randomized designs anticipated.',
    whenToUse:
      'Use ROBINS-I V2 when you are assessing risk of bias in an individual non-randomized cohort study of an intervention as part of a systematic review or evidence synthesis. The tool is most appropriate when the studies you are appraising have a follow-up design and when the comparison of interest is between intervention groups that were not randomly assigned. Each ROBINS-I V2 assessment should be performed for a specific result of interest (a particular outcome and effect estimate), not for the study as a whole. Reviewers should pre-specify the target trial that the study is attempting to emulate, and should make their judgements relative to that target trial rather than to an idealised observational study.',
    whenNotToUse:
      'ROBINS-I V2 is not appropriate for randomized trials, where RoB 2 should be used instead. It is also not the right tool for assessing reviews of exposures (rather than interventions); for those, ROBINS-E is in development. Do not use ROBINS-I V2 to assess case-control studies or case series without careful consideration; the tool is currently scoped to follow-up designs. If you are assessing the methodological quality of a systematic review (rather than the risk of bias of a primary study), use AMSTAR 2 instead.',
    comparisonWithAlternatives:
      'ROBINS-I V2 sits alongside two other Cochrane risk-of-bias tools: RoB 2 (for randomized trials) and ROBINS-E (for observational studies of exposures, currently in development). All three tools share a common structure of signalling questions feeding domain-level and overall judgements, but they differ in the specific bias domains they assess and the algorithms used to derive judgements. For systematic reviews that include both randomized and non-randomized studies of the same intervention, it is appropriate to apply RoB 2 to the trials and ROBINS-I V2 to the non-randomized studies, then synthesise the results with appropriate consideration of the differing risk-of-bias assessments.',
    scoringDescription:
      'In ROBINS-I V2, reviewers answer signalling questions for each of the six bias domains. Responses to the signalling questions are mapped, via the algorithms introduced in V2, to a judgement of risk of bias at the domain level. The domain-level judgements are then combined into an overall risk-of-bias judgement for the result being assessed. CoRATES supports this workflow by structuring the signalling questions, recording responses, surfacing the algorithm-suggested judgements, and capturing reviewer rationale at each step. CoRATES does not modify or replace the official scoring algorithms; reviewers retain the ability to override suggested judgements with documentation.',
    scoreLevels: [
      {
        name: 'Low risk of bias',
        description:
          'The study is comparable to a well-performed randomized trial with regard to this domain. Bias is unlikely to alter the results.',
        color: 'green',
      },
      {
        name: 'Moderate risk of bias',
        description:
          'The study is sound for a non-randomized study with regard to this domain but cannot be considered comparable to a well-performed randomized trial. There is some concern that the result may be biased.',
        color: 'yellow',
      },
      {
        name: 'Serious risk of bias',
        description:
          'The study has some important problems in this domain. There is a serious risk that the result is biased.',
        color: 'orange',
      },
      {
        name: 'Critical risk of bias',
        description:
          'The study is too problematic in this domain to provide any useful evidence. The result should not be used in any synthesis or considered further.',
        color: 'red',
      },
      {
        name: 'No information',
        description:
          'There is insufficient information available in the study report or supplementary materials to make a judgement about risk of bias for this domain.',
        color: 'gray',
      },
    ],
    workflowInCoRATES:
      'CoRATES presents ROBINS-I V2 as a structured digital workflow rather than a spreadsheet or PDF form. Each signalling question is rendered in context with its response options, reviewers can attach rationale and quotes from the source study to each judgement, and the domain-level and overall judgements are computed automatically from responses using the official algorithms. Multiple reviewers can complete independent assessments of the same study in parallel; CoRATES then surfaces the disagreements in a side-by-side reconciliation view so reviewers can resolve them before locking the assessment. Completed assessments can be exported as publication-ready risk-of-bias visual summaries.',
    commonPitfalls: [
      'Assessing the study as a whole rather than a specific result. ROBINS-I V2 is intended to be applied per result (per outcome and per effect estimate); applying it to the entire study can mask domain-specific risks that only affect particular outcomes.',
      'Failing to specify the target trial. Without an explicit hypothetical randomized trial that the study is trying to emulate, judgements about confounding and selection bias become subjective and inconsistent across reviewers.',
      'Confusing ROBINS-I V2 (interventions) with ROBINS-E (exposures). The two tools have different scopes and assumptions; using the wrong one will produce assessments that do not align with the published guidance.',
      'Treating "Critical" risk of bias as a default for any non-randomized study. Critical is reserved for studies whose results should not be used in synthesis at all; most non-randomized studies will fall into Moderate or Serious.',
      'Overriding the algorithm-suggested judgement without recording rationale. The V2 algorithms are an important consistency aid; deviations should be documented so reviewers (and readers of the eventual review) can audit the reasoning.',
      'Carrying over V1 habits, particularly the now-removed "deviations from intended intervention" domain. Reviewers familiar with the original ROBINS-I should re-orient to the V2 six-domain structure and the explicit immortal-time bias signalling questions.',
    ],
    faq: [
      {
        question: 'What does ROBINS-I stand for?',
        answer:
          'ROBINS-I is an acronym for "Risk Of Bias In Non-randomized Studies - of Interventions". The "V2" in ROBINS-I V2 indicates Version 2, the major revision released in November 2024.',
      },
      {
        question: 'How is ROBINS-I V2 different from the original ROBINS-I?',
        answer:
          'ROBINS-I V2 reduces the number of bias domains from seven to six (removing the "deviations from intended intervention" domain), introduces algorithms that map signalling-question responses to suggested risk-of-bias judgements, adds "strong" and "weak" response options for graded judgements, includes a new triage section for identifying studies at critical risk of bias, refines how the effect of interest is specified, and adds explicit signalling questions for immortal-time bias. V2 is also currently scoped specifically to follow-up (cohort) studies.',
      },
      {
        question: 'Should I use ROBINS-I V2 or RoB 2?',
        answer:
          'Use RoB 2 for randomized trials and ROBINS-I V2 for non-randomized cohort studies of interventions. If your systematic review includes both designs, apply each tool to the appropriate subset of studies and synthesise the results with awareness of the differing risk-of-bias structures.',
      },
      {
        question: 'Is ROBINS-I V2 the same as ROBINS-E?',
        answer:
          'No. ROBINS-I V2 assesses risk of bias in non-randomized studies of interventions. ROBINS-E (for Exposures) is a separate tool, currently in development, for non-randomized studies of exposures rather than interventions. The two tools have different scopes and should not be substituted for each other.',
      },
      {
        question: 'Can ROBINS-I V2 be applied to case-control studies?',
        answer:
          'ROBINS-I V2 is currently scoped to follow-up (cohort) study designs. Applying it to case-control studies or other non-cohort designs requires careful judgement and may not align fully with the published guidance. Future extensions of ROBINS-I to additional study designs are anticipated.',
      },
      {
        question: 'Where are the official ROBINS-I V2 signalling questions and guidance?',
        answer:
          'The official ROBINS-I V2 instrument, signalling questions, and guidance documents are hosted at riskofbias.info. CoRATES does not reproduce the official content; reviewers should consult the official sources alongside their assessments. See the Reference Documents section above for direct links.',
      },
      {
        question: 'Does CoRATES automatically score ROBINS-I V2 assessments?',
        answer:
          'CoRATES applies the V2 algorithms to map signalling-question responses to suggested domain-level and overall risk-of-bias judgements, and updates them in real time as reviewers answer questions. Reviewers can override suggested judgements with documented rationale. CoRATES does not modify the official scoring algorithms.',
      },
      {
        question: 'How does CoRATES support multi-reviewer ROBINS-I V2 assessment?',
        answer:
          'Multiple reviewers can complete independent ROBINS-I V2 assessments of the same study in parallel. CoRATES then presents a side-by-side reconciliation view that highlights disagreements at the signalling-question, domain, and overall-judgement level, so reviewers can discuss and resolve them before locking the assessment.',
      },
    ],
    referenceLinks: [
      {
        href: 'https://www.riskofbias.info/welcome/robins-i-v2',
        text: 'ROBINS-I V2 official tool and guidance (riskofbias.info)',
      },
      {
        href: 'https://methods.cochrane.org/bias/risk-bias-non-randomized-studies-interventions',
        text: 'Cochrane Bias Methods Group: ROBINS-I overview',
      },
      {
        href: 'https://www.bmj.com/content/355/bmj.i4919',
        text: 'Sterne et al. (2016): Original ROBINS-I publication, BMJ',
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
    ],
  },

  rob2: {
    id: 'rob2',
    name: 'RoB 2',
    slug: 'rob2',
    fullName: 'Cochrane Risk of Bias tool for randomized trials, version 2',
    developedBy:
      'Members of the RoB 2 Development Group, including Julian P.T. Higgins, Jelena Savovic, Matthew J. Page, Roy G. Elbers, and Jonathan A.C. Sterne, with contributions from many additional collaborators across the Cochrane Bias Methods Group. The tool was published in the BMJ in 2019 (Sterne et al., BMJ 2019;366:l4898).',
    versionNote:
      'RoB 2 was published in August 2019 as a substantive replacement for the original Cochrane Risk of Bias tool (2008). The current parallel-trial version on riskofbias.info is dated 22 August 2019. Cochrane has formally adopted RoB 2 as the recommended tool for assessing risk of bias in randomized trials included in Cochrane Reviews.',
    description:
      'RoB 2 is the revised Cochrane Risk of Bias tool for randomized trials. It assesses risk of bias in the result of an individual randomized trial across five bias domains, using a structured set of signalling questions whose responses are mapped via published algorithms to a domain-level judgement of Low risk of bias, Some concerns, or High risk of bias. The domain-level judgements are then combined into an overall risk-of-bias judgement for the result being assessed. RoB 2 is the recommended tool for randomized trials in Cochrane systematic reviews and is widely used in non-Cochrane reviews and methods research as well.',
    bestUsedFor:
      'Assessing risk of bias in the results of individual randomized controlled trials (RCTs) included in a systematic review or evidence synthesis. RoB 2 is the recommended risk-of-bias tool for randomized trials in Cochrane Reviews.',
    studyTypes: [
      'Parallel-group randomized controlled trials (the primary version of RoB 2)',
      'Cluster-randomized trials (handled by the dedicated RoB 2 cluster-randomized extension)',
      'Crossover trials (handled by the dedicated RoB 2 crossover extension)',
    ],
    domainsIntro:
      'RoB 2 organises the assessment around five bias domains for parallel-group randomized trials. For each domain, reviewers answer signalling questions whose responses are mapped, via published algorithms, to a domain-level judgement of Low risk of bias, Some concerns, or High risk of bias. The five parallel-group domains are listed below. Cluster-randomized and crossover extensions add additional domains specific to those designs; consult the official documentation linked under Reference Documents for the extension-specific signalling questions and guidance.',
    domains: [
      {
        name: 'Bias arising from the randomization process',
        shortDescription:
          'Considers whether the allocation sequence was adequately random and concealed until participants were enrolled and assigned to interventions, and whether the baseline characteristics of the groups suggest a problem with the randomization process.',
      },
      {
        name: 'Bias due to deviations from intended interventions',
        shortDescription:
          'Considers whether participants and trial personnel were aware of the assigned intervention, whether deviations from the intended intervention occurred and were balanced between groups, and whether the appropriate analysis was used to estimate the effect of assignment to or adherence to the intervention. RoB 2 explicitly distinguishes between the effect of assignment and the effect of adhering to the intervention.',
      },
      {
        name: 'Bias due to missing outcome data',
        shortDescription:
          'Considers the proportion of participants with missing outcome data, whether missingness was likely to depend on the true value of the outcome, and whether the missing data could plausibly have biased the result of the trial.',
      },
      {
        name: 'Bias in measurement of the outcome',
        shortDescription:
          'Considers whether the outcome measurement methods were appropriate, comparable across intervention groups, and unlikely to be influenced by knowledge of the intervention received. The signalling questions distinguish subjective and objective outcomes because the former are more vulnerable to detection bias.',
      },
      {
        name: 'Bias in selection of the reported result',
        shortDescription:
          'Considers whether the reported effect estimate was selected, on the basis of the result, from among multiple eligible outcome measurements or analyses of the data. This domain captures selective non-reporting and outcome switching.',
      },
    ],
    versionHistory:
      'The original Cochrane Risk of Bias tool was introduced in version 5 of the Cochrane Handbook in 2008 (Higgins et al.) and was updated in 2011. RoB 2 (Sterne et al., BMJ 2019) is a substantive replacement rather than a minor revision. Notable structural changes from the original tool include: (1) the assessment is now structured around fixed bias domains with explicit signalling questions, rather than free-form judgements; (2) algorithms map signalling-question responses to suggested domain-level risk-of-bias judgements; (3) the intermediate "Some concerns" judgement was added between Low and High; (4) RoB 2 is applied per result (per outcome and analysis), not once per trial; (5) the tool explicitly distinguishes the effect of assignment from the effect of adhering to the intervention; and (6) the deviations and missing outcome data domains were substantially expanded. Extensions of RoB 2 for cluster-randomized trials and crossover trials are available and add design-specific domains.',
    whenToUse:
      'Use RoB 2 when you are assessing risk of bias in individual randomized trials as part of a systematic review or evidence synthesis. Each RoB 2 assessment should be performed for a specific result of interest (a particular outcome and effect estimate at a specific time point), not for the trial as a whole. Reviewers should pre-specify whether they are assessing the effect of assignment to the intervention or the effect of adhering to the intervention, because the signalling questions and algorithms differ. For Cochrane systematic reviews of randomized trials, RoB 2 is the recommended tool. For non-Cochrane reviews, RoB 2 is also widely used and is generally preferred over the original Cochrane RoB tool.',
    whenNotToUse:
      'RoB 2 is not designed for non-randomized studies of interventions; for those, use ROBINS-I V2. It is also not the right tool for assessing the methodological quality of a systematic review (use AMSTAR 2 for that), for diagnostic test accuracy studies, or for prognostic factor studies. The parallel-group version of RoB 2 should not be applied to cluster-randomized or crossover trials without using the corresponding extensions, because those designs introduce additional bias domains that the parallel-group version does not assess.',
    comparisonWithAlternatives:
      'RoB 2 sits alongside two other Cochrane risk-of-bias tools: ROBINS-I V2 (for non-randomized studies of interventions) and ROBINS-E (for non-randomized studies of exposures, currently in development). All three tools share a common structure of signalling questions feeding domain-level and overall judgements, but they differ in the specific bias domains they assess and the algorithms used to derive judgements. For systematic reviews that include both randomized and non-randomized studies of the same intervention, it is appropriate to apply RoB 2 to the trials and ROBINS-I V2 to the non-randomized studies, then synthesise the results with appropriate consideration of the differing risk-of-bias structures. RoB 2 replaces the original 2008 Cochrane RoB tool, which is now considered outdated; new Cochrane Reviews are expected to use RoB 2 unless there is a strong reason to use the older tool.',
    scoringDescription:
      'In RoB 2, reviewers answer signalling questions for each of the five bias domains. Responses to the signalling questions are mapped, via the algorithms published with the tool, to a judgement of Low risk of bias, Some concerns, or High risk of bias at the domain level. The domain-level judgements are then combined into an overall risk-of-bias judgement for the result being assessed. CoRATES supports this workflow by structuring the signalling questions, recording responses, surfacing the algorithm-suggested judgements in real time, and capturing reviewer rationale at each step. CoRATES does not modify or replace the official algorithms; reviewers retain the ability to override suggested judgements with documentation.',
    scoreLevels: [
      {
        name: 'Low risk of bias',
        description:
          'The trial is judged to be at low risk of bias for this domain. Any departures from the intended approach are not expected to materially affect the result.',
        color: 'green',
      },
      {
        name: 'Some concerns',
        description:
          'The trial is judged to raise some concerns for this domain. The result may be affected by bias, but the available information does not support a judgement of high risk of bias.',
        color: 'yellow',
      },
      {
        name: 'High risk of bias',
        description:
          'The trial is judged to be at high risk of bias for this domain. There is reason to believe that the result is biased and the magnitude or direction of the bias may be substantial.',
        color: 'red',
      },
      {
        name: 'No information',
        description:
          'There is insufficient information available in the trial report or supplementary materials to make a judgement about risk of bias for this domain.',
        color: 'gray',
      },
    ],
    workflowInCoRATES:
      'CoRATES presents RoB 2 as a structured digital workflow rather than a spreadsheet or PDF form. Each signalling question is rendered in context with its response options, reviewers can attach rationale and direct quotes from the trial report to each judgement, and the domain-level and overall judgements are computed automatically from responses using the official algorithms. Multiple reviewers can complete independent assessments of the same trial result in parallel; CoRATES then surfaces the disagreements in a side-by-side reconciliation view so reviewers can resolve them before locking the assessment. Completed assessments can be exported as publication-ready risk-of-bias visual summaries (traffic-light plots and weighted bar plots).',
    commonPitfalls: [
      'Assessing the trial as a whole rather than a specific result. RoB 2 is intended to be applied per result (per outcome and analysis); applying it once to the entire trial can mask domain-specific risks that only affect particular outcomes.',
      'Failing to specify whether you are assessing the effect of assignment or the effect of adhering to the intervention. The signalling questions and algorithms differ between the two, and conflating them produces ambiguous judgements.',
      'Using parallel-group RoB 2 on cluster-randomized or crossover trials. Each of these designs has its own RoB 2 extension that adds domains specific to the design; the parallel-group version omits those design-specific bias sources.',
      'Confusing RoB 2 with the original 2008 Cochrane RoB tool. The two tools produce different judgements and have different domain structures; reviews using the older tool should not be combined with RoB 2 assessments without explicit acknowledgement of the difference.',
      'Treating "Some concerns" as a default for ambiguous cases. "Some concerns" should be a substantive judgement, not a way to avoid choosing between Low and High when the available information would actually support a definitive judgement.',
      'Overriding the algorithm-suggested judgement without recording rationale. The algorithms are an important consistency aid; deviations should be documented so reviewers and downstream readers can audit the reasoning.',
      'Single-reviewer assessment. Like all risk-of-bias appraisals, RoB 2 should be carried out by at least two independent reviewers with disagreements resolved through discussion or arbitration.',
    ],
    faq: [
      {
        question: 'What does RoB 2 stand for?',
        answer:
          'RoB 2 stands for Risk of Bias 2, the second version of the Cochrane Risk of Bias tool for randomized trials. The "2" distinguishes it from the original 2008 Cochrane Risk of Bias tool, which RoB 2 replaces.',
      },
      {
        question: 'How is RoB 2 different from the original Cochrane Risk of Bias tool?',
        answer:
          'RoB 2 introduced a fixed set of bias domains with structured signalling questions, replacing the more free-form judgements of the original tool. It added algorithms that map signalling-question responses to suggested domain-level judgements, introduced the intermediate "Some concerns" rating between Low and High, applies the assessment per result (per outcome and analysis) rather than once per trial, and explicitly distinguishes between the effect of assignment to the intervention and the effect of adhering to the intervention. The domains for deviations from intended interventions and missing outcome data were also substantially expanded.',
      },
      {
        question: 'How many domains does RoB 2 assess?',
        answer:
          'The parallel-group version of RoB 2 assesses five bias domains: bias arising from the randomization process, bias due to deviations from intended interventions, bias due to missing outcome data, bias in measurement of the outcome, and bias in selection of the reported result. The cluster-randomized and crossover extensions of RoB 2 add additional domains specific to those designs.',
      },
      {
        question: 'Should I use RoB 2 or ROBINS-I V2?',
        answer:
          'Use RoB 2 for randomized trials and ROBINS-I V2 for non-randomized cohort studies of interventions. If your systematic review includes both designs, apply each tool to the appropriate subset of studies and synthesise the results with awareness of the differing risk-of-bias structures.',
      },
      {
        question: 'Is RoB 2 the recommended tool for randomized trials in Cochrane Reviews?',
        answer:
          'Yes. Cochrane has formally adopted RoB 2 as the recommended tool for assessing risk of bias in randomized trials included in Cochrane Reviews. Reviews still using the original 2008 tool are gradually being updated to RoB 2.',
      },
      {
        question: 'Are there extensions of RoB 2 for other trial designs?',
        answer:
          'Yes. There are dedicated RoB 2 extensions for cluster-randomized trials and crossover trials, both of which add design-specific bias domains beyond the five domains of the parallel-group version. The extensions are hosted alongside the main tool at riskofbias.info.',
      },
      {
        question: 'Does CoRATES automatically score RoB 2 assessments?',
        answer:
          'CoRATES applies the published RoB 2 algorithms to map signalling-question responses to suggested domain-level and overall risk-of-bias judgements, and updates them in real time as reviewers answer questions. Reviewers can override suggested judgements with documented rationale. CoRATES does not modify the official scoring algorithms.',
      },
      {
        question: 'Where are the official RoB 2 signalling questions and guidance?',
        answer:
          'The official RoB 2 instrument, signalling questions, and guidance documents are hosted at riskofbias.info, and the original publication is freely available in the BMJ (Sterne et al., BMJ 2019;366:l4898). CoRATES does not reproduce the official content; reviewers should consult the official sources alongside their assessments. See Reference Documents above for direct links.',
      },
    ],
    referenceLinks: [
      {
        href: 'https://www.riskofbias.info/welcome/rob-2-0-tool/current-version-of-rob-2',
        text: 'RoB 2 official tool and templates (riskofbias.info)',
      },
      {
        href: 'https://methods.cochrane.org/bias/resources/rob-2-revised-cochrane-risk-bias-tool-randomized-trials',
        text: 'Cochrane Bias Methods Group: RoB 2 overview',
      },
      {
        href: 'https://www.bmj.com/content/366/bmj.l4898',
        text: 'Sterne et al. (2019): RoB 2 publication, BMJ',
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
        authors: 'Higgins JPT, Altman DG, Gotzsche PC, et al.',
        year: '2011',
        title: "The Cochrane Collaboration's tool for assessing risk of bias in randomised trials",
        source: 'BMJ 2011;343:d5928',
        url: 'https://www.bmj.com/content/343/bmj.d5928',
      },
    ],
  },
};

export function getToolBySlug(slug: string): ToolContent | null {
  return getAllTools().find(tool => tool.slug === slug) || null;
}

export function getAllTools(): ToolContent[] {
  return Object.values(TOOL_CONTENT);
}
