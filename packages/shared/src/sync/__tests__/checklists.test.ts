import { describe, expect, it } from 'vitest';
import { createTestEngine } from '@cf-sync/server/testing';
import { syncApp } from '../app.js';
import { defaultAnswerRows, textAnswerKeys, type ChecklistAnswerInput } from '../answer-rows.js';
import { answerRowId, reconciliationRowId } from '../ids.js';

const NOW = 1_753_500_000_000;
const LATER = NOW + 60_000;

function newEngine() {
  return createTestEngine(syncApp, {
    principal: 'user-1',
    auth: { role: 'owner', writeAllowed: true },
  });
}

type Engine = ReturnType<typeof newEngine>;

function seedStudy(engine: Engine, id = 'study-1') {
  const result = engine.mutate('study.create', { id, name: 'Trial A', description: '', now: NOW });
  expect(result.error).toBeUndefined();
  return id;
}

function answersFor(engine: Engine, checklistId: string) {
  return new Map(
    engine
      .list('answers')
      .filter(row => row.data.checklistId === checklistId)
      .map(row => [row.data.key, row.data.value]),
  );
}

describe('checklist.create', () => {
  it('creates the checklist row with pending status and the type title', () => {
    const engine = newEngine();
    seedStudy(engine);
    const result = engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'AMSTAR2',
      assignedTo: 'user-2',
      outcomeId: null,
      now: NOW,
    });
    expect(result.error).toBeUndefined();

    const checklist = engine.get('checklists', 'chk-1');
    expect(checklist).toMatchObject({
      studyId: 'study-1',
      type: 'AMSTAR2',
      title: 'AMSTAR2 Checklist',
      assignedTo: 'user-2',
      status: 'pending',
      outcomeId: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(engine.get('studies', 'study-1')?.updatedAt).toBe(NOW);
  });

  it('materializes the full AMSTAR2 default answer map, one row per flat key', () => {
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'AMSTAR2',
      assignedTo: null,
      outcomeId: null,
      now: NOW,
    });

    const answers = answersFor(engine, 'chk-1');
    const defaults = defaultAnswerRows('AMSTAR2');
    expect(answers.size).toBe(Object.keys(defaults).length);

    // The q1 answer grid comes straight from the shared template.
    expect(answers.get('q1.answers')).toEqual([
      [false, false, false, false],
      [false],
      [false, false],
    ]);
    expect(answers.get('q2.critical')).toBe(true);
    // Sub-questions share their parent's note: q9a/q9b have none, q9 does.
    expect(answers.has('q9a.note')).toBe(false);
    expect(answers.get('q9.note')).toBe('');
    expect(answers.get('q16.note')).toBe('');
  });

  it('materializes ROB2 defaults without any stored judgement keys', () => {
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('outcome.create', {
      id: 'out-1',
      name: 'Mortality',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: null,
      outcomeId: 'out-1',
      now: NOW,
    });

    const answers = answersFor(engine, 'chk-1');
    expect(answers.get('preliminary.aim')).toBeNull();
    expect(answers.get('preliminary.sources')).toBeTypeOf('object');
    expect(answers.get('preliminary.experimental')).toBe('');
    expect(answers.get('domain1.direction')).toBeNull();
    expect(answers.get('overall.direction')).toBeNull();
    // ROB2 judgements are derived by scoring, never stored.
    for (const key of answers.keys()) {
      expect(key).not.toMatch(/judgement/);
    }
    // Every domain question landed as a bare key plus its comment.
    const bareKeys = [...answers.keys()].filter(
      key => /^d\d+[a-z]?_/.test(key) && !key.includes('.'),
    );
    expect(bareKeys.length).toBeGreaterThan(0);
    for (const key of bareKeys) {
      expect(answers.get(key)).toBeNull();
      expect(answers.get(`${key}.comment`)).toBe('');
    }
  });

  it('materializes ROBINS-I defaults and prefills sectionA.outcome with the outcome name', () => {
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('outcome.create', {
      id: 'out-1',
      name: 'Mortality',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROBINS_I',
      assignedTo: null,
      outcomeId: 'out-1',
      now: NOW,
    });

    const answers = answersFor(engine, 'chk-1');
    expect(answers.get('domain1a.judgement')).toBeNull();
    expect(answers.get('sectionB.b1')).toBeNull();
    expect(answers.get('sectionB.b1.comment')).toBe('');
    expect(answers.get('sectionB.stopAssessment')).toBe(false);
    expect(answers.get('sectionC.isPerProtocol')).toBe(false);
    expect(answers.get('sectionA.outcome')).toBe('Mortality');
  });

  it('rejects outcome-scoped types without an outcome', () => {
    const engine = newEngine();
    seedStudy(engine);
    const result = engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: null,
      outcomeId: null,
      now: NOW,
    });
    expect(result.error?.code).toBe('OutcomeRequired');
    expect(engine.get('checklists', 'chk-1')).toBeNull();
    // Invariant 2: a permanent rejection still advances the mutation id.
    expect(engine.lastMutationId()).toBe(2);
  });

  it('rejects a duplicate (type, outcome, assignee) checklist', () => {
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('outcome.create', {
      id: 'out-1',
      name: 'Mortality',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: 'user-2',
      outcomeId: 'out-1',
      now: NOW,
    });
    const duplicate = engine.mutate('checklist.create', {
      id: 'chk-2',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: 'user-2',
      outcomeId: 'out-1',
      now: NOW,
    });
    expect(duplicate.error?.code).toBe('DuplicateChecklist');
    expect(engine.get('checklists', 'chk-2')).toBeNull();
  });

  it('rejects a duplicate reconciled (assignedTo: null) checklist for the same outcome', () => {
    // The concurrent-reconcile-open race: both reviewers create the consensus
    // checklist; the loser must be rejected and roll back, and the client
    // adopts the winner (ReconciliationWrapper's repair effect).
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('outcome.create', {
      id: 'out-1',
      name: 'Mortality',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('checklist.create', {
      id: 'chk-consensus-1',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: null,
      outcomeId: 'out-1',
      now: NOW,
    });
    const duplicate = engine.mutate('checklist.create', {
      id: 'chk-consensus-2',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: null,
      outcomeId: 'out-1',
      now: LATER,
    });
    expect(duplicate.error?.code).toBe('DuplicateChecklist');
    expect(engine.get('checklists', 'chk-consensus-2')).toBeNull();
    expect(engine.get('checklists', 'chk-consensus-1')).not.toBeNull();
  });
});

