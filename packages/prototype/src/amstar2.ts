export interface AMSTAR2Column {
  label: string;
  description?: string;
  options: string[];
  optional?: boolean;
}

export interface AMSTAR2Section {
  key: string;
  label: string;
  columns: AMSTAR2Column[];
}

export interface AMSTAR2QuestionSchema {
  text: string;
  critical: boolean;
  columns?: AMSTAR2Column[];
  sections?: AMSTAR2Section[];
}

export const AMSTAR2_SCHEMA: Record<string, AMSTAR2QuestionSchema> = {
  q1: {
    text: '1. Did the research questions and inclusion criteria for the review include the components of PICO?',
    critical: false,
    columns: [
      { label: 'For Yes:', options: ['Population', 'Intervention', 'Comparator group', 'Outcome'] },
      { label: 'Optional (recommended):', options: ['Timeframe for follow-up'], optional: true },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
  q2: {
    text: '2. Did the report of the review contain an explicit statement that the review methods were established prior to the conduct of the review?',
    critical: true,
    columns: [
      { label: 'For Partial Yes:', options: ['review question(s)', 'a search strategy', 'inclusion/exclusion criteria', 'risk of bias assessment'] },
      { label: 'For Yes:', options: ['a meta-analysis/synthesis plan, if appropriate', 'a plan for investigating causes of heterogeneity', 'justification for any deviations from the protocol'] },
      { label: '', options: ['Yes', 'Partial Yes', 'No'] },
    ],
  },
  q3: {
    text: '3. Did the review authors explain their selection of the study designs for inclusion in the review?',
    critical: false,
    columns: [
      { label: 'For Yes, the review should satisfy ONE of the following:', options: ['Explanation for including only RCTs', 'OR Explanation for including only NRSI', 'OR Explanation for including both RCTs and NRSI'] },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
  q4: {
    text: '4. Did the review authors use a comprehensive literature search strategy?',
    critical: true,
    columns: [
      { label: 'For Partial Yes (all the following):', options: ['searched at least 2 databases', 'provided key word and/or search strategy', 'justified publication restrictions'] },
      { label: 'For Yes, should also have (all the following):', options: ['searched reference lists of included studies', 'searched trial/study registries', 'included/consulted content experts', 'searched for grey literature', 'conducted search within 24 months of completion'] },
      { label: '', options: ['Yes', 'Partial Yes', 'No'] },
    ],
  },
  q5: {
    text: '5. Did the review authors perform study selection in duplicate?',
    critical: false,
    columns: [
      { label: 'For Yes, either ONE of the following:', options: ['at least two reviewers independently agreed on selection', 'OR two reviewers selected from a sample and achieved good agreement (>=80%)'] },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
  q6: {
    text: '6. Did the review authors perform data extraction in duplicate?',
    critical: false,
    columns: [
      { label: 'For Yes, either ONE of the following:', options: ['at least two reviewers achieved consensus on data extraction', 'OR two reviewers extracted from a sample and achieved good agreement (>=80%)'] },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
  q7: {
    text: '7. Did the review authors provide a list of excluded studies and justify the exclusions?',
    critical: true,
    columns: [
      { label: 'For Partial Yes:', options: ['provided a list of all potentially relevant studies read in full-text but excluded'] },
      { label: 'For Yes, must also have:', options: ['justified the exclusion of each potentially relevant study'] },
      { label: '', options: ['Yes', 'Partial Yes', 'No'] },
    ],
  },
  q8: {
    text: '8. Did the review authors describe the included studies in adequate detail?',
    critical: false,
    columns: [
      { label: 'For Partial Yes (ALL the following):', options: ['described populations', 'described interventions', 'described comparators', 'described outcomes', 'described research designs'] },
      { label: 'For Yes, should also have ALL the following:', options: ['described population in detail', 'described intervention in detail', 'described comparator in detail', "described study's setting", 'timeframe for follow-up'] },
      { label: '', options: ['Yes', 'Partial Yes', 'No'] },
    ],
  },
  q9: {
    text: '9. Did the review authors use a satisfactory technique for assessing the risk of bias (RoB)?',
    critical: true,
    sections: [
      {
        key: 'rct',
        label: 'RCTs',
        columns: [
          { label: 'For Partial Yes, must have assessed RoB from:', options: ['unconcealed allocation', 'lack of blinding of patients and assessors'] },
          { label: 'For Yes, must also have assessed RoB from:', options: ['allocation sequence not truly random', 'selection of reported result from multiple analyses'] },
          { label: '', options: ['Yes', 'Partial Yes', 'No', 'Includes only NRSI'] },
        ],
      },
      {
        key: 'nrsi',
        label: 'NRSI',
        columns: [
          { label: 'For Partial Yes, must have assessed RoB:', options: ['from confounding', 'from selection bias'] },
          { label: 'For Yes, must also have assessed RoB:', options: ['methods used to ascertain exposures and outcomes', 'selection of reported result from multiple analyses'] },
          { label: '', options: ['Yes', 'Partial Yes', 'No', 'Includes only RCTs'] },
        ],
      },
    ],
  },
  q10: {
    text: '10. Did the review authors report on the sources of funding for the studies included in the review?',
    critical: false,
    columns: [
      { label: 'For Yes:', options: ['reported on the sources of funding for individual studies'] },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
  q11: {
    text: '11. If meta-analysis was performed did the review authors use appropriate methods for statistical combination of results?',
    critical: true,
    sections: [
      {
        key: 'rct',
        label: 'RCTs',
        columns: [
          { label: 'For Yes:', options: ['justified combining the data in a meta-analysis', 'used appropriate weighted technique and adjusted for heterogeneity', 'investigated the causes of any heterogeneity'] },
          { label: '', options: ['Yes', 'No', 'No meta-analysis conducted'] },
        ],
      },
      {
        key: 'nrsi',
        label: 'NRSI',
        columns: [
          { label: 'For Yes:', options: ['justified combining the data', 'used appropriate weighted technique, adjusting for heterogeneity', 'combined adjusted effect estimates from NRSI', 'reported separate summary estimates for RCTs and NRSI'] },
          { label: '', options: ['Yes', 'No', 'No meta-analysis conducted'] },
        ],
      },
    ],
  },
  q12: {
    text: '12. If meta-analysis was performed, did the review authors assess the potential impact of RoB on the results?',
    critical: false,
    columns: [
      { label: 'For Yes:', options: ['included only low risk of bias RCTs', 'OR performed analyses to investigate possible impact of RoB on summary estimates'] },
      { label: '', options: ['Yes', 'No', 'No meta-analysis conducted'] },
    ],
  },
  q13: {
    text: '13. Did the review authors account for RoB in individual studies when interpreting/discussing the results?',
    critical: true,
    columns: [
      { label: 'For Yes:', options: ['included only low risk of bias RCTs', 'OR discussed the likely impact of RoB on the results'] },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
  q14: {
    text: '14. Did the review authors provide a satisfactory explanation for, and discussion of, any heterogeneity observed?',
    critical: false,
    columns: [
      { label: 'For Yes:', options: ['there was no significant heterogeneity', 'OR investigated sources and discussed the impact'] },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
  q15: {
    text: '15. If they performed quantitative synthesis did the review authors carry out an adequate investigation of publication bias?',
    critical: true,
    columns: [
      { label: 'For Yes:', options: ['performed graphical or statistical tests for publication bias and discussed the impact'] },
      { label: '', options: ['Yes', 'No', 'No meta-analysis conducted'] },
    ],
  },
  q16: {
    text: '16. Did the review authors report any potential sources of conflict of interest, including any funding they received?',
    critical: false,
    columns: [
      { label: 'For Yes:', options: ['reported no competing interests OR described funding sources and managed potential conflicts'] },
      { label: '', options: ['Yes', 'No'] },
    ],
  },
};

export const AMSTAR2_QUESTION_KEYS = Object.keys(AMSTAR2_SCHEMA);

const NOT_APPLICABLE = new Set([
  'No MA',
  'No meta-analysis conducted',
  'Includes only NRSI',
  'Includes only RCTs',
]);

function isNotApplicable(verdict: string | null): boolean {
  return verdict !== null && NOT_APPLICABLE.has(verdict);
}

export type Verdict = 'Yes' | 'Partial Yes' | 'No' | 'No MA' | null;

export type AMSTAR2Score = 'High' | 'Moderate' | 'Low' | 'Critically Low' | 'Incomplete';

const SCORE_COLORS: Record<AMSTAR2Score, string> = {
  High: '#16a34a',
  Moderate: '#ca8a04',
  Low: '#ea580c',
  'Critically Low': '#dc2626',
  Incomplete: '#94a3b8',
};

export function getScoreColor(score: AMSTAR2Score): string {
  return SCORE_COLORS[score];
}

export function cbKey(questionKey: string, colIdx: number, optIdx: number, section?: string): string {
  const sectionPart = section ? `.${section}` : '';
  return `${questionKey}${sectionPart}.c${colIdx}_${optIdx}`;
}

export function verdictKey(questionKey: string, section?: string): string {
  const sectionPart = section ? `.${section}` : '';
  return `${questionKey}${sectionPart}.verdict`;
}

export function noteKey(questionKey: string): string {
  return `${questionKey}.note`;
}

export function consolidateSectionVerdicts(
  a: string | null,
  b: string | null,
): string | null {
  if (isNotApplicable(a) && isNotApplicable(b)) return a;
  if (isNotApplicable(a)) return b;
  if (isNotApplicable(b)) return a;
  if (a === null || b === null) return null;
  if (a === 'No' || b === 'No') return 'No';
  if (a === 'Partial Yes' || b === 'Partial Yes') return 'Partial Yes';
  return 'Yes';
}

export function scoreAMSTAR2(
  getVerdict: (key: string) => string | null,
): AMSTAR2Score {
  let criticalFlaws = 0;
  let nonCriticalFlaws = 0;

  for (const key of AMSTAR2_QUESTION_KEYS) {
    const schema = AMSTAR2_SCHEMA[key];
    const verdict = getVerdict(key);
    if (verdict === null) return 'Incomplete';
    if (isNotApplicable(verdict)) continue;

    if (verdict === 'No') {
      if (schema.critical) criticalFlaws++;
      else nonCriticalFlaws++;
    }
  }

  if (criticalFlaws > 1) return 'Critically Low';
  if (criticalFlaws === 1) return 'Low';
  if (nonCriticalFlaws > 1) return 'Moderate';
  return 'High';
}

export function deriveVerdict(
  columns: AMSTAR2Column[],
  getCheckbox: (colIdx: number, optIdx: number) => boolean,
): Verdict {
  const cbCols = columns.slice(0, -1);
  const verdictOptions = columns[columns.length - 1].options;

  const required = cbCols
    .map((col, idx) => ({ col, idx }))
    .filter(({ col }) => !col.optional);

  if (required.length === 0) return null;

  const allChecked = (colIdx: number) =>
    cbCols[colIdx].options.every((_, optIdx) => getCheckbox(colIdx, optIdx));
  const anyChecked = (colIdx: number) =>
    cbCols[colIdx].options.some((_, optIdx) => getCheckbox(colIdx, optIdx));

  const anyActivity = required.some(({ idx }) => anyChecked(idx)) ||
    cbCols.some((col, idx) => col.optional && anyChecked(idx));

  const hasPartialYes = verdictOptions.includes('Partial Yes');

  if (hasPartialYes && required.length === 2) {
    if (allChecked(required[0].idx) && allChecked(required[1].idx)) return 'Yes';
    if (allChecked(required[0].idx)) return 'Partial Yes';
    if (anyActivity) return 'No';
    return null;
  }

  if (required.length === 1) {
    if (allChecked(required[0].idx)) return 'Yes';
    if (anyActivity) return 'No';
    return null;
  }

  if (required.length === 2) {
    if (allChecked(required[0].idx) && allChecked(required[1].idx)) return 'Yes';
    if (anyActivity) return 'No';
    return null;
  }

  return null;
}
