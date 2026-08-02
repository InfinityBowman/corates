/**
 * The flat-key answer machinery, as pure functions over rows.
 *
 * The Y.Doc plane stored answers in a flat dot-notation map and mutated it
 * through per-instrument handlers (`createAnswersYMap` / `updateAnswer` in the
 * web checklist handlers). These are those handlers re-expressed over plain
 * values: text fields become plain strings (LWW rows) instead of Y.Text, and
 * every function is deterministic so it can run inside a mutator — once
 * optimistically on the client, once authoritatively on the server.
 *
 * Flat-key namespace per instrument:
 * - AMSTAR2:  `q1.answers` (boolean[][]), `q1.critical`, `q1.note`
 * - ROB2:     `preliminary.*`; `domainN.direction`; bare `dN_1` answer keys
 *             with `dN_1.comment`; `overall.direction` (judgements are derived,
 *             never stored)
 * - ROBINS-I: `planning.*`, `sectionA..sectionD.*`, `confoundingEvaluation.*`;
 *             `domainN.judgement`/`.direction`; bare `dNx_1` + `.comment`;
 *             `overall.judgement`/`.direction`
 */

import {
  AMSTAR2_KEY_SCHEMAS,
  createAMSTAR2Checklist,
  type Amstar2Answers,
  type Amstar2Key,
} from '../checklists/amstar2/index.js';
import {
  ROB2_KEY_SCHEMAS,
  createROB2Checklist,
  type Rob2Answers,
  type Rob2Key,
} from '../checklists/rob2/index.js';
import {
  ROBINS_I_KEY_SCHEMAS,
  createROBINSIChecklist,
  type RobinsIAnswers,
  type RobinsIKey,
} from '../checklists/robins-i/index.js';
import type { ChecklistType } from './schema.js';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * One validated answer update: an instrument, one of its section/question keys,
 * and that key's payload. Distributes so `data` is typed per key.
 */
export type ChecklistAnswerInput =
  | { [K in Amstar2Key]: { type: 'AMSTAR2'; key: K; data: Amstar2Answers[K] } }[Amstar2Key]
  | { [K in Rob2Key]: { type: 'ROB2'; key: K; data: Rob2Answers[K] } }[Rob2Key]
  | { [K in RobinsIKey]: { type: 'ROBINS_I'; key: K; data: RobinsIAnswers[K] } }[RobinsIKey];

export interface AnswerWrite {
  key: string;
  value: JsonValue;
}

const AMSTAR2_QUESTION_KEY = /^q\d+[a-z]*$/i;
const AMSTAR2_SUB_QUESTION = /^(q9|q11)[a-z]$/;
const AMSTAR2_MULTI_PART_PARENTS = ['q9', 'q11'];

const ROB2_TEMPLATE_KEYS = [
  'preliminary',
  'domain1',
  'domain2a',
  'domain2b',
  'domain3',
  'domain4',
  'domain5',
  'overall',
] as const;

const ROBINS_I_TEMPLATE_KEYS = [
  'planning',
  'sectionA',
  'sectionB',
  'sectionC',
  'sectionD',
  'confoundingEvaluation',
  'domain1a',
  'domain1b',
  'domain2',
  'domain3',
  'domain4',
  'domain5',
  'domain6',
  'overall',
] as const;

interface DomainTemplate {
  judgement?: string | null;
  direction?: string | null;
  answers?: Record<string, { answer?: string | null }>;
}

/**
 * The full default flat-key map for a fresh checklist of the given type —
 * what `checklist.create` expands into one `answers` row per key. Derived from
 * the shared `create*Checklist` templates, so the question lists stay defined
 * in exactly one place.
 */
export function defaultAnswerRows(type: ChecklistType): Record<string, JsonValue> {
  switch (type) {
    case 'AMSTAR2':
      return defaultAmstar2Rows();
    case 'ROB2':
      return defaultRob2Rows();
    case 'ROBINS_I':
      return defaultRobinsIRows();
  }
}

function defaultAmstar2Rows(): Record<string, JsonValue> {
  // createdAt only feeds a formatted date in checklist metadata, which the
  // answer extraction drops — pinned so the expansion is a pure function.
  const template = createAMSTAR2Checklist({ id: 'defaults', name: 'AMSTAR2 Checklist', createdAt: 0 });
  const rows: Record<string, JsonValue> = {};
  const added = new Set<string>();

  for (const [key, value] of Object.entries(template)) {
    if (!AMSTAR2_QUESTION_KEY.test(key)) continue;
    const question = value as { answers: boolean[][]; critical?: boolean };
    rows[`${key}.answers`] = question.answers;
    rows[`${key}.critical`] = question.critical ?? false;
    if (!AMSTAR2_SUB_QUESTION.test(key)) rows[`${key}.note`] = '';
    added.add(key);
  }

  for (const parent of AMSTAR2_MULTI_PART_PARENTS) {
    if (!added.has(parent)) rows[`${parent}.note`] = '';
  }

  return rows;
}

