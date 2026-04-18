/**
 * Round-trip test for the local-checklists → Y.Doc migration.
 *
 * For each checklist type: build a row that matches what the legacy
 * `localChecklistsStore` would have persisted, run the migration shape
 * transformation, then serialize back and assert the answer-shaped subset
 * survives intact.
 *
 * Y.Text fields come back as empty strings (the migration starts fresh Y.Text
 * instances). The original templates also default those fields to empty
 * string-ish, so round-trip equality holds for the answer payload.
 */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createChecklistOfType, CHECKLIST_TYPES } from '@/checklist-registry';
import { AMSTAR2Handler } from '@/primitives/useProject/checklists/handlers/amstar2';
import { ROBINSIHandler } from '@/primitives/useProject/checklists/handlers/robins-i';
import { ROB2Handler } from '@/primitives/useProject/checklists/handlers/rob2';
import {
  attachAndSeedStudy,
  buildStudyForLocalRow,
  seedTextFieldsIntoAnswersYMap,
  type LocalChecklistRow,
} from './localProject';

type AnyRecord = Record<string, unknown>;

function buildLegacyRow(type: string, id: string, name: string): LocalChecklistRow {
  const now = 1700000000000;
  const template = createChecklistOfType(type, {
    id,
    name,
    createdAt: now,
    reviewerName: '',
  }) as AnyRecord;
  return {
    ...template,
    id,
    name,
    checklistType: type,
    createdAt: now,
    updatedAt: now,
    isLocal: true,
  } as LocalChecklistRow;
}

function migrateAndSerialize(
  row: LocalChecklistRow,
  handler: AMSTAR2Handler | ROBINSIHandler | ROB2Handler,
): AnyRecord {
  const ydoc = new Y.Doc();
  const reviews = ydoc.getMap('reviews');
  const studyYMap = buildStudyForLocalRow(row)!;
  expect(studyYMap).not.toBeNull();
  // Must attach before Y.Text can be written.
  attachAndSeedStudy(reviews, studyYMap, row);

  const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown>;
  const checklistYMap = checklistsMap.get(row.id) as Y.Map<unknown>;
  const answersYMap = checklistYMap.get('answers') as Y.Map<unknown>;
  return handler.serializeAnswers(answersYMap);
}