describe('checklist.updateAnswer', () => {
  function createAmstar2(engine: Engine) {
    seedStudy(engine);
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'AMSTAR2',
      assignedTo: null,
      outcomeId: null,
      now: NOW,
    });
  }

  it('expands an AMSTAR2 answer to its flat-key rows and auto-advances pending → in-progress', () => {
    const engine = newEngine();
    createAmstar2(engine);
    const grid = [[true, false, false, false], [false], [true, false]];
    const result = engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: { type: 'AMSTAR2', key: 'q1', data: { answers: grid, critical: true } },
      now: LATER,
    });
    expect(result.error).toBeUndefined();

    expect(engine.get('answers', answerRowId('chk-1', 'q1.answers'))?.value).toEqual(grid);
    expect(engine.get('answers', answerRowId('chk-1', 'q1.critical'))?.value).toBe(true);
    expect(engine.get('checklists', 'chk-1')).toMatchObject({
      status: 'in-progress',
      updatedAt: LATER,
    });
  });

  it('writes only the fields present in an AMSTAR2 update (answer/critical never clobber each other)', () => {
    const engine = newEngine();
    createAmstar2(engine);
    const grid = [[true, false, false, false], [false], [true, false]];
    engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: { type: 'AMSTAR2', key: 'q1', data: { answers: grid, critical: true } },
      now: LATER,
    });

    // An answers-only update leaves the critical row untouched...
    const nextGrid = [[false, true, false, false], [true], [false, true]];
    engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: { type: 'AMSTAR2', key: 'q1', data: { answers: nextGrid } },
      now: LATER,
    });
    expect(engine.get('answers', answerRowId('chk-1', 'q1.critical'))?.value).toBe(true);

    // ...and a critical-only update leaves the answers row untouched.
    engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: { type: 'AMSTAR2', key: 'q1', data: { critical: false } },
      now: LATER,
    });
    expect(engine.get('answers', answerRowId('chk-1', 'q1.answers'))?.value).toEqual(nextGrid);
    expect(engine.get('answers', answerRowId('chk-1', 'q1.critical'))?.value).toBe(false);
  });

  it('does not touch the note row on an answer update', () => {
    const engine = newEngine();
    createAmstar2(engine);
    engine.mutate('checklist.setText', { checklistId: 'chk-1', key: 'q1.note', text: 'my note' });
    engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: { type: 'AMSTAR2', key: 'q1', data: { answers: [[true]], critical: false } },
      now: LATER,
    });
    expect(engine.get('answers', answerRowId('chk-1', 'q1.note'))?.value).toBe('my note');
  });

  it('writes ROB2 domain answers as bare keys and the direction key', () => {
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('outcome.create', {
      id: 'out-1',
      name: 'Mortality',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: null,
      outcomeId: 'out-1',
      now: NOW,
    });
    const bareKey = [...answersFor(engine, 'chk-1').keys()].find(
      key => /^d1_/.test(key) && !key.includes('.'),
    );
    expect(bareKey).toBeDefined();

    const result = engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: {
        type: 'ROB2',
        key: 'domain1',
        data: { direction: 'favours-experimental', answers: { [bareKey!]: { answer: 'Y' } } },
      } as ChecklistAnswerInput,
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('answers', answerRowId('chk-1', bareKey!))?.value).toBe('Y');
    expect(engine.get('answers', answerRowId('chk-1', 'domain1.direction'))?.value).toBe(
      'favours-experimental',
    );
  });

  it('rejects a payload that fails the instrument schema, still advancing the mutation id', () => {
    const engine = newEngine();
    createAmstar2(engine);
    const before = engine.lastMutationId();
    const result = engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: {
        type: 'AMSTAR2',
        key: 'q1',
        data: { answers: 'nope' },
      } as unknown as ChecklistAnswerInput,
      now: LATER,
    });
    expect(result.error?.code).toBe('InvalidArgs');
    expect(engine.lastMutationId()).toBe(before + 1);
    expect(engine.get('checklists', 'chk-1')?.status).toBe('pending');
  });

  it('rejects an unknown key as InvalidArgs', () => {
    const engine = newEngine();
    createAmstar2(engine);
    const result = engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: {
        type: 'AMSTAR2',
        key: 'q99',
        data: { answers: [] },
      } as unknown as ChecklistAnswerInput,
      now: LATER,
    });
    expect(result.error?.code).toBe('InvalidArgs');
  });

  it('rejects an update whose instrument does not match the checklist', () => {
    const engine = newEngine();
    createAmstar2(engine);
    const result = engine.mutate('checklist.updateAnswer', {
      checklistId: 'chk-1',
      input: { type: 'ROB2', key: 'overall', data: { direction: null } } as ChecklistAnswerInput,
      now: LATER,
    });
    expect(result.error?.code).toBe('TypeMismatch');
  });
});