function defaultRob2Rows(): Record<string, JsonValue> {
  const template = createROB2Checklist({ id: 'defaults', name: 'ROB2 Checklist', createdAt: 0 });
  const rows: Record<string, JsonValue> = {};

  for (const key of ROB2_TEMPLATE_KEYS) {
    const value = template[key];
    if (value === undefined) continue;

    if (key === 'preliminary') {
      const prelim = value as Rob2Answers['preliminary'];
      rows['preliminary.aim'] = prelim.aim ?? null;
      rows['preliminary.studyDesign'] = prelim.studyDesign ?? null;
      rows['preliminary.deviationsToAddress'] = prelim.deviationsToAddress ?? [];
      rows['preliminary.sources'] = prelim.sources ?? {};
      rows['preliminary.experimental'] = '';
      rows['preliminary.comparator'] = '';
      rows['preliminary.numericalResult'] = '';
    } else if (key === 'overall') {
      const overall = value as DomainTemplate;
      rows['overall.direction'] = overall.direction ?? null;
    } else {
      const domain = value as DomainTemplate;
      if (domain.direction !== undefined) rows[`${key}.direction`] = domain.direction ?? null;
      for (const [qKey, qValue] of Object.entries(domain.answers ?? {})) {
        rows[qKey] = qValue.answer ?? null;
        rows[`${qKey}.comment`] = '';
      }
    }
  }

  return rows;
}

function defaultRobinsIRows(): Record<string, JsonValue> {
  const template = createROBINSIChecklist({ id: 'defaults', name: 'ROBINS_I Checklist', createdAt: 0 });
  const rows: Record<string, JsonValue> = {};

  for (const key of ROBINS_I_TEMPLATE_KEYS) {
    const value = template[key];
    if (value === undefined) continue;

    if (key === 'planning') {
      rows['planning.confoundingFactors'] = '';
    } else if (key === 'sectionA') {
      rows['sectionA.numericalResult'] = '';
      rows['sectionA.furtherDetails'] = '';
      rows['sectionA.outcome'] = '';
    } else if (key === 'sectionB') {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === 'object' && subValue !== null) {
          const question = subValue as { answer?: string | null };
          rows[`sectionB.${subKey}`] = question.answer ?? null;
          rows[`sectionB.${subKey}.comment`] = '';
        } else {
          rows[`sectionB.${subKey}`] = subValue as JsonValue;
        }
      }
    } else if (key === 'sectionC') {
      const section = value as { isPerProtocol?: boolean };
      rows['sectionC.isPerProtocol'] = section.isPerProtocol ?? false;
      rows['sectionC.participants'] = '';
      rows['sectionC.interventionStrategy'] = '';
      rows['sectionC.comparatorStrategy'] = '';
    } else if (key === 'sectionD') {
      const section = value as { sources?: Record<string, boolean> };
      rows['sectionD.sources'] = section.sources ?? {};
      rows['sectionD.otherSpecify'] = '';
    } else if (key === 'confoundingEvaluation') {
      const section = value as { predefined?: JsonValue[]; additional?: JsonValue[] };
      rows['confoundingEvaluation.predefined'] = section.predefined ?? [];
      rows['confoundingEvaluation.additional'] = section.additional ?? [];
    } else {
      const domain = value as DomainTemplate;
      if (domain.direction !== undefined) rows[`${key}.direction`] = domain.direction ?? null;
      rows[`${key}.judgement`] = domain.judgement ?? null;
      for (const [qKey, qValue] of Object.entries(domain.answers ?? {})) {
        rows[qKey] = qValue.answer ?? null;
        rows[`${qKey}.comment`] = '';
      }
    }
  }

  return rows;
}

/**
 * The flat keys holding free prose for a checklist type — exactly the keys
 * `defaultAnswerRows` seeds as the empty string (text fields are the ones
 * whose default is `''`; choice/judgement fields default `null`, structured
 * fields default arrays/objects). During reconciliation these are the fields
 * hosted as Yjs fields (field id = the `answers` row id); finalize serializes
 * each field's text back into its row, and the migration transformer uses the
 * same enumeration to seed fields for in-progress reconciliations.
 */
export function textAnswerKeys(type: ChecklistType): string[] {
  return Object.entries(defaultAnswerRows(type))
    .filter(([, value]) => value === '')
    .map(([key]) => key);
}

/**
 * Resolve one flat text key from a NESTED answers object (a generator's or a
 * legacy export's section shapes): direct path first
 * (`sectionB.b1.comment`, `preliminary.experimental`), then the domain scan
 * for bare question keys (`d1a_2.comment` lives at
 * `<domain>.answers.d1a_2.comment`). Returns undefined when absent or not a
 * string. Used by the dev seeder and the migration transformer, which both
 * turn nested shapes into `checklist.setText`-style flat writes.
 */
