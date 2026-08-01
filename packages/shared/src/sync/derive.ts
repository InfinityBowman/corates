/**
 * Pure derivations over a checklist's flat answer rows.
 *
 * The row plane stores answers as one row per flat key (`q1.answers`,
 * `d1_1.comment`, `sectionB.b2`, …). Everything downstream — the nested shape
 * the reconciliation UI consumes, instrument scores, and the chart-facing
 * consolidated answers — derives from a plain `Record<flatKey, value>` map.
 * These are the old web-side handler `serializeAnswers` implementations and
 * reactor score computers, re-expressed over plain values (text fields are
 * strings here, never Y.Text).
 */

import {
  AMSTAR2_DATA_KEYS,
  getAnswers as getAmstar2Answers,
  scoreAMSTAR2Checklist,
} from './../checklists/amstar2/index.js';
import type { AMSTAR2Checklist } from '../checklists/types.js';
import {
  getActiveDomainKeys as getRob2ActiveDomainKeys,
  getDomainQuestions as getRob2DomainQuestions,
  scoreRob2Domain,
} from '../checklists/rob2/index.js';
import type { DomainAnswers as Rob2DomainAnswers } from '../checklists/rob2/index.js';
import {
  getActiveDomainKeys as getRobinsIActiveDomainKeys,
  getDomainQuestions as getRobinsIDomainQuestions,
  scoreRobinsDomain,
} from '../checklists/robins-i/index.js';
import type { DomainAnswers as RobinsIDomainAnswers } from '../checklists/robins-i/index.js';
import type { ChecklistType } from './schema.js';

/** A checklist's answers as one flat map — row `key` → row `value`. */
export type AnswerRowMap = Record<string, unknown>;

const QUESTION_KEY_TO_DOMAIN = /^d(\d+[a-z]?)_/;

function questionKeyToDomain(qKey: string): string | null {
  const match = qKey.match(QUESTION_KEY_TO_DOMAIN);
  if (!match) return null;
  return `domain${match[1]}`;
}

function isSectionBKey(key: string): boolean {
  return /^b\d+$/.test(key);
}

/**
 * Re-nest a flat answer map into the canonical per-instrument shape the
 * scoring helpers and reconciliation UI consume — the row-plane port of each
 * checklist handler's `serializeAnswers`.
 */
export function serializeAnswerRows(type: ChecklistType, flat: AnswerRowMap): Record<string, unknown> {
  switch (type) {
    case 'AMSTAR2':
      return serializeAmstar2(flat);
    case 'ROB2':
      return serializeRob2(flat);
    case 'ROBINS_I':
      return serializeRobinsI(flat);
  }
}

function serializeAmstar2(flat: AnswerRowMap): Record<string, unknown> {
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(flat)) {
    const dotIdx = key.indexOf('.');
    if (dotIdx === -1) continue;
    const prefix = key.substring(0, dotIdx);
    const field = key.substring(dotIdx + 1);
    if (!grouped[prefix]) grouped[prefix] = {};
    grouped[prefix][field] = value;
  }
  return grouped;
}

function serializeRob2(flat: AnswerRowMap): Record<string, unknown> {
  const result: Record<string, Record<string, unknown>> = {};

  for (const [key, value] of Object.entries(flat)) {
    const dotIdx = key.indexOf('.');
    if (dotIdx === -1) {
      const domain = questionKeyToDomain(key);
      if (domain) {
        if (!result[domain]) result[domain] = {};
        if (!result[domain].answers) result[domain].answers = {};
        const answers = result[domain].answers as Record<string, Record<string, unknown>>;
        if (!answers[key]) answers[key] = {};
        answers[key].answer = value;
      }
      continue;
    }

    const prefix = key.substring(0, dotIdx);
    const field = key.substring(dotIdx + 1);

    const domain = questionKeyToDomain(prefix);
    if (domain) {
      if (!result[domain]) result[domain] = {};
      if (!result[domain].answers) result[domain].answers = {};
      const answers = result[domain].answers as Record<string, Record<string, unknown>>;
      if (!answers[prefix]) answers[prefix] = {};
      answers[prefix][field] = value;
      continue;
    }

    if (!result[prefix]) result[prefix] = {};
    result[prefix][field] = value;
  }

  return result;
}

