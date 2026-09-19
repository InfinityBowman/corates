/**
 * AMSTAR 2 reliability adapter: turns two reviewer checklists into rating pairs.
 *
 * AMSTAR 2 has no domains, so its items are the judgements. The sub-criteria
 * checkboxes are working notes and are not compared.
 */

import { AMSTAR_CHECKLIST, AMSTAR2_DATA_KEYS } from '../amstar2/schema.js';
import { getSelectedAnswer } from '../amstar2/answers.js';
import { scoreAMSTAR2Checklist, isAMSTAR2Complete } from '../amstar2/score.js';
import type { AMSTAR2Checklist, AMSTAR2Question } from '../types.js';
import { NOT_APPLICABLE, type ItemDefinition, type RatingPair } from './stats.js';
import type { ToolPairs, ToolReliabilityDefinition } from './types.js';

type Checklist = Partial<AMSTAR2Checklist>;

export const AMSTAR2_ITEM_SCALE = ['Yes', 'Partial Yes', 'No'];
export const AMSTAR2_OVERALL_SCALE = ['High', 'Moderate', 'Low', 'Critically Low'];

function itemDefinition(dataKey: string): ItemDefinition {
  const questionKey = dataKey.replace(/[ab]$/, '');
  const schema = AMSTAR_CHECKLIST[questionKey];
  const part =
    dataKey.endsWith('a') ? schema?.subtitle
    : dataKey.endsWith('b') ? schema?.subtitle2
    : null;
  const number = questionKey.slice(1);
  return {
    key: dataKey,
    label: part ? `Q${number} ${part}` : `Q${number}`,
    title: schema?.text ?? dataKey,
  };
}

const ITEMS: ItemDefinition[] = AMSTAR2_DATA_KEYS.map(itemDefinition);

function itemAnswer(checklist: Checklist, dataKey: string): string | null {
  const question = checklist[dataKey as keyof AMSTAR2Checklist] as AMSTAR2Question | undefined;
  if (!question || !Array.isArray(question.answers)) return null;
  const selected = getSelectedAnswer(question.answers, dataKey);
  // "No MA" also stands in for "Includes only NRSI/RCTs" on Q9 and Q11.
  if (selected === 'No MA') return NOT_APPLICABLE;
  return selected;
}

function overallRating(checklist: Checklist): string | null {
  const full = checklist as AMSTAR2Checklist;
  if (!isAMSTAR2Complete(full)) return null;
  const score = scoreAMSTAR2Checklist(full);
  return score === 'Error' ? null : score;
}

export function extractAmstar2Pairs(a: Checklist, b: Checklist): ToolPairs {
  const judgements: RatingPair[] = AMSTAR2_DATA_KEYS.map(dataKey => ({
    item: dataKey,
    a: itemAnswer(a, dataKey),
    b: itemAnswer(b, dataKey),
  }));
  const overall: RatingPair[] = [{ item: 'overall', a: overallRating(a), b: overallRating(b) }];
  return { judgements, overall, questions: [] };
}

export const AMSTAR2_RELIABILITY: ToolReliabilityDefinition = {
  type: 'AMSTAR2',
  label: 'AMSTAR 2',
  unit: 'study',
  judgementLabel: 'Item answers',
  judgementScale: AMSTAR2_ITEM_SCALE,
  overallScale: AMSTAR2_OVERALL_SCALE,
  items: ITEMS,
  hasQuestions: false,
  notes: [
    '18 items compared on their final answer (Q9 and Q11 have RCT and NRSI parts). Sub-criteria checkboxes are not compared.',
    'Yes/No-only items sit on the same scale, so Yes against No is a full disagreement.',
    'The overall confidence rating follows from the items, so it is compared on its own scale.',
  ],
  extractPairs: (a, b) => extractAmstar2Pairs(a as Checklist, b as Checklist),
};
