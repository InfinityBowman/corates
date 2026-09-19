/**
 * RoB 2 reliability adapter: turns two reviewer checklists into rating pairs.
 */

import {
  ROB2_CHECKLIST,
  JUDGEMENTS,
  getActiveDomainKeys,
  getDomainQuestions,
} from '../rob2/schema.js';
import { scoreRob2Domain, scoreAllDomains, type ChecklistState } from '../rob2/scoring.js';
import { getSkippedDomainQuestions, isEffectivelyNotApplicable } from '../rob2/skipped.js';
import type { ROB2Checklist, ROB2DomainState } from '../types.js';
import { NOT_APPLICABLE, type ItemDefinition, type RatingPair } from './stats.js';
import type { ToolPairs, ToolReliabilityDefinition } from './types.js';

type Checklist = Partial<ROB2Checklist>;

export const ROB2_JUDGEMENT_SCALE = [JUDGEMENTS.LOW, JUDGEMENTS.SOME_CONCERNS, JUDGEMENTS.HIGH];

// Both domain 2 variants land on the same row so the breakdown is per domain, not per aim.
const ITEM_KEY: Record<string, string> = {
  domain1: 'domain1',
  domain2a: 'domain2',
  domain2b: 'domain2',
  domain3: 'domain3',
  domain4: 'domain4',
  domain5: 'domain5',
};

const DOMAIN_ITEMS: ItemDefinition[] = [
  { key: 'domain1', label: 'D1', title: ROB2_CHECKLIST.domain1.name },
  { key: 'domain2', label: 'D2', title: ROB2_CHECKLIST.domain2a.name },
  { key: 'domain3', label: 'D3', title: ROB2_CHECKLIST.domain3.name },
  { key: 'domain4', label: 'D4', title: ROB2_CHECKLIST.domain4.name },
  { key: 'domain5', label: 'D5', title: ROB2_CHECKLIST.domain5.name },
];

function normalizeAnswer(
  questionKey: string,
  answer: string | null | undefined,
  skipped: Set<string>,
): string | null {
  if (isEffectivelyNotApplicable(questionKey, answer, skipped)) return NOT_APPLICABLE;
  return answer ?? null;
}

export function extractRob2Pairs(a: Checklist, b: Checklist): ToolPairs {
  const activeA = getActiveDomainKeys(a.preliminary?.aim === 'ADHERING');
  const activeB = getActiveDomainKeys(b.preliminary?.aim === 'ADHERING');
  // A domain assessed under different aims is a different set of questions, so
  // it is only comparable when both reviewers chose the same aim.
  const shared = activeA.filter(key => activeB.includes(key));

  const judgements: RatingPair[] = [];
  const questions: RatingPair[] = [];

  for (const domainKey of shared) {
    const domainA = a[domainKey] as ROB2DomainState | undefined;
    const domainB = b[domainKey] as ROB2DomainState | undefined;

    judgements.push({
      item: ITEM_KEY[domainKey],
      a: scoreRob2Domain(domainKey, domainA?.answers).judgement,
      b: scoreRob2Domain(domainKey, domainB?.answers).judgement,
    });

    const skippedA = getSkippedDomainQuestions(domainKey, domainA?.answers);
    const skippedB = getSkippedDomainQuestions(domainKey, domainB?.answers);
    for (const qKey of Object.keys(getDomainQuestions(domainKey))) {
      questions.push({
        item: qKey,
        a: normalizeAnswer(qKey, domainA?.answers?.[qKey]?.answer, skippedA),
        b: normalizeAnswer(qKey, domainB?.answers?.[qKey]?.answer, skippedB),
      });
    }
  }

  const overall: RatingPair[] = [
    {
      item: 'overall',
      a: scoreAllDomains(a as ChecklistState).overall,
      b: scoreAllDomains(b as ChecklistState).overall,
    },
  ];

  return { judgements, overall, questions };
}

export const ROB2_RELIABILITY: ToolReliabilityDefinition = {
  type: 'ROB2',
  label: 'RoB 2',
  unit: 'outcome',
  judgementLabel: 'Domain judgements',
  judgementScale: ROB2_JUDGEMENT_SCALE,
  overallScale: ROB2_JUDGEMENT_SCALE,
  items: DOMAIN_ITEMS,
  hasQuestions: true,
  notes: [
    'Domain judgements come from the RoB 2 algorithm applied to the signaling answers, as the checklist shows them.',
    'Domain 2 is compared only when both reviewers assessed the same effect (assignment or adhering).',
    'The overall judgement follows from the domains, so it is compared separately.',
  ],
  extractPairs: (a, b) => extractRob2Pairs(a as Checklist, b as Checklist),
};
