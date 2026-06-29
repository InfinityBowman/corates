import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { migrateYDocToFlatKeys } from './migrate';
import { AMSTAR2Handler } from '@/primitives/useProject/checklists/handlers/amstar2';
import { ROB2Handler } from '@/primitives/useProject/checklists/handlers/rob2';
import { ROBINSIHandler } from '@/primitives/useProject/checklists/handlers/robins-i';

function buildNestedAMSTAR2(ydoc: Y.Doc): void {
  ydoc.transact(() => {
    const reviews = ydoc.getMap('reviews');
    const study = new Y.Map<unknown>();
    study.set('name', 'Test Study');
    study.set('createdAt', 1700000000000);
    study.set('updatedAt', 1700000000000);

    const checklists = new Y.Map<unknown>();
    const checklist = new Y.Map<unknown>();
    checklist.set('type', 'AMSTAR2');
    checklist.set('status', 'pending');
    checklist.set('createdAt', 1700000000000);

    const answers = new Y.Map<unknown>();

    const q1 = new Y.Map<unknown>();
    q1.set('answers', [[true, false], [false]]);
    q1.set('critical', false);
    const q1Note = new Y.Text();
    q1.set('note', q1Note);

    const q2 = new Y.Map<unknown>();
    q2.set('answers', [[false, true], [true]]);
    q2.set('critical', true);
    const q2Note = new Y.Text();
    q2.set('note', q2Note);

    answers.set('q1', q1);
    answers.set('q2', q2);
    checklist.set('answers', answers);
    checklists.set('cl-1', checklist);
    study.set('checklists', checklists);
    reviews.set('study-1', study);
  });

  const answers = getAnswersMap(ydoc, 'study-1', 'cl-1');
  const q1Note = (answers.get('q1') as Y.Map<unknown>).get('note') as Y.Text;
  q1Note.insert(0, 'Important note about q1');
  const q2Note = (answers.get('q2') as Y.Map<unknown>).get('note') as Y.Text;
  q2Note.insert(0, 'Critical finding');
}

function buildNestedROB2(ydoc: Y.Doc): void {
  ydoc.transact(() => {
    const reviews = ydoc.getMap('reviews');
    const study = new Y.Map<unknown>();
    study.set('name', 'ROB2 Study');
    study.set('createdAt', 1700000000000);

    const checklists = new Y.Map<unknown>();
    const checklist = new Y.Map<unknown>();
    checklist.set('type', 'ROB2');
    checklist.set('status', 'pending');
    checklist.set('createdAt', 1700000000000);

    const answers = new Y.Map<unknown>();

    const preliminary = new Y.Map<unknown>();
    preliminary.set('aim', 'Test treatment efficacy');
    preliminary.set('studyDesign', 'RCT');
    preliminary.set('deviationsToAddress', ['ITT']);
    preliminary.set('sources', { published: true, registry: false });
    const experimental = new Y.Text();
    preliminary.set('experimental', experimental);
    const comparator = new Y.Text();
    preliminary.set('comparator', comparator);
    const numericalResult = new Y.Text();
    preliminary.set('numericalResult', numericalResult);
    answers.set('preliminary', preliminary);

    const domain1 = new Y.Map<unknown>();
    domain1.set('direction', 'favour_experimental');
    const d1Answers = new Y.Map<unknown>();
    const d1_1 = new Y.Map<unknown>();
    d1_1.set('answer', 'Y');
    const d1_1Comment = new Y.Text();
    d1_1.set('comment', d1_1Comment);
    const d1_2 = new Y.Map<unknown>();
    d1_2.set('answer', 'PY');
    const d1_2Comment = new Y.Text();
    d1_2.set('comment', d1_2Comment);
    d1Answers.set('d1_1', d1_1);
    d1Answers.set('d1_2', d1_2);
    domain1.set('answers', d1Answers);
    answers.set('domain1', domain1);

    const overall = new Y.Map<unknown>();
    overall.set('direction', 'favour_comparator');
    answers.set('overall', overall);

    checklist.set('answers', answers);
    checklists.set('cl-2', checklist);
    study.set('checklists', checklists);
    reviews.set('study-2', study);
  });

  const answers = getAnswersMap(ydoc, 'study-2', 'cl-2');
  const preliminary = answers.get('preliminary') as Y.Map<unknown>;
  (preliminary.get('experimental') as Y.Text).insert(0, 'Drug X 10mg');
  (preliminary.get('comparator') as Y.Text).insert(0, 'Placebo');
  (preliminary.get('numericalResult') as Y.Text).insert(0, 'RR 0.76');
  const d1Answers = (answers.get('domain1') as Y.Map<unknown>).get('answers') as Y.Map<unknown>;
  ((d1Answers.get('d1_1') as Y.Map<unknown>).get('comment') as Y.Text).insert(
    0,
    'Allocation concealed',
  );
}