function serializeRobinsI(flat: AnswerRowMap): Record<string, unknown> {
  const result: Record<string, Record<string, unknown>> = {};

  for (const [key, value] of Object.entries(flat)) {
    const dotIdx = key.indexOf('.');
    if (dotIdx === -1) {
      const domain = questionKeyToDomain(key);
      if (domain) {
        if (!result[domain]) result[domain] = {};
        if (!result[domain].answers) result[domain].answers = {};
        const answers = result[domain].answers as Record<string, Record<string, unknown>>;
        if (!answers[key]) answers[key] = {};
        answers[key].answer = value;
        continue;
      }
      continue;
    }

    const prefix = key.substring(0, dotIdx);
    const field = key.substring(dotIdx + 1);

    const domain = questionKeyToDomain(prefix);
    if (domain) {
      if (!result[domain]) result[domain] = {};
      if (!result[domain].answers) result[domain].answers = {};
      const answers = result[domain].answers as Record<string, Record<string, unknown>>;
      if (!answers[prefix]) answers[prefix] = {};
      answers[prefix][field] = value;
      continue;
    }

    if (prefix === 'sectionB') {
      if (!result.sectionB) result.sectionB = {};
      const secondDot = field.indexOf('.');
      if (secondDot === -1) {
        if (isSectionBKey(field)) {
          if (!result.sectionB[field]) result.sectionB[field] = {};
          (result.sectionB[field] as Record<string, unknown>).answer = value;
        } else {
          result.sectionB[field] = value;
        }
      } else {
        const subKey = field.substring(0, secondDot);
        const subField = field.substring(secondDot + 1);
        if (!result.sectionB[subKey]) result.sectionB[subKey] = {};
        (result.sectionB[subKey] as Record<string, unknown>)[subField] = value;
      }
      continue;
    }

    if (!result[prefix]) result[prefix] = {};
    result[prefix][field] = value;
  }

  return result;
}

/** Chart column ids for the ROB2 figures; both variants of domain 2 render as D2. */
export const ROB2_CHART_DOMAIN_KEYS: Record<string, string> = {
  domain1: 'd1',
  domain2a: 'd2',
  domain2b: 'd2',
  domain3: 'd3',
  domain4: 'd4',
  domain5: 'd5',
};

/** Chart column ids for the ROBINS-I figures; both variants of domain 1 render as D1. */
export const ROBINSI_CHART_DOMAIN_KEYS: Record<string, string> = {
  domain1a: 'd1',
  domain1b: 'd1',
  domain2: 'd2',
  domain3: 'd3',
  domain4: 'd4',
  domain5: 'd5',
  domain6: 'd6',
};

export interface DomainJudgements {
  judgements: Record<string, string | null>;
  overall: string;
}

/** Per-domain judgements + severity-ladder overall for ROB2, from flat rows. */
export function rob2JudgementsFromRows(flat: AnswerRowMap): DomainJudgements {
  const isAdhering = flat['preliminary.aim'] === 'ADHERING';
  const activeDomains = getRob2ActiveDomainKeys(isAdhering);

  const judgements: Record<string, string | null> = {};
  for (const domainKey of activeDomains) {
    const questions = getRob2DomainQuestions(domainKey);
    const answers: Rob2DomainAnswers = {};
    for (const qKey of Object.keys(questions)) {
      answers[qKey] = { answer: (flat[qKey] as string | null | undefined) ?? null };
    }
    judgements[domainKey] = scoreRob2Domain(domainKey, answers).judgement ?? null;
  }

  const values = Object.values(judgements);
  let overall: string;
  if (values.some(j => j === null)) overall = 'Incomplete';
  else if (values.includes('High')) overall = 'High';
  else if (values.includes('Some concerns')) overall = 'Some concerns';
  else overall = 'Low';
  return { judgements, overall };
}

/** Per-domain judgements + severity-ladder overall for ROBINS-I, from flat rows. */
export function robinsIJudgementsFromRows(flat: AnswerRowMap): DomainJudgements {
  const isPerProtocol = flat['sectionC.isPerProtocol'] === true;
  const activeDomains = getRobinsIActiveDomainKeys(isPerProtocol);

  const judgements: Record<string, string | null> = {};
  for (const domainKey of activeDomains) {
    const questions = getRobinsIDomainQuestions(domainKey);
    const answers: RobinsIDomainAnswers = {};
    for (const qKey of Object.keys(questions)) {
      answers[qKey] = { answer: (flat[qKey] as string | null | undefined) ?? null };
    }
    judgements[domainKey] = scoreRobinsDomain(domainKey, answers).judgement ?? null;
  }

  const values = Object.values(judgements);
  let overall: string;
  if (values.some(j => j === null)) overall = 'Incomplete';
  else if (values.includes('Critical')) overall = 'Critical';
  else if (values.includes('Serious')) overall = 'Serious';
  else if (values.includes('Moderate')) overall = 'Moderate';
  else if (values.includes('Low (except for concerns about uncontrolled confounding)')) {
    overall = 'Low (except for concerns about uncontrolled confounding)';
  } else overall = 'Low';
  return { judgements, overall };
}

