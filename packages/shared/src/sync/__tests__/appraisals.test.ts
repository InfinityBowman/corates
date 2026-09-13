import { describe, expect, it } from 'vitest';
import { createTestEngine } from '@cf-sync/server/testing';
import { syncApp } from '../app.js';
import { defaultAnswerRows } from '../answer-rows.js';
import { answerRowId } from '../ids.js';
import type { ChecklistAnswerInput } from '../answer-rows.js';

const ROB2_ANSWER: ChecklistAnswerInput = {
  type: 'ROB2',
  key: 'domain1',
  data: { answers: { d1_1: { answer: 'Y', comment: '' } } },
};

const NOW = 1_753_500_000_000;
const LATER = NOW + 60_000;

function newEngine() {
  return createTestEngine(syncApp, {
    principal: 'user-1',
    auth: { role: 'owner', writeAllowed: true },
  });
}

type Engine = ReturnType<typeof newEngine>;

function seedStudy(
  engine: Engine,
  id: string,
  slots: { reviewer1?: string; reviewer2?: string } = {},
) {
  expect(
    engine.mutate('study.create', { id, name: id, description: '', now: NOW }).error,
  ).toBeUndefined();
  if (slots.reviewer1 || slots.reviewer2) {
    expect(engine.mutate('study.update', { id, updates: slots, now: NOW }).error).toBeUndefined();
  }
}

function seedOutcome(engine: Engine, id: string) {
  expect(
    engine.mutate('outcome.create', { id, name: `Outcome ${id}`, createdBy: 'user-1', now: NOW })
      .error,
  ).toBeUndefined();
}

function checklistsOf(engine: Engine, studyId: string) {
  return engine
    .list('checklists')
    .map(row => row.data)
    .filter(c => c.studyId === studyId);
}

/** Id of the reviewer checklist `userId` holds for one cell; materialized ids are engine-minted. */
function heldChecklistId(engine: Engine, studyId: string, userId: string, outcomeId: string) {
  const mine = checklistsOf(engine, studyId).filter(
    c => c.kind === 'reviewer' && c.assignedTo === userId && c.outcomeId === outcomeId,
  );
  expect(mine).toHaveLength(1);
  return mine[0]!.id;
}

function answerCount(engine: Engine, checklistId: string) {
  return engine.list('answers').filter(row => row.data.checklistId === checklistId).length;
}