describe('checklist.setText', () => {
  it('stores the text, truncated to maxLength, without bumping checklist.updatedAt', () => {
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'AMSTAR2',
      assignedTo: null,
      outcomeId: null,
      now: NOW,
    });

    const result = engine.mutate('checklist.setText', {
      checklistId: 'chk-1',
      key: 'q1.note',
      text: 'x'.repeat(3000),
    });
    expect(result.error).toBeUndefined();
    const stored = engine.get('answers', answerRowId('chk-1', 'q1.note'))?.value;
    expect(typeof stored).toBe('string');
    expect((stored as string).length).toBe(2000);
    // Text writes never bumped checklist.updatedAt on the Y.Doc plane either.
    expect(engine.get('checklists', 'chk-1')?.updatedAt).toBe(NOW);
  });
});

describe('textAnswerKeys', () => {
  it('enumerates exactly the keys defaultAnswerRows seeds as the empty string', () => {
    for (const type of ['AMSTAR2', 'ROB2', 'ROBINS_I'] as const) {
      const keys = textAnswerKeys(type);
      const defaults = defaultAnswerRows(type);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(defaults[key]).toBe('');
      // And nothing text-shaped is missed: every '' default is enumerated.
      const emptyDefaults = Object.keys(defaults).filter(key => defaults[key] === '');
      expect(new Set(keys)).toEqual(new Set(emptyDefaults));
    }
  });

  it('covers the note/comment keys reconciliation co-edits', () => {
    expect(textAnswerKeys('AMSTAR2')).toContain('q1.note');
    expect(textAnswerKeys('ROB2')).toContain('d1_1.comment');
    expect(textAnswerKeys('ROB2')).toContain('preliminary.experimental');
    expect(textAnswerKeys('ROBINS_I')).toContain('planning.confoundingFactors');
  });
});