function buildNestedROBINSI(ydoc: Y.Doc): void {
  ydoc.transact(() => {
    const reviews = ydoc.getMap('reviews');
    const study = new Y.Map<unknown>();
    study.set('name', 'ROBINS-I Study');
    study.set('createdAt', 1700000000000);

    const checklists = new Y.Map<unknown>();
    const checklist = new Y.Map<unknown>();
    checklist.set('type', 'ROBINS_I');
    checklist.set('status', 'pending');
    checklist.set('createdAt', 1700000000000);

    const answers = new Y.Map<unknown>();

    const planning = new Y.Map<unknown>();
    const confoundingFactors = new Y.Text();
    planning.set('confoundingFactors', confoundingFactors);
    answers.set('planning', planning);

    const sectionA = new Y.Map<unknown>();
    const numericalResult = new Y.Text();
    const furtherDetails = new Y.Text();
    const outcome = new Y.Text();
    sectionA.set('numericalResult', numericalResult);
    sectionA.set('furtherDetails', furtherDetails);
    sectionA.set('outcome', outcome);
    answers.set('sectionA', sectionA);

    const sectionB = new Y.Map<unknown>();
    const b1 = new Y.Map<unknown>();
    b1.set('answer', 'Y');
    const b1Comment = new Y.Text();
    b1.set('comment', b1Comment);
    const b2 = new Y.Map<unknown>();
    b2.set('answer', 'N');
    const b2Comment = new Y.Text();
    b2.set('comment', b2Comment);
    sectionB.set('b1', b1);
    sectionB.set('b2', b2);
    answers.set('sectionB', sectionB);

    const sectionC = new Y.Map<unknown>();
    sectionC.set('isPerProtocol', true);
    const participants = new Y.Text();
    const interventionStrategy = new Y.Text();
    const comparatorStrategy = new Y.Text();
    sectionC.set('participants', participants);
    sectionC.set('interventionStrategy', interventionStrategy);
    sectionC.set('comparatorStrategy', comparatorStrategy);
    answers.set('sectionC', sectionC);

    const sectionD = new Y.Map<unknown>();
    sectionD.set('sources', { published: true });
    const otherSpecify = new Y.Text();
    sectionD.set('otherSpecify', otherSpecify);
    answers.set('sectionD', sectionD);

    const confoundingEvaluation = new Y.Map<unknown>();
    confoundingEvaluation.set('predefined', ['age', 'sex']);
    confoundingEvaluation.set('additional', ['smoking']);
    answers.set('confoundingEvaluation', confoundingEvaluation);

    const domain1a = new Y.Map<unknown>();
    domain1a.set('direction', 'favour_experimental');
    domain1a.set('judgement', 'Low');
    domain1a.set('judgementSource', 'auto');
    const d1aAnswers = new Y.Map<unknown>();
    const d1a_1 = new Y.Map<unknown>();
    d1a_1.set('answer', 'Y');
    const d1a_1Comment = new Y.Text();
    d1a_1.set('comment', d1a_1Comment);
    d1aAnswers.set('d1a_1', d1a_1);
    domain1a.set('answers', d1aAnswers);
    answers.set('domain1a', domain1a);

    const overall = new Y.Map<unknown>();
    overall.set('judgement', 'Low');
    overall.set('judgementSource', 'manual');
    answers.set('overall', overall);

    checklist.set('answers', answers);
    checklists.set('cl-3', checklist);
    study.set('checklists', checklists);
    reviews.set('study-3', study);
  });

  const answers = getAnswersMap(ydoc, 'study-3', 'cl-3');
  ((answers.get('planning') as Y.Map<unknown>).get('confoundingFactors') as Y.Text).insert(
    0,
    'Age, sex, smoking status',
  );
  ((answers.get('sectionA') as Y.Map<unknown>).get('outcome') as Y.Text).insert(
    0,
    'Mortality at 12 months',
  );
  const b1 = (answers.get('sectionB') as Y.Map<unknown>).get('b1') as Y.Map<unknown>;
  (b1.get('comment') as Y.Text).insert(0, 'Well described');
}