export function resolveNestedTextValue(
  answers: Record<string, unknown>,
  flatKey: string,
): string | undefined {
  const parts = flatKey.split('.');
  let cursor: unknown = answers;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object') cursor = (cursor as Record<string, unknown>)[part];
    else {
      cursor = undefined;
      break;
    }
  }
  if (typeof cursor === 'string') return cursor;

  if (parts.length === 2) {
    const [questionKey, field] = parts;
    for (const value of Object.values(answers)) {
      const domain = value as { answers?: Record<string, Record<string, unknown>> } | null;
      const hit = domain?.answers?.[questionKey]?.[field];
      if (typeof hit === 'string') return hit;
    }
  }
  return undefined;
}

/**
 * Expand one validated answer update into flat-key writes — the row-plane port
 * of each handler's `updateAnswer`. Text fields are absent on purpose: they go
 * through `checklist.setText` (the ROBINS-I `sectionD.otherSpecify` rewrite is
 * the one historical exception, preserved here).
 */
export function expandAnswerUpdate(input: ChecklistAnswerInput): AnswerWrite[] {
  switch (input.type) {
    case 'AMSTAR2':
      return [
        { key: `${input.key}.answers`, value: input.data.answers },
        { key: `${input.key}.critical`, value: input.data.critical ?? false },
      ];
    case 'ROB2':
      return expandRob2Update(input.key, input.data);
    case 'ROBINS_I':
      return expandRobinsIUpdate(input.key, input.data);
  }
}

function expandRob2Update(key: Rob2Key, data: Rob2Answers[Rob2Key]): AnswerWrite[] {
  const writes: AnswerWrite[] = [];

  if (key.startsWith('domain') || key === 'overall') {
    const domain = data as Rob2Answers['domain1'];
    if (domain.direction !== undefined) {
      writes.push({ key: `${key}.direction`, value: domain.direction });
    }
    for (const [qKey, qValue] of Object.entries(domain.answers ?? {})) {
      if (qValue.answer !== undefined) writes.push({ key: qKey, value: qValue.answer });
    }
  } else if (key === 'preliminary') {
    const prelim = data as Rob2Answers['preliminary'];
    if (prelim.studyDesign !== undefined) {
      writes.push({ key: 'preliminary.studyDesign', value: prelim.studyDesign });
    }
    if (prelim.aim !== undefined) writes.push({ key: 'preliminary.aim', value: prelim.aim });
    if (prelim.deviationsToAddress !== undefined) {
      writes.push({ key: 'preliminary.deviationsToAddress', value: prelim.deviationsToAddress });
    }
    if (prelim.sources !== undefined) {
      writes.push({ key: 'preliminary.sources', value: prelim.sources });
    }
  }

  return writes;
}

function expandRobinsIUpdate(key: RobinsIKey, data: RobinsIAnswers[RobinsIKey]): AnswerWrite[] {
  const writes: AnswerWrite[] = [];

  if (key.startsWith('domain') || key === 'overall') {
    const domain = data as RobinsIAnswers['domain1a'];
    if (domain.judgement !== undefined) {
      writes.push({ key: `${key}.judgement`, value: domain.judgement });
    }
    if (domain.direction !== undefined) {
      writes.push({ key: `${key}.direction`, value: domain.direction });
    }
    for (const [qKey, qValue] of Object.entries(domain.answers ?? {})) {
      if (qValue.answer !== undefined) writes.push({ key: qKey, value: qValue.answer });
    }
  } else if (key === 'sectionB') {
    const section = data as RobinsIAnswers['sectionB'];
    for (const [subKey, subValue] of Object.entries(section)) {
      if (typeof subValue === 'object' && subValue !== null) {
        if (subValue.answer !== undefined) {
          writes.push({ key: `sectionB.${subKey}`, value: subValue.answer });
        }
      } else if (subValue !== undefined) {
        writes.push({ key: `sectionB.${subKey}`, value: subValue });
      }
    }
  } else if (key === 'confoundingEvaluation') {
    const section = data as RobinsIAnswers['confoundingEvaluation'];
    if (section.predefined !== undefined) {
      writes.push({ key: 'confoundingEvaluation.predefined', value: section.predefined as JsonValue });
    }
    if (section.additional !== undefined) {
      writes.push({ key: 'confoundingEvaluation.additional', value: section.additional as JsonValue });
    }
  } else if (key === 'sectionD') {
    const section = data as RobinsIAnswers['sectionD'];
    if (section.sources !== undefined) {
      writes.push({ key: 'sectionD.sources', value: section.sources });
    }
    if (section.otherSpecify !== undefined) {
      writes.push({ key: 'sectionD.otherSpecify', value: section.otherSpecify });
    }
  } else if (key === 'sectionC') {
    const section = data as RobinsIAnswers['sectionC'];
    if (section.isPerProtocol !== undefined) {
      writes.push({ key: 'sectionC.isPerProtocol', value: section.isPerProtocol });
    }
  }
  // 'planning' and 'sectionA' hold only text fields, written via checklist.setText.

  return writes;
}

export { AMSTAR2_KEY_SCHEMAS, ROB2_KEY_SCHEMAS, ROBINS_I_KEY_SCHEMAS };