describe('checklist.changeOutcome', () => {
  function setup(engine: Engine) {
    seedStudy(engine);
    engine.mutate('outcome.create', {
      id: 'out-1',
      name: 'Mortality',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('outcome.create', {
      id: 'out-2',
      name: 'Quality of life',
      createdBy: 'user-1',
      now: NOW,
    });
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'ROBINS_I',
      assignedTo: 'user-1',
      outcomeId: 'out-1',
      now: NOW,
    });
    engine.mutate('checklist.create', {
      id: 'chk-2',
      studyId: 'study-1',
      type: 'ROBINS_I',
      assignedTo: 'user-2',
      outcomeId: 'out-1',
      now: NOW,
    });
  }

  it('moves every checklist of the group and re-keys the reconciliation row', () => {
    const engine = newEngine();
    setup(engine);
    engine.mutate('reconciliation.saveProgress', {
      studyId: 'study-1',
      outcomeId: 'out-1',
      type: 'ROBINS_I',
      data: { checklist1Id: 'chk-1', checklist2Id: 'chk-2' },
      now: NOW,
    });

    const result = engine.mutate('checklist.changeOutcome', {
      studyId: 'study-1',
      type: 'ROBINS_I',
      fromOutcomeId: 'out-1',
      toOutcomeId: 'out-2',
      now: LATER,
    });
    expect(result.error).toBeUndefined();

    expect(engine.get('checklists', 'chk-1')).toMatchObject({
      outcomeId: 'out-2',
      updatedAt: LATER,
    });
    expect(engine.get('checklists', 'chk-2')?.outcomeId).toBe('out-2');
    expect(engine.get('reconciliations', reconciliationRowId('study-1', 'out-1'))).toBeNull();
    expect(engine.get('reconciliations', reconciliationRowId('study-1', 'out-2'))).toMatchObject({
      outcomeId: 'out-2',
      outcomeKey: 'out-2',
      checklist1Id: 'chk-1',
      checklist2Id: 'chk-2',
    });
  });

  it('rewrites the auto-filled sectionA.outcome but never user-edited text', () => {
    const engine = newEngine();
    setup(engine);
    engine.mutate('checklist.setText', {
      checklistId: 'chk-2',
      key: 'sectionA.outcome',
      text: 'My custom outcome text',
    });

    engine.mutate('checklist.changeOutcome', {
      studyId: 'study-1',
      type: 'ROBINS_I',
      fromOutcomeId: 'out-1',
      toOutcomeId: 'out-2',
      now: LATER,
    });

    expect(engine.get('answers', answerRowId('chk-1', 'sectionA.outcome'))?.value).toBe(
      'Quality of life',
    );
    expect(engine.get('answers', answerRowId('chk-2', 'sectionA.outcome'))?.value).toBe(
      'My custom outcome text',
    );
  });

  it('guards: type without outcomes, same outcome, missing target, empty group', () => {
    const engine = newEngine();
    setup(engine);
    expect(
      engine.mutate('checklist.changeOutcome', {
        studyId: 'study-1',
        type: 'AMSTAR2',
        fromOutcomeId: 'out-1',
        toOutcomeId: 'out-2',
        now: LATER,
      }).error?.code,
    ).toBe('InvalidOutcomeChange');
    expect(
      engine.mutate('checklist.changeOutcome', {
        studyId: 'study-1',
        type: 'ROBINS_I',
        fromOutcomeId: 'out-1',
        toOutcomeId: 'out-1',
        now: LATER,
      }).error?.code,
    ).toBe('InvalidOutcomeChange');
    expect(
      engine.mutate('checklist.changeOutcome', {
        studyId: 'study-1',
        type: 'ROBINS_I',
        fromOutcomeId: 'out-1',
        toOutcomeId: 'out-missing',
        now: LATER,
      }).error?.code,
    ).toBe('NotFound');
    expect(
      engine.mutate('checklist.changeOutcome', {
        studyId: 'study-1',
        type: 'ROBINS_I',
        fromOutcomeId: 'out-2',
        toOutcomeId: 'out-1',
        now: LATER,
      }).error?.code,
    ).toBe('NotFound');
  });

  it('blocks the move while reconciliation is in progress', () => {
    const engine = newEngine();
    setup(engine);
    engine.mutate('checklist.update', {
      checklistId: 'chk-1',
      updates: { status: 'reconciling' },
      now: NOW,
    });
    const result = engine.mutate('checklist.changeOutcome', {
      studyId: 'study-1',
      type: 'ROBINS_I',
      fromOutcomeId: 'out-1',
      toOutcomeId: 'out-2',
      now: LATER,
    });
    expect(result.error?.code).toBe('ReconciliationInProgress');
  });

  it('blocks the move when a reviewer already has a checklist under the target outcome', () => {
    const engine = newEngine();
    setup(engine);
    engine.mutate('checklist.create', {
      id: 'chk-3',
      studyId: 'study-1',
      type: 'ROBINS_I',
      assignedTo: 'user-1',
      outcomeId: 'out-2',
      now: NOW,
    });
    const result = engine.mutate('checklist.changeOutcome', {
      studyId: 'study-1',
      type: 'ROBINS_I',
      fromOutcomeId: 'out-1',
      toOutcomeId: 'out-2',
      now: LATER,
    });
    expect(result.error?.code).toBe('AssigneeConflict');
  });
});

describe('checklist.delete', () => {
  it('removes the checklist and its answer rows; deleting again is a no-op', () => {
    const engine = newEngine();
    seedStudy(engine);
    engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 'study-1',
      type: 'AMSTAR2',
      assignedTo: null,
      outcomeId: null,
      now: NOW,
    });
    expect(answersFor(engine, 'chk-1').size).toBeGreaterThan(0);

    const result = engine.mutate('checklist.delete', { checklistId: 'chk-1', now: LATER });
    expect(result.error).toBeUndefined();
    expect(engine.get('checklists', 'chk-1')).toBeNull();
    expect(answersFor(engine, 'chk-1').size).toBe(0);
    expect(engine.get('studies', 'study-1')?.updatedAt).toBe(LATER);

    expect(
      engine.mutate('checklist.delete', { checklistId: 'chk-1', now: LATER }).error,
    ).toBeUndefined();
  });
});