describe('checklist.create with the plan', () => {
  it('stamps kind, defaults to reviewer, and plans the cell', () => {
    const engine = newEngine();
    seedStudy(engine, 's1');
    seedOutcome(engine, 'o1');
    const result = engine.mutate('checklist.create', {
      id: 'chk-1',
      studyId: 's1',
      type: 'ROB2',
      assignedTo: 'alice',
      outcomeId: 'o1',
      now: NOW,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('checklists', 'chk-1')?.kind).toBe('reviewer');
    expect(engine.get('appraisals', 's1:ROB2:o1')).toMatchObject({
      studyId: 's1',
      type: 'ROB2',
      outcomeId: 'o1',
    });
  });

  it('gives the other slot holder a checklist for the newly planned cell', () => {
    const engine = newEngine();
    seedStudy(engine, 's1', { reviewer1: 'alice', reviewer2: 'bob' });
    seedOutcome(engine, 'o1');
    const result = engine.mutate('checklist.create', {
      id: 'chk-alice',
      studyId: 's1',
      type: 'ROB2',
      assignedTo: 'alice',
      outcomeId: 'o1',
      now: NOW,
    });
    expect(result.error).toBeUndefined();
    const bobs = checklistsOf(engine, 's1').filter(c => c.assignedTo === 'bob');
    expect(bobs).toHaveLength(1);
    expect(bobs[0]).toMatchObject({ status: 'pending', kind: 'reviewer', outcomeId: 'o1' });
    // Alice keeps the id she chose and gets no second checklist.
    expect(
      checklistsOf(engine, 's1')
        .filter(c => c.assignedTo === 'alice')
        .map(c => c.id),
    ).toEqual(['chk-alice']);
  });

  it('a consensus row plans nothing new and materializes nothing', () => {
    const engine = newEngine();
    seedStudy(engine, 's1', { reviewer1: 'alice', reviewer2: 'bob' });
    engine.mutate('checklist.create', {
      id: 'chk-c',
      studyId: 's1',
      type: 'AMSTAR2',
      kind: 'consensus',
      assignedTo: null,
      outcomeId: null,
      now: NOW,
    });
    expect(checklistsOf(engine, 's1')).toHaveLength(1);
  });

  it('allows a consensus row beside a reviewer row for the same cell', () => {
    const engine = newEngine();
    seedStudy(engine, 's1');
    seedOutcome(engine, 'o1');
    engine.mutate('checklist.create', {
      id: 'chk-a',
      studyId: 's1',
      type: 'ROB2',
      assignedTo: 'alice',
      outcomeId: 'o1',
      now: NOW,
    });
    const consensus = engine.mutate('checklist.create', {
      id: 'chk-c',
      studyId: 's1',
      type: 'ROB2',
      kind: 'consensus',
      assignedTo: null,
      outcomeId: 'o1',
      now: NOW,
    });
    expect(consensus.error).toBeUndefined();
    const again = engine.mutate('checklist.create', {
      id: 'chk-c2',
      studyId: 's1',
      type: 'ROB2',
      kind: 'consensus',
      assignedTo: null,
      outcomeId: 'o1',
      now: NOW,
    });
    expect(again.error?.code).toBe('DuplicateChecklist');
    expect(engine.list('appraisals')).toHaveLength(1);
  });
});

describe('appraisal.create', () => {
  it('plans many cells in one commit without creating checklists on unassigned studies', () => {
    const engine = newEngine();
    seedStudy(engine, 's1');
    seedStudy(engine, 's2');
    seedOutcome(engine, 'o1');
    seedOutcome(engine, 'o2');
    const result = engine.mutate('appraisal.create', {
      cells: [
        { studyId: 's1', type: 'ROB2', outcomeId: 'o1' },
        { studyId: 's1', type: 'ROB2', outcomeId: 'o2' },
        { studyId: 's2', type: 'AMSTAR2', outcomeId: null },
      ],
      now: NOW,
    });
    expect(result.error).toBeUndefined();
    expect(
      engine
        .list('appraisals')
        .map(r => r.id)
        .sort(),
    ).toEqual(['s1:ROB2:o1', 's1:ROB2:o2', 's2:type:AMSTAR2']);
    expect(engine.list('checklists')).toHaveLength(0);
    expect(engine.get('studies', 's1')?.updatedAt).toBe(NOW);
  });

  it('materializes a checklist per cell for reviewers already on the study', () => {
    const engine = newEngine();
    seedStudy(engine, 's1', { reviewer1: 'alice', reviewer2: 'bob' });
    seedOutcome(engine, 'o1');
    engine.mutate('appraisal.create', {
      cells: [{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }],
      now: NOW,
    });
    const checklists = checklistsOf(engine, 's1');
    expect(checklists.map(c => c.assignedTo).sort()).toEqual(['alice', 'bob']);
    expect(checklists.every(c => c.kind === 'reviewer' && c.status === 'pending')).toBe(true);
    const aliceId = heldChecklistId(engine, 's1', 'alice', 'o1');
    expect(engine.get('checklists', aliceId)).not.toBeNull();
    expect(answerCount(engine, aliceId)).toBe(Object.keys(defaultAnswerRows('ROB2')).length);
  });

  it('is idempotent: re-planning a cell creates nothing new', () => {
    const engine = newEngine();
    seedStudy(engine, 's1', { reviewer1: 'alice' });
    seedOutcome(engine, 'o1');
    const cells = [{ studyId: 's1', type: 'ROB2' as const, outcomeId: 'o1' }];
    engine.mutate('appraisal.create', { cells, now: NOW });
    engine.mutate('appraisal.create', { cells, now: LATER });
    expect(engine.list('appraisals')).toHaveLength(1);
    expect(checklistsOf(engine, 's1')).toHaveLength(1);
  });

  it('refuses an outcome-based instrument without an outcome, and an unknown outcome', () => {
    const engine = newEngine();
    seedStudy(engine, 's1');
    expect(
      engine.mutate('appraisal.create', {
        cells: [{ studyId: 's1', type: 'ROB2', outcomeId: null }],
        now: NOW,
      }).error?.code,
    ).toBe('OutcomeRequired');
    expect(
      engine.mutate('appraisal.create', {
        cells: [{ studyId: 's1', type: 'ROB2', outcomeId: 'nope' }],
        now: NOW,
      }).error?.code,
    ).toBe('NotFound');
    expect(engine.list('appraisals')).toHaveLength(0);
  });
});

describe('appraisal.delete', () => {
  function planned() {
    const engine = newEngine();
    seedStudy(engine, 's1', { reviewer1: 'alice', reviewer2: 'bob' });
    seedOutcome(engine, 'o1');
    engine.mutate('appraisal.create', {
      cells: [{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }],
      now: NOW,
    });
    return engine;
  }

  it('removes an untouched cell with its pending checklists', () => {
    const engine = planned();
    const result = engine.mutate('appraisal.delete', {
      cells: [{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }],
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('appraisals', 's1:ROB2:o1')).toBeNull();
    expect(checklistsOf(engine, 's1')).toHaveLength(0);
    expect(engine.list('answers')).toHaveLength(0);
  });

  it('refuses a cell with answers unless forced', () => {
    const engine = planned();
    const aliceId = heldChecklistId(engine, 's1', 'alice', 'o1');
    engine.mutate('checklist.updateAnswer', { checklistId: aliceId, input: ROB2_ANSWER, now: NOW });
    const cells = [{ studyId: 's1', type: 'ROB2' as const, outcomeId: 'o1' }];
    expect(engine.mutate('appraisal.delete', { cells, now: LATER }).error?.code).toBe(
      'AppraisalHasAnswers',
    );
    expect(engine.get('appraisals', 's1:ROB2:o1')).not.toBeNull();

    expect(
      engine.mutate('appraisal.delete', { cells, force: true, now: LATER }).error,
    ).toBeUndefined();
    expect(engine.get('appraisals', 's1:ROB2:o1')).toBeNull();
    expect(engine.get('checklists', aliceId)).toBeNull();
    expect(engine.get('answers', answerRowId(aliceId, 'd1_1'))).toBeNull();
  });

  it('treats typed text on a pending checklist as answers', () => {
    const engine = planned();
    const aliceId = heldChecklistId(engine, 's1', 'alice', 'o1');
    engine.mutate('checklist.setText', { checklistId: aliceId, key: 'preliminary.aim', text: 'x' });
    expect(engine.get('checklists', aliceId)?.status).toBe('pending');
    const cells = [{ studyId: 's1', type: 'ROB2' as const, outcomeId: 'o1' }];
    expect(engine.mutate('appraisal.delete', { cells, now: LATER }).error?.code).toBe(
      'AppraisalHasAnswers',
    );
  });
});

describe('study.assignReviewers', () => {
  function plannedStudy(slots: { reviewer1?: string; reviewer2?: string } = {}) {
    const engine = newEngine();
    seedStudy(engine, 's1', slots);
    seedOutcome(engine, 'o1');
    seedOutcome(engine, 'o2');
    engine.mutate('appraisal.create', {
      cells: [
        { studyId: 's1', type: 'ROB2', outcomeId: 'o1' },
        { studyId: 's1', type: 'ROB2', outcomeId: 'o2' },
      ],
      now: NOW,
    });
    return engine;
  }

  it('filling a slot materializes one checklist per planned cell', () => {
    const engine = plannedStudy();
    const result = engine.mutate('study.assignReviewers', {
      id: 's1',
      reviewer1: 'alice',
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('studies', 's1')).toMatchObject({ reviewer1: 'alice', updatedAt: LATER });
    expect(engine.get('studies', 's1')?.reviewer2).toBeUndefined();
    const mine = checklistsOf(engine, 's1');
    expect(mine.map(c => c.outcomeId).sort()).toEqual(['o1', 'o2']);
    expect(mine.every(c => c.assignedTo === 'alice' && c.kind === 'reviewer')).toBe(true);
  });

  it('swapping a slot moves pending checklists to the new holder silently', () => {
    const engine = plannedStudy({ reviewer1: 'alice', reviewer2: 'bob' });
    const bobId = heldChecklistId(engine, 's1', 'bob', 'o1');
    const result = engine.mutate('study.assignReviewers', {
      id: 's1',
      reviewer2: 'carol',
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('checklists', bobId)).toMatchObject({
      assignedTo: 'carol',
      status: 'pending',
    });
    expect(checklistsOf(engine, 's1').filter(c => c.assignedTo === 'carol')).toHaveLength(2);
    expect(checklistsOf(engine, 's1').filter(c => c.assignedTo === 'bob')).toHaveLength(0);
  });

  it('refuses to swap over in-progress work without a policy', () => {
    const engine = plannedStudy({ reviewer1: 'alice', reviewer2: 'bob' });
    const bobId = heldChecklistId(engine, 's1', 'bob', 'o1');
    engine.mutate('checklist.updateAnswer', { checklistId: bobId, input: ROB2_ANSWER, now: NOW });
    const result = engine.mutate('study.assignReviewers', {
      id: 's1',
      reviewer2: 'carol',
      now: LATER,
    });
    expect(result.error?.code).toBe('InProgressChecklists');
    expect(engine.get('studies', 's1')?.reviewer2).toBe('bob');
    expect(engine.get('checklists', bobId)?.assignedTo).toBe('bob');
  });

  it('hands in-progress work over, or discards it with its answers', () => {
    const handOver = plannedStudy({ reviewer1: 'alice', reviewer2: 'bob' });
    const bobId = heldChecklistId(handOver, 's1', 'bob', 'o1');
    handOver.mutate('checklist.updateAnswer', { checklistId: bobId, input: ROB2_ANSWER, now: NOW });
    expect(
      handOver.mutate('study.assignReviewers', {
        id: 's1',
        reviewer2: 'carol',
        onInProgress: 'handOver',
        now: LATER,
      }).error,
    ).toBeUndefined();
    expect(handOver.get('checklists', bobId)).toMatchObject({
      assignedTo: 'carol',
      status: 'in-progress',
    });
    expect(handOver.get('answers', answerRowId(bobId, 'd1_1'))?.value).toBe('Y');

    const discard = plannedStudy({ reviewer1: 'alice', reviewer2: 'bob' });
    const bobId2 = heldChecklistId(discard, 's1', 'bob', 'o1');
    discard.mutate('checklist.updateAnswer', { checklistId: bobId2, input: ROB2_ANSWER, now: NOW });
    expect(
      discard.mutate('study.assignReviewers', {
        id: 's1',
        reviewer2: 'carol',
        onInProgress: 'discard',
        now: LATER,
      }).error,
    ).toBeUndefined();
    expect(discard.get('checklists', bobId2)).toBeNull();
    expect(answerCount(discard, bobId2)).toBe(0);
    // Carol still gets a fresh checklist for the cell.
    expect(discard.get('checklists', heldChecklistId(discard, 's1', 'carol', 'o1'))).toMatchObject({
      status: 'pending',
    });
  });

  it('never touches completed or finalized checklists', () => {
    const engine = plannedStudy({ reviewer1: 'alice', reviewer2: 'bob' });
    const bobO1 = heldChecklistId(engine, 's1', 'bob', 'o1');
    engine.mutate('checklist.update', {
      checklistId: bobO1,
      updates: { status: 'reviewer-completed' },
      now: NOW,
    });
    const result = engine.mutate('study.assignReviewers', {
      id: 's1',
      reviewer2: 'carol',
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('checklists', bobO1)).toMatchObject({
      assignedTo: 'bob',
      status: 'reviewer-completed',
    });
    // Carol gets her own o1 checklist and inherits Bob's pending o2 one.
    const carols = checklistsOf(engine, 's1').filter(c => c.assignedTo === 'carol');
    expect(carols.map(c => c.outcomeId).sort()).toEqual(['o1', 'o2']);
  });

  it('clearing a slot drops pending checklists and keeps the plan', () => {
    const engine = plannedStudy({ reviewer1: 'alice', reviewer2: 'bob' });
    const result = engine.mutate('study.assignReviewers', {
      id: 's1',
      reviewer2: null,
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('studies', 's1')?.reviewer2).toBeUndefined();
    expect(checklistsOf(engine, 's1').filter(c => c.assignedTo === 'bob')).toHaveLength(0);
    expect(engine.list('appraisals')).toHaveLength(2);
  });

  it('exchanging the two slots moves nothing', () => {
    const engine = plannedStudy({ reviewer1: 'alice', reviewer2: 'bob' });
    const before = checklistsOf(engine, 's1');
    const result = engine.mutate('study.assignReviewers', {
      id: 's1',
      reviewer1: 'bob',
      reviewer2: 'alice',
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(checklistsOf(engine, 's1')).toEqual(before);
    expect(engine.get('studies', 's1')).toMatchObject({ reviewer1: 'bob', reviewer2: 'alice' });
  });

  it('rejects one person in both slots', () => {
    const engine = plannedStudy();
    const result = engine.mutate('study.assignReviewers', {
      id: 's1',
      reviewer1: 'alice',
      reviewer2: 'alice',
      now: LATER,
    });
    expect(result.error?.code).toBe('DuplicateReviewer');
  });
});

describe('plan cascades', () => {
  it('study.delete removes the plan rows', () => {
    const engine = newEngine();
    seedStudy(engine, 's1');
    engine.mutate('appraisal.create', {
      cells: [{ studyId: 's1', type: 'AMSTAR2', outcomeId: null }],
      now: NOW,
    });
    engine.mutate('study.delete', { id: 's1' });
    expect(engine.list('appraisals')).toHaveLength(0);
  });

  it('outcome.delete takes unstarted plan rows with it but still refuses checklists', () => {
    const engine = newEngine();
    seedStudy(engine, 's1', { reviewer1: 'alice' });
    seedOutcome(engine, 'o1');
    engine.mutate('appraisal.create', {
      cells: [{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }],
      now: NOW,
    });
    expect(engine.mutate('outcome.delete', { id: 'o1' }).error?.code).toBe('OutcomeInUse');

    engine.mutate('checklist.delete', {
      checklistId: heldChecklistId(engine, 's1', 'alice', 'o1'),
      now: LATER,
    });
    expect(engine.mutate('outcome.delete', { id: 'o1' }).error).toBeUndefined();
    expect(engine.get('appraisals', 's1:ROB2:o1')).toBeNull();
  });

  it('checklist.changeOutcome moves the plan row', () => {
    const engine = newEngine();
    seedStudy(engine, 's1', { reviewer1: 'alice' });
    seedOutcome(engine, 'o1');
    seedOutcome(engine, 'o2');
    engine.mutate('appraisal.create', {
      cells: [{ studyId: 's1', type: 'ROB2', outcomeId: 'o1' }],
      now: NOW,
    });
    const result = engine.mutate('checklist.changeOutcome', {
      studyId: 's1',
      type: 'ROB2',
      fromOutcomeId: 'o1',
      toOutcomeId: 'o2',
      now: LATER,
    });
    expect(result.error).toBeUndefined();
    expect(engine.get('appraisals', 's1:ROB2:o1')).toBeNull();
    expect(engine.get('appraisals', 's1:ROB2:o2')).toMatchObject({ outcomeId: 'o2' });
  });
});