/**
 * The instrument score from flat rows: severity-ladder overall for
 * ROB2/ROBINS-I, `scoreAMSTAR2Checklist` (or `'Incomplete'`) for AMSTAR2.
 */
export function scoreChecklistRows(type: ChecklistType, flat: AnswerRowMap): string {
  if (type === 'ROB2') return rob2JudgementsFromRows(flat).overall;
  if (type === 'ROBINS_I') return robinsIJudgementsFromRows(flat).overall;

  const checklist: Record<string, unknown> = {};
  for (const qKey of AMSTAR2_DATA_KEYS) {
    const answers = flat[`${qKey}.answers`] as boolean[][] | undefined;
    const critical = flat[`${qKey}.critical`] as boolean | undefined;
    if (!answers) continue;
    checklist[qKey] = { answers, critical: critical ?? false };
  }

  const hasAllAnswers = AMSTAR2_DATA_KEYS.every(qKey => {
    const question = checklist[qKey] as { answers: boolean[][] } | undefined;
    if (!question?.answers?.length) return false;
    const lastCol = question.answers[question.answers.length - 1];
    return Array.isArray(lastCol) && lastCol.some(v => v === true);
  });

  if (!hasAllAnswers) return 'Incomplete';
  return scoreAMSTAR2Checklist(checklist as unknown as AMSTAR2Checklist);
}

export interface FinalizedDerivation {
  /** Instrument score; null when incomplete/errored (matching the old chart plane). */
  score: string | null;
  /** Chart-facing consolidated answers; null unless derivable. */
  consolidatedAnswers: Record<string, string | null> | null;
}

/**
 * Score + chart-facing consolidated answers for a finalized checklist — the
 * row-plane port of the reactor's `buildChecklistEntry` derivation. Callers
 * gate on `status === 'finalized'` themselves.
 */
export function deriveFinalized(type: ChecklistType, flat: AnswerRowMap): FinalizedDerivation {
  let score: string | null = null;
  let consolidatedAnswers: Record<string, string | null> | null = null;

  if (type === 'ROB2') {
    const { judgements, overall } = rob2JudgementsFromRows(flat);
    score = overall;
    consolidatedAnswers = {};
    for (const [domainKey, judgement] of Object.entries(judgements)) {
      consolidatedAnswers[ROB2_CHART_DOMAIN_KEYS[domainKey]] = judgement ?? 'No information';
    }
    consolidatedAnswers.overall = overall === 'Incomplete' ? 'No information' : overall;
  } else if (type === 'ROBINS_I') {
    const { judgements, overall } = robinsIJudgementsFromRows(flat);
    score = overall;
    consolidatedAnswers = {};
    for (const [domainKey, judgement] of Object.entries(judgements)) {
      consolidatedAnswers[ROBINSI_CHART_DOMAIN_KEYS[domainKey]] = judgement ?? 'No information';
    }
    consolidatedAnswers.overall = overall === 'Incomplete' ? 'No information' : overall;
  } else {
    score = scoreChecklistRows('AMSTAR2', flat);
    const checklist: Record<string, unknown> = {};
    for (const qKey of AMSTAR2_DATA_KEYS) {
      const answers = flat[`${qKey}.answers`] as boolean[][] | undefined;
      const critical = flat[`${qKey}.critical`] as boolean | undefined;
      if (!answers) continue;
      checklist[qKey] = { answers, critical: critical ?? false };
    }
    consolidatedAnswers =
      (getAmstar2Answers(checklist as unknown as AMSTAR2Checklist) as Record<
        string,
        string | null
      > | null) ?? null;
  }

  if (score === 'Incomplete' || score === 'Error') score = null;
  return { score, consolidatedAnswers };
}

/**
 * The flat key a structured text-field reference resolves to — the row-plane
 * port of the handlers' `getTextGetter` key resolution. AMSTAR2 notes live at
 * `<questionKey>.note`; ROB2/ROBINS-I free text lives at
 * `<questionKey>.<fieldKey>` when question-scoped, else `<sectionKey>.<fieldKey>`.
 */
export function textFieldKey(ref: {
  type: ChecklistType;
  questionKey?: string | null;
  sectionKey?: string;
  fieldKey?: string;
}): string {
  if (ref.type === 'AMSTAR2') return `${ref.questionKey}.note`;
  return ref.questionKey ? `${ref.questionKey}.${ref.fieldKey}` : `${ref.sectionKey}.${ref.fieldKey}`;
}