function getAnswersMap(ydoc: Y.Doc, studyId: string, checklistId: string): Y.Map<unknown> {
  const study = ydoc.getMap('reviews').get(studyId) as Y.Map<unknown>;
  const checklists = study.get('checklists') as Y.Map<unknown>;
  const checklist = checklists.get(checklistId) as Y.Map<unknown>;
  return checklist.get('answers') as Y.Map<unknown>;
}

describe('migrateYDocToFlatKeys', () => {
  it('is a no-op on empty Y.Doc', () => {
    const ydoc = new Y.Doc();
    ydoc.getMap('reviews');
    migrateYDocToFlatKeys(ydoc);
    expect(ydoc.getMap('reviews').size).toBe(0);
  });

  it('is a no-op on already-flat Y.Doc', () => {
    const ydoc = new Y.Doc();
    const handler = new AMSTAR2Handler();
    const answersData = handler.extractAnswersFromTemplate({
      q1: { answers: [[true]], critical: false },
    });
    const answersYMap = handler.createAnswersYMap(answersData);

    ydoc.transact(() => {
      const reviews = ydoc.getMap('reviews');
      const study = new Y.Map<unknown>();
      const checklists = new Y.Map<unknown>();
      const checklist = new Y.Map<unknown>();
      checklist.set('type', 'AMSTAR2');
      checklist.set('answers', answersYMap);
      checklists.set('cl-1', checklist);
      study.set('checklists', checklists);
      reviews.set('study-1', study);
    });

    migrateYDocToFlatKeys(ydoc);

    const answers = getAnswersMap(ydoc, 'study-1', 'cl-1');
    expect(answers.get('q1.answers')).toEqual([[true]]);
    expect(answers.get('q1.critical')).toBe(false);
  });

  describe('AMSTAR2', () => {
    it('flattens nested Y.Map answers to dot-notation keys', () => {
      const ydoc = new Y.Doc();
      buildNestedAMSTAR2(ydoc);

      migrateYDocToFlatKeys(ydoc);

      const answers = getAnswersMap(ydoc, 'study-1', 'cl-1');

      expect(answers.get('q1.answers')).toEqual([[true, false], [false]]);
      expect(answers.get('q1.critical')).toBe(false);
      expect(answers.get('q2.answers')).toEqual([[false, true], [true]]);
      expect(answers.get('q2.critical')).toBe(true);

      expect(answers.get('q1') as unknown).toBeUndefined();
      expect(answers.get('q2') as unknown).toBeUndefined();
    });

    it('preserves Y.Text content through migration', () => {
      const ydoc = new Y.Doc();
      buildNestedAMSTAR2(ydoc);

      migrateYDocToFlatKeys(ydoc);

      const answers = getAnswersMap(ydoc, 'study-1', 'cl-1');
      const q1Note = answers.get('q1.note');
      expect(q1Note).toBeInstanceOf(Y.Text);
      expect((q1Note as Y.Text).toString()).toBe('Important note about q1');

      const q2Note = answers.get('q2.note');
      expect(q2Note).toBeInstanceOf(Y.Text);
      expect((q2Note as Y.Text).toString()).toBe('Critical finding');
    });

    it('produces output that serializeAnswers can consume', () => {
      const ydoc = new Y.Doc();
      buildNestedAMSTAR2(ydoc);

      migrateYDocToFlatKeys(ydoc);

      const answers = getAnswersMap(ydoc, 'study-1', 'cl-1');
      const handler = new AMSTAR2Handler();
      const serialized = handler.serializeAnswers(answers);

      const q1 = serialized.q1 as Record<string, unknown>;
      expect(q1.answers).toEqual([[true, false], [false]]);
      expect(q1.critical).toBe(false);
      expect(q1.note).toBe('Important note about q1');

      const q2 = serialized.q2 as Record<string, unknown>;
      expect(q2.answers).toEqual([[false, true], [true]]);
      expect(q2.critical).toBe(true);
      expect(q2.note).toBe('Critical finding');
    });
  });

  describe('ROB2', () => {
    it('flattens nested structure to flat keys', () => {
      const ydoc = new Y.Doc();
      buildNestedROB2(ydoc);

      migrateYDocToFlatKeys(ydoc);

      const answers = getAnswersMap(ydoc, 'study-2', 'cl-2');

      expect(answers.get('preliminary.aim')).toBe('Test treatment efficacy');
      expect(answers.get('preliminary.studyDesign')).toBe('RCT');
      expect(answers.get('preliminary.deviationsToAddress')).toEqual(['ITT']);
      expect(answers.get('preliminary.sources')).toEqual({ published: true, registry: false });
      expect((answers.get('preliminary.experimental') as Y.Text).toString()).toBe('Drug X 10mg');
      expect((answers.get('preliminary.comparator') as Y.Text).toString()).toBe('Placebo');
      expect((answers.get('preliminary.numericalResult') as Y.Text).toString()).toBe('RR 0.76');

      expect(answers.get('domain1.direction')).toBe('favour_experimental');
      expect(answers.get('d1_1')).toBe('Y');
      expect(answers.get('d1_2')).toBe('PY');
      expect((answers.get('d1_1.comment') as Y.Text).toString()).toBe('Allocation concealed');

      expect(answers.get('overall.direction')).toBe('favour_comparator');

      expect(answers.get('preliminary') as unknown).toBeUndefined();
      expect(answers.get('domain1') as unknown).toBeUndefined();
      expect(answers.get('overall') as unknown).toBeUndefined();
    });

    it('produces output that serializeAnswers can consume', () => {
      const ydoc = new Y.Doc();
      buildNestedROB2(ydoc);

      migrateYDocToFlatKeys(ydoc);

      const answers = getAnswersMap(ydoc, 'study-2', 'cl-2');
      const handler = new ROB2Handler();
      const serialized = handler.serializeAnswers(answers);

      const prelim = serialized.preliminary as Record<string, unknown>;
      expect(prelim.aim).toBe('Test treatment efficacy');
      expect(prelim.studyDesign).toBe('RCT');
      expect(prelim.experimental).toBe('Drug X 10mg');

      const domain1 = serialized.domain1 as Record<string, unknown>;
      expect(domain1.direction).toBe('favour_experimental');
      const d1Answers = domain1.answers as Record<string, Record<string, unknown>>;
      expect(d1Answers.d1_1.answer).toBe('Y');
      expect(d1Answers.d1_1.comment).toBe('Allocation concealed');
      expect(d1Answers.d1_2.answer).toBe('PY');
    });
  });

  describe('ROBINS-I', () => {
    it('flattens nested structure to flat keys', () => {
      const ydoc = new Y.Doc();
      buildNestedROBINSI(ydoc);

      migrateYDocToFlatKeys(ydoc);

      const answers = getAnswersMap(ydoc, 'study-3', 'cl-3');

      expect((answers.get('planning.confoundingFactors') as Y.Text).toString()).toBe(
        'Age, sex, smoking status',
      );
      expect((answers.get('sectionA.outcome') as Y.Text).toString()).toBe('Mortality at 12 months');
      expect(answers.get('sectionA.numericalResult')).toBeInstanceOf(Y.Text);
      expect(answers.get('sectionA.furtherDetails')).toBeInstanceOf(Y.Text);

      expect(answers.get('sectionB.b1')).toBe('Y');
      expect(answers.get('sectionB.b2')).toBe('N');
      expect((answers.get('sectionB.b1.comment') as Y.Text).toString()).toBe('Well described');

      expect(answers.get('sectionC.isPerProtocol')).toBe(true);
      expect(answers.get('sectionC.participants')).toBeInstanceOf(Y.Text);

      expect(answers.get('sectionD.sources')).toEqual({ published: true });
      expect(answers.get('sectionD.otherSpecify')).toBeInstanceOf(Y.Text);

      expect(answers.get('confoundingEvaluation.predefined')).toEqual(['age', 'sex']);
      expect(answers.get('confoundingEvaluation.additional')).toEqual(['smoking']);

      expect(answers.get('domain1a.direction')).toBe('favour_experimental');
      expect(answers.get('domain1a.judgement')).toBe('Low');
      // judgementSource is no longer part of the model -- migration drops it.
      expect(answers.get('domain1a.judgementSource') as unknown).toBeUndefined();
      expect(answers.get('d1a_1')).toBe('Y');

      expect(answers.get('overall.judgement')).toBe('Low');
      expect(answers.get('overall.judgementSource') as unknown).toBeUndefined();

      expect(answers.get('planning') as unknown).toBeUndefined();
      expect(answers.get('sectionA') as unknown).toBeUndefined();
      expect(answers.get('sectionB') as unknown).toBeUndefined();
      expect(answers.get('domain1a') as unknown).toBeUndefined();
    });

    it('produces output that serializeAnswers can consume', () => {
      const ydoc = new Y.Doc();
      buildNestedROBINSI(ydoc);

      migrateYDocToFlatKeys(ydoc);

      const answers = getAnswersMap(ydoc, 'study-3', 'cl-3');
      const handler = new ROBINSIHandler();
      const serialized = handler.serializeAnswers(answers);

      const planning = serialized.planning as Record<string, unknown>;
      expect(planning.confoundingFactors).toBe('Age, sex, smoking status');

      const sectionA = serialized.sectionA as Record<string, unknown>;
      expect(sectionA.outcome).toBe('Mortality at 12 months');

      const sectionB = serialized.sectionB as Record<string, Record<string, unknown>>;
      expect(sectionB.b1.answer).toBe('Y');
      expect(sectionB.b1.comment).toBe('Well described');
      expect(sectionB.b2.answer).toBe('N');

      const sectionC = serialized.sectionC as Record<string, unknown>;
      expect(sectionC.isPerProtocol).toBe(true);

      const domain1a = serialized.domain1a as Record<string, unknown>;
      expect(domain1a.judgement).toBe('Low');
      expect(domain1a.direction).toBe('favour_experimental');
      const d1aAnswers = domain1a.answers as Record<string, Record<string, unknown>>;
      expect(d1aAnswers.d1a_1.answer).toBe('Y');
    });
  });

  it('is idempotent -- running twice produces the same result', () => {
    const ydoc = new Y.Doc();
    buildNestedAMSTAR2(ydoc);

    migrateYDocToFlatKeys(ydoc);
    const handler = new AMSTAR2Handler();
    const answers = getAnswersMap(ydoc, 'study-1', 'cl-1');
    const first = handler.serializeAnswers(answers);

    migrateYDocToFlatKeys(ydoc);
    const second = handler.serializeAnswers(answers);

    expect(second).toEqual(first);
  });

  it('modifies in-place -- same Y.Map reference after migration', () => {
    const ydoc = new Y.Doc();
    buildNestedAMSTAR2(ydoc);

    const answersBefore = getAnswersMap(ydoc, 'study-1', 'cl-1');
    migrateYDocToFlatKeys(ydoc);
    const answersAfter = getAnswersMap(ydoc, 'study-1', 'cl-1');

    expect(answersBefore).toBe(answersAfter);
  });

  it('handles a Y.Doc with multiple studies and mixed types', () => {
    const ydoc = new Y.Doc();
    buildNestedAMSTAR2(ydoc);
    buildNestedROB2(ydoc);
    buildNestedROBINSI(ydoc);

    migrateYDocToFlatKeys(ydoc);

    const amstarAnswers = getAnswersMap(ydoc, 'study-1', 'cl-1');
    expect(amstarAnswers.get('q1.answers')).toEqual([[true, false], [false]]);

    const rob2Answers = getAnswersMap(ydoc, 'study-2', 'cl-2');
    expect(rob2Answers.get('preliminary.aim')).toBe('Test treatment efficacy');

    const robinsAnswers = getAnswersMap(ydoc, 'study-3', 'cl-3');
    expect(robinsAnswers.get('domain1a.judgement')).toBe('Low');
  });
});