describe('buildStudyForLocalRow — round-trip', () => {
  describe('AMSTAR2', () => {
    const handler = new AMSTAR2Handler();
    const row = buildLegacyRow(CHECKLIST_TYPES.AMSTAR2, 'local-1', 'AMSTAR2 study');

    it('preserves every question answer field', () => {
      const serialized = migrateAndSerialize(row, handler);

      for (const [key, value] of Object.entries(row)) {
        if (!/^q\d+[a-z]*$/i.test(key)) continue;
        expect(serialized).toHaveProperty(key);
        const before = value as AnyRecord;
        const after = serialized[key] as AnyRecord;
        expect(after.answers).toEqual(before.answers);
        expect(after.critical).toEqual(before.critical);
      }
    });

    it('attaches the checklist under a study whose id == checklist id', () => {
      const ydoc = new Y.Doc();
      const reviews = ydoc.getMap('reviews');
      reviews.set(row.id, buildStudyForLocalRow(row)!);

      const study = reviews.get(row.id) as Y.Map<unknown>;
      expect(study.get('name')).toBe('AMSTAR2 study');
      const checklists = study.get('checklists') as Y.Map<unknown>;
      expect([...checklists.keys()]).toEqual([row.id]);
      const checklist = checklists.get(row.id) as Y.Map<unknown>;
      expect(checklist.get('type')).toBe(CHECKLIST_TYPES.AMSTAR2);
    });
  });

  describe('ROBINS-I', () => {
    const handler = new ROBINSIHandler();
    const row = buildLegacyRow(CHECKLIST_TYPES.ROBINS_I, 'local-2', 'ROBINS-I study');

    it('preserves domain answers, sectionB, and overall judgement fields', () => {
      const serialized = migrateAndSerialize(row, handler);

      // Domain keys carry answers + judgement + direction
      for (const key of Object.keys(row)) {
        if (!key.startsWith('domain')) continue;
        const before = row[key] as AnyRecord;
        const after = serialized[key] as AnyRecord;
        expect(after.judgement).toEqual(before.judgement ?? null);
        // direction present on domains that have it
        if (before.direction !== undefined) {
          expect(after.direction).toEqual(before.direction);
        }
        // each nested answer preserves its `answer` (comment starts empty)
        const beforeAnswers = (before.answers ?? {}) as Record<string, { answer?: unknown }>;
        const afterAnswers = (after.answers ?? {}) as Record<string, { answer: unknown }>;
        for (const qKey of Object.keys(beforeAnswers)) {
          expect(afterAnswers[qKey].answer).toEqual(beforeAnswers[qKey].answer ?? null);
        }
      }

      // Overall judgement
      const overall = serialized.overall as AnyRecord;
      expect(overall.judgement).toEqual((row.overall as AnyRecord).judgement ?? null);
    });
  });

  describe('ROB2', () => {
    const handler = new ROB2Handler();
    const row = buildLegacyRow(CHECKLIST_TYPES.ROB2, 'local-3', 'RoB2 study');

    it('preserves preliminary scalar fields and domain answers', () => {
      const serialized = migrateAndSerialize(row, handler);

      const preliminaryBefore = row.preliminary as AnyRecord;
      const preliminaryAfter = serialized.preliminary as AnyRecord;
      expect(preliminaryAfter.studyDesign).toEqual(preliminaryBefore.studyDesign ?? null);
      expect(preliminaryAfter.aim).toEqual(preliminaryBefore.aim ?? null);
      expect(preliminaryAfter.deviationsToAddress).toEqual(
        preliminaryBefore.deviationsToAddress ?? [],
      );
      expect(preliminaryAfter.sources).toEqual(preliminaryBefore.sources ?? {});

      for (const key of Object.keys(row)) {
        if (!key.startsWith('domain')) continue;
        const before = row[key] as AnyRecord;
        const after = serialized[key] as AnyRecord;
        expect(after.judgement).toEqual(before.judgement ?? null);
        const beforeAnswers = (before.answers ?? {}) as Record<string, { answer?: unknown }>;
        const afterAnswers = (after.answers ?? {}) as Record<string, { answer: unknown }>;
        for (const qKey of Object.keys(beforeAnswers)) {
          expect(afterAnswers[qKey].answer).toEqual(beforeAnswers[qKey].answer ?? null);
        }
      }
    });
  });

  describe('unknown checklist type', () => {
    it('returns null and does not throw', () => {
      const row: LocalChecklistRow = {
        id: 'local-x',
        name: 'Bogus',
        checklistType: 'NOT_A_REAL_TYPE',
        createdAt: 1,
        updatedAt: 1,
      };
      expect(buildStudyForLocalRow(row)).toBeNull();
    });
  });

  describe('V1-migrated → V2 seed against real Dexie row shape', () => {
    // Verbatim shape from a user's IndexedDB `localChecklists` table after V1
    // ran and wiped their notes. Used to reproduce and fix recovery.
    function realAMSTAR2Row(): LocalChecklistRow {
      return {
        type: 'AMSTAR2',
        name: 'test',
        reviewerName: '',
        createdAt: 1776520540241,
        id: 'local-e0c7b0a8-2b8f-4f06-b3e0-07c429ea41e1',
        checklistType: 'AMSTAR2',
        isLocal: true,
        updatedAt: 1776521876773,
        notes: {
          q1: 'test 1',
          q2: '2',
          q3: '3',
          q4: '4',
          q5: '5',
          q6: '6',
          q7: '7',
        },
        q1: { answers: [[false, true, true, false], [false], [false, true]], critical: false },
        q2: {
          answers: [
            [true, true, true, true],
            [false, false, false],
            [false, true, false],
          ],
          critical: true,
        },
        q3: {
          answers: [
            [true, false, true],
            [true, false],
          ],
          critical: false,
        },
        q4: {
          answers: [
            [true, true, true],
            [true, true, true, true, true],
            [true, false, false],
          ],
          critical: true,
        },
        q5: {
          answers: [
            [true, false],
            [true, false],
          ],
          critical: false,
        },
        q6: {
          answers: [
            [true, false],
            [true, false],
          ],
          critical: false,
        },
        q7: { answers: [[true], [false], [false, true, false]], critical: true },
        q8: {
          answers: [
            [false, false, false, false, false],
            [false, false, false, false, false],
            [false, false, false],
          ],
          critical: false,
        },
        q9a: {
          answers: [
            [false, false],
            [false, false],
            [false, false, false, false],
          ],
          critical: true,
        },
        q9b: {
          answers: [
            [false, false],
            [false, false],
            [false, false, false, false],
          ],
          critical: true,
        },
        q10: { answers: [[false], [false, false]], critical: false },
        q11a: {
          answers: [
            [false, false, false],
            [false, false, false],
          ],
          critical: true,
        },
        q11b: {
          answers: [
            [false, false, false, false],
            [false, false, false],
          ],
          critical: true,
        },
        q12: {
          answers: [
            [false, false],
            [false, false, false],
          ],
          critical: false,
        },
        q13: {
          answers: [
            [false, false],
            [false, false],
          ],
          critical: true,
        },
        q14: {
          answers: [
            [false, false],
            [false, false],
          ],
          critical: false,
        },
        q15: { answers: [[false], [false, false, false]], critical: true },
        q16: {
          answers: [
            [false, false],
            [false, false],
          ],
          critical: false,
        },
      };
    }

    it('recovers notes from the real Dexie row when V1 already populated reviews with empty Y.Text', () => {
      const row = realAMSTAR2Row();
      const handler = new AMSTAR2Handler();

      // Simulate the V1 state: Y.Doc has a reviews entry for this row with
      // empty Y.Text note fields, and the V1 migration flag is set.
      const ydoc = new Y.Doc();
      const reviews = ydoc.getMap('reviews');
      const studyYMap = buildStudyForLocalRow(row)!;
      reviews.set(row.id, studyYMap);
      // Do NOT call attachAndSeedStudy here — we want to reproduce the V1
      // exact state where text was never seeded.
      ydoc.getMap('meta').set('localMigrationV1', true);

      // Sanity check: notes are empty after V1.
      const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown>;
      const checklistYMap = checklistsMap.get(row.id) as Y.Map<unknown>;
      const answersYMap = checklistYMap.get('answers') as Y.Map<unknown>;
      const q1YMap = answersYMap.get('q1') as Y.Map<unknown>;
      const q1Note = q1YMap.get('note') as Y.Text;
      expect(q1Note.toString()).toBe('');

      // Now run the V2 recovery step: find existing study, seed.
      seedTextFieldsIntoAnswersYMap(answersYMap, 'AMSTAR2', row as Record<string, unknown>);

      // Serialized output should have the notes populated.
      const serialized = handler.serializeAnswers(answersYMap);
      expect((serialized.q1 as Record<string, unknown>).note).toBe('test 1');
      expect((serialized.q2 as Record<string, unknown>).note).toBe('2');
      expect((serialized.q3 as Record<string, unknown>).note).toBe('3');
      expect((serialized.q4 as Record<string, unknown>).note).toBe('4');
      expect((serialized.q5 as Record<string, unknown>).note).toBe('5');
      expect((serialized.q6 as Record<string, unknown>).note).toBe('6');
      expect((serialized.q7 as Record<string, unknown>).note).toBe('7');

      // The Y.Text instance itself should hold the content too (this is what
      // the UI's NoteEditor subscribes to).
      expect(q1Note.toString()).toBe('test 1');
    });
  });

  describe('text-field preservation', () => {
    it('AMSTAR2: copies question notes from source row into Y.Text', () => {
      const handler = new AMSTAR2Handler();
      const row = buildLegacyRow(CHECKLIST_TYPES.AMSTAR2, 'local-txt-1', 'with notes');
      row.notes = {
        q1: 'First question reasoning',
        q2: 'Second question has issues',
        q7: 'Critical flaw here',
      };

      const serialized = migrateAndSerialize(row, handler);
      expect((serialized.q1 as Record<string, unknown>).note).toBe('First question reasoning');
      expect((serialized.q2 as Record<string, unknown>).note).toBe('Second question has issues');
      expect((serialized.q7 as Record<string, unknown>).note).toBe('Critical flaw here');
    });

    it('ROBINS-I: copies section/planning narrative and domain comments', () => {
      const handler = new ROBINSIHandler();
      const row = buildLegacyRow(CHECKLIST_TYPES.ROBINS_I, 'local-txt-2', 'with notes');
      (row.planning as Record<string, unknown>).confoundingFactors = 'Age, sex, smoking';
      (row.sectionA as Record<string, unknown>).numericalResult = '42% reduction';
      (row.sectionA as Record<string, unknown>).outcome = 'Mortality at 12 months';
      ((row.sectionB as Record<string, unknown>).b1 as Record<string, unknown>).comment =
        'Randomized OK';
      const domain1a = row.domain1a as Record<string, unknown>;
      const d1Answers = domain1a.answers as Record<string, Record<string, unknown>>;
      const firstQKey = Object.keys(d1Answers)[0];
      d1Answers[firstQKey].comment = 'Concerned about selection';

      const serialized = migrateAndSerialize(row, handler);

      expect((serialized.planning as Record<string, unknown>).confoundingFactors).toBe(
        'Age, sex, smoking',
      );
      const sectionA = serialized.sectionA as Record<string, unknown>;
      expect(sectionA.numericalResult).toBe('42% reduction');
      expect(sectionA.outcome).toBe('Mortality at 12 months');
      const sectionB = serialized.sectionB as Record<string, Record<string, unknown>>;
      expect(sectionB.b1.comment).toBe('Randomized OK');
      const serializedDomain = serialized.domain1a as Record<string, unknown>;
      const serializedDomainAnswers = serializedDomain.answers as Record<
        string,
        Record<string, unknown>
      >;
      expect(serializedDomainAnswers[firstQKey].comment).toBe('Concerned about selection');
    });

    it('RoB2: copies preliminary narrative and domain comments', () => {
      const handler = new ROB2Handler();
      const row = buildLegacyRow(CHECKLIST_TYPES.ROB2, 'local-txt-3', 'with notes');
      const prelim = row.preliminary as Record<string, unknown>;
      prelim.experimental = 'Drug X 10mg';
      prelim.comparator = 'Placebo';
      prelim.numericalResult = 'RR 0.76';
      const domain1 = row.domain1 as Record<string, unknown>;
      const d1Answers = domain1.answers as Record<string, Record<string, unknown>>;
      const firstQKey = Object.keys(d1Answers)[0];
      d1Answers[firstQKey].comment = 'Concealment unclear';

      const serialized = migrateAndSerialize(row, handler);

      const serializedPrelim = serialized.preliminary as Record<string, unknown>;
      expect(serializedPrelim.experimental).toBe('Drug X 10mg');
      expect(serializedPrelim.comparator).toBe('Placebo');
      expect(serializedPrelim.numericalResult).toBe('RR 0.76');
      const serializedDomain = serialized.domain1 as Record<string, unknown>;
      const serializedDomainAnswers = serializedDomain.answers as Record<
        string,
        Record<string, unknown>
      >;
      expect(serializedDomainAnswers[firstQKey].comment).toBe('Concealment unclear');
    });

    it('seed is idempotent and does not overwrite existing Y.Text content', () => {
      const ydoc = new Y.Doc();
      const row = buildLegacyRow(CHECKLIST_TYPES.AMSTAR2, 'local-txt-4', 'idempotent');
      row.notes = { q1: 'Original note' };

      const studyYMap = buildStudyForLocalRow(row)!;
      ydoc.getMap('reviews').set(row.id, studyYMap);
      const answersYMap = (
        (studyYMap.get('checklists') as Y.Map<unknown>).get(row.id) as Y.Map<unknown>
      ).get('answers') as Y.Map<unknown>;

      // Simulate: the user then edits the Y.Text after migration.
      const q1YMap = answersYMap.get('q1') as Y.Map<unknown>;
      const noteYText = q1YMap.get('note') as Y.Text;
      noteYText.delete(0, noteYText.length);
      noteYText.insert(0, 'User edited this after migration');

      // Re-run seed with a different source value. Existing non-empty Y.Text
      // must be left alone.
      seedTextFieldsIntoAnswersYMap(answersYMap, CHECKLIST_TYPES.AMSTAR2, {
        notes: { q1: 'Attempt to overwrite' },
      });

      expect(noteYText.toString()).toBe('User edited this after migration');
    });

    it('seed fills empty Y.Text left behind by a prior broken migration', () => {
      // Simulate the V1 bug: answers map exists with empty Y.Text notes,
      // source row still has the original content.
      const handler = new AMSTAR2Handler();
      const ydoc = new Y.Doc();
      const answersData = handler.extractAnswersFromTemplate(
        buildLegacyRow(CHECKLIST_TYPES.AMSTAR2, 'x', 'x') as Record<string, unknown>,
      );
      const answersYMap = handler.createAnswersYMap(answersData);
      ydoc.getMap('root').set('answers', answersYMap);

      seedTextFieldsIntoAnswersYMap(answersYMap, CHECKLIST_TYPES.AMSTAR2, {
        notes: { q3: 'Recovered note' },
      });

      const serialized = handler.serializeAnswers(answersYMap);
      expect((serialized.q3 as Record<string, unknown>).note).toBe('Recovered note');
    });
  });

  describe('missing checklist type falls back to AMSTAR2', () => {
    it('treats rows without checklistType as AMSTAR2', () => {
      const row = buildLegacyRow(CHECKLIST_TYPES.AMSTAR2, 'local-4', 'Legacy row');
      delete (row as AnyRecord).checklistType;
      delete (row as AnyRecord).type;

      const ydoc = new Y.Doc();
      const studyYMap = buildStudyForLocalRow(row);
      expect(studyYMap).not.toBeNull();
      const reviews = ydoc.getMap('reviews');
      reviews.set(row.id, studyYMap!);
      const checklists = studyYMap!.get('checklists') as Y.Map<unknown>;
      const checklist = checklists.get(row.id) as Y.Map<unknown>;
      expect(checklist.get('type')).toBe(CHECKLIST_TYPES.AMSTAR2);
    });
  });
});
