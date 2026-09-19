/**
 * ROBINS-I reliability adapter: turns two reviewer checklists into rating pairs.
 */

import { ROBINS_I_CHECKLIST, getActiveDomainKeys, getDomainQuestions } from '../robins-i/schema.js';
import { JUDGEMENTS, scoreRobinsDomain, scoreAllDomains } from '../robins-i/scoring.js';
import {
  getSkippedQuestions,
  isEffectivelyNotApplicable,
  isSectionBCritical,
} from '../robins-i/skipped.js';
import type { ROBINSIChecklist, ROBINSIDomainState } from '../types.js';
import { NOT_APPLICABLE, type ItemDefinition, type RatingPair } from './stats.js';
import type { ToolPairs, ToolReliabilityDefinition } from './types.js';

type Checklist = Partial<ROBINSIChecklist>;

export const ROBINS_I_JUDGEMENT_SCALE = [
  JUDGEMENTS.LOW,
  JUDGEMENTS.LOW_EXCEPT_CONFOUNDING,
  JUDGEMENTS.MODERATE,
  JUDGEMENTS.SERIOUS,
  JUDGEMENTS.CRITICAL,
];

// Both domain 1 variants land on the same row so the breakdown is per domain, not per effect.
const ITEM_KEY: Record<string, string> = {
  domain1a: 'domain1',
  domain1b: 'domain1',
  domain2: 'domain2',
  domain3: 'domain3',
  domain4: 'domain4',
  domain5: 'domain5',
  domain6: 'domain6',
};

const DOMAIN_ITEMS: ItemDefinition[] = [
  { key: 'domain1', label: 'D1', title: ROBINS_I_CHECKLIST.domain1a.name },
  { key: 'domain2', label: 'D2', title: ROBINS_I_CHECKLIST.domain2.name },
  { key: 'domain3', label: 'D3', title: ROBINS_I_CHECKLIST.domain3.name },
  { key: 'domain4', label: 'D4', title: ROBINS_I_CHECKLIST.domain4.name },
  { key: 'domain5', label: 'D5', title: ROBINS_I_CHECKLIST.domain5.name },
  { key: 'domain6', label: 'D6', title: ROBINS_I_CHECKLIST.domain6.name },
];

type ScoringState = Parameters<typeof scoreAllDomains>[0];
type SectionBState = Parameters<typeof isSectionBCritical>[0];

function overallJudgement(checklist: Checklist): string | null {
  if (isSectionBCritical(checklist.sectionB as SectionBState)) return JUDGEMENTS.CRITICAL;
  return scoreAllDomains(checklist as ScoringState).overall;
}

function normalizeAnswer(
  questionKey: string,
  answer: string | null | undefined,
  skipped: Set<string>,
): string | null {
  if (isEffectivelyNotApplicable(questionKey, answer, skipped)) return NOT_APPLICABLE;
  return answer ?? null;
}

export function extractRobinsIPairs(a: Checklist, b: Checklist): ToolPairs {
  const activeA = getActiveDomainKeys(a.sectionC?.isPerProtocol || false);
  const activeB = getActiveDomainKeys(b.sectionC?.isPerProtocol || false);
  // Domain 1 differs between the assignment and per-protocol effects, so it is
  // only comparable when both reviewers chose the same effect.
  const shared = activeA.filter(key => activeB.includes(key));

  // A Critical rating in Section B ends the assessment, so that reviewer has
  // no domain judgements to compare; the overall pair carries the difference.
  const criticalA = isSectionBCritical(a.sectionB as SectionBState);
  const criticalB = isSectionBCritical(b.sectionB as SectionBState);
  const skippedA = getSkippedQuestions(a as Parameters<typeof getSkippedQuestions>[0]);
  const skippedB = getSkippedQuestions(b as Parameters<typeof getSkippedQuestions>[0]);

  const judgements: RatingPair[] = [];
  const questions: RatingPair[] = [];

  for (const key of Object.keys(ROBINS_I_CHECKLIST.sectionB)) {
    questions.push({
      item: key,
      a: a.sectionB?.[key as 'b1' | 'b2' | 'b3']?.answer ?? null,
      b: b.sectionB?.[key as 'b1' | 'b2' | 'b3']?.answer ?? null,
    });
  }

  for (const domainKey of shared) {
    const domainA = a[domainKey] as ROBINSIDomainState | undefined;
    const domainB = b[domainKey] as ROBINSIDomainState | undefined;

    judgements.push({
      item: ITEM_KEY[domainKey],
      a: criticalA ? null : scoreRobinsDomain(domainKey, domainA?.answers).judgement,
      b: criticalB ? null : scoreRobinsDomain(domainKey, domainB?.answers).judgement,
    });

    for (const qKey of Object.keys(getDomainQuestions(domainKey))) {
      questions.push({
        item: qKey,
        a: normalizeAnswer(qKey, domainA?.answers?.[qKey]?.answer, skippedA),
        b: normalizeAnswer(qKey, domainB?.answers?.[qKey]?.answer, skippedB),
      });
    }
  }

  const overall: RatingPair[] = [
    { item: 'overall', a: overallJudgement(a), b: overallJudgement(b) },
  ];

  return { judgements, overall, questions };
}

export const ROBINS_I_RELIABILITY: ToolReliabilityDefinition = {
  type: 'ROBINS_I',
  label: 'ROBINS-I',
  unit: 'outcome',
  judgementLabel: 'Domain judgements',
  judgementScale: ROBINS_I_JUDGEMENT_SCALE,
  overallScale: ROBINS_I_JUDGEMENT_SCALE,
  items: DOMAIN_ITEMS,
  hasQuestions: true,
  notes: [
    'Domain judgements come from the ROBINS-I algorithm applied to the signaling answers, as the checklist shows them.',
    'Domain 1 is compared only when both reviewers assessed the same effect (assignment or per-protocol).',
    'A Critical rating in Section B leaves that reviewer with no domain judgements; the difference shows in the overall judgement.',
    'The overall judgement follows from the domains, so it is compared separately.',
  ],
  extractPairs: (a, b) => extractRobinsIPairs(a as Checklist, b as Checklist),
};
