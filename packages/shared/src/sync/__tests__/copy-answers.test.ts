import { describe, expect, it } from 'vitest';
import { createTestEngine } from '@cf-sync/server/testing';
import { syncApp } from '../app.js';
import { defaultAnswerRows, type ChecklistAnswerInput } from '../answer-rows.js';
import { isCarryOverKey, planAnswerCopy } from '../copy-answers.js';
import { answerRowId } from '../ids.js';

const NOW = 1_753_500_000_000;
const LATER = NOW + 60_000;

function newEngine() {
  return createTestEngine(syncApp, {
    principal: 'user-1',
    auth: { role: 'owner', writeAllowed: true },
  });
}

type Engine = ReturnType<typeof newEngine>;

function answersFor(engine: Engine, checklistId: string) {
  return new Map(
    engine
      .list('answers')
      .filter(row => row.data.checklistId === checklistId)
      .map(row => [row.data.key, row.data.value]),
  );
}

/** One study, two outcomes, and one reviewer's checklist on each. */
function seedPair(engine: Engine, type: 'ROB2' | 'ROBINS_I', assignedTo = 'user-2') {
  engine.mutate('study.create', { id: 'study-1', name: 'Trial A', description: '', now: NOW });
  for (const [id, name] of [
    ['out-1', 'Mortality'],
    ['out-2', 'Quality of life'],
  ]) {
    engine.mutate('outcome.create', { id, name, createdBy: 'user-1', now: NOW });
  }
  for (const [id, outcomeId] of [
    ['chk-1', 'out-1'],
    ['chk-2', 'out-2'],
  ]) {
    const result = engine.mutate('checklist.create', {
      id,
      studyId: 'study-1',
      type,
      assignedTo,
      outcomeId,
      now: NOW,
    });
    expect(result.error).toBeUndefined();
  }
}

function answer(engine: Engine, checklistId: string, input: ChecklistAnswerInput) {
  const result = engine.mutate('checklist.updateAnswer', { checklistId, input, now: NOW });
  expect(result.error).toBeUndefined();
}

function setText(engine: Engine, checklistId: string, key: string, text: string) {
  const result = engine.mutate('checklist.setText', { checklistId, key, text });
  expect(result.error).toBeUndefined();
}

function fillRob2Source(engine: Engine, checklistId = 'chk-1') {
  answer(engine, checklistId, {
    type: 'ROB2',
    key: 'preliminary',
    data: { aim: 'ASSIGNMENT', studyDesign: 'parallel' },
  });
  answer(engine, checklistId, {
    type: 'ROB2',
    key: 'domain1',
    data: {
      direction: 'favours-experimental',
      answers: { d1_1: { answer: 'Y' }, d1_2: { answer: 'PY' } },
    },
  });
  setText(engine, checklistId, 'd1_1.comment', 'Computer generated');
  setText(engine, checklistId, 'preliminary.numericalResult', 'RR 1.5');
  answer(engine, checklistId, {
    type: 'ROB2',
    key: 'domain2a',
    data: { answers: { d2a_1: { answer: 'N' } } },
  });
  answer(engine, checklistId, {
    type: 'ROB2',
    key: 'domain3',
    data: { answers: { d3_1: { answer: 'Y' } } },
  });
}

function copy(engine: Engine, sections: string[], overrides: Record<string, unknown> = {}) {
  return engine.mutate('checklist.copyAnswers', {
    fromChecklistId: 'chk-1',
    toChecklistId: 'chk-2',
    sections,
    now: LATER,
    ...overrides,
  });
}

describe('checklist.copyAnswers', () => {
  it('copies the study-level sections and leaves the per-outcome ones blank', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);

    const result = copy(engine, ['preliminary', 'domain1', 'domain2']);
    expect(result.error).toBeUndefined();

    const target = answersFor(engine, 'chk-2');
    expect(target.get('preliminary.aim')).toBe('ASSIGNMENT');
    expect(target.get('preliminary.studyDesign')).toBe('parallel');
    expect(target.get('d1_1')).toBe('Y');
    expect(target.get('d1_1.comment')).toBe('Computer generated');
    expect(target.get('d1_2')).toBe('PY');
    expect(target.get('domain1.direction')).toBe('favours-experimental');
    expect(target.get('d2a_1')).toBe('N');
    // The numerical result and domain 3 belong to the outcome.
    expect(target.get('preliminary.numericalResult')).toBe('');
    expect(target.get('d3_1')).toBeNull();

    const checklist = engine.get('checklists', 'chk-2');
    expect(checklist).toMatchObject({ status: 'in-progress', updatedAt: LATER });
    expect(checklist?.copiedFrom?.['d1_1']).toBe('chk-1');
    expect(checklist?.copiedFrom?.['preliminary.aim']).toBe('chk-1');
    expect(checklist?.copiedFrom?.['d3_1']).toBeUndefined();
    // The source is untouched.
    expect(engine.get('checklists', 'chk-1')?.copiedFrom).toBeUndefined();
  });

  it('copies only the requested sections', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);

    expect(copy(engine, ['domain1']).error).toBeUndefined();

    const target = answersFor(engine, 'chk-2');
    expect(target.get('d1_1')).toBe('Y');
    expect(target.get('preliminary.aim')).toBeNull();
    expect(target.get('d2a_1')).toBeNull();
  });

  it('never overwrites a section the target already has answers in', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    answer(engine, 'chk-2', {
      type: 'ROB2',
      key: 'domain1',
      data: { answers: { d1_1: { answer: 'N' } } },
    });

    expect(copy(engine, ['preliminary', 'domain1']).error).toBeUndefined();

    const target = answersFor(engine, 'chk-2');
    expect(target.get('d1_1')).toBe('N');
    expect(target.get('d1_2')).toBeNull();
    expect(target.get('preliminary.aim')).toBe('ASSIGNMENT');
    expect(engine.get('checklists', 'chk-2')?.copiedFrom?.['d1_1']).toBeUndefined();
  });

  it('skips domain 2 when the target is being assessed under a different aim', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    answer(engine, 'chk-2', { type: 'ROB2', key: 'preliminary', data: { aim: 'ADHERING' } });

    expect(copy(engine, ['preliminary', 'domain1', 'domain2']).error).toBeUndefined();

    const target = answersFor(engine, 'chk-2');
    expect(target.get('preliminary.aim')).toBe('ADHERING');
    expect(target.get('d1_1')).toBe('Y');
    expect(target.get('d2a_1')).toBeNull();
  });

  it('copies domain 2 when the aim arrives with the preliminary section', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);

    expect(copy(engine, ['preliminary', 'domain2']).error).toBeUndefined();
    expect(answersFor(engine, 'chk-2').get('d2a_1')).toBe('N');
  });

  it('pulls a single answer with its comment, replacing what is there', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    answer(engine, 'chk-2', {
      type: 'ROB2',
      key: 'domain1',
      data: { answers: { d1_1: { answer: 'N' } } },
    });

    const result = copy(engine, [], { keys: ['d1_1', 'd1_1.comment'] });
    expect(result.error).toBeUndefined();

    const target = answersFor(engine, 'chk-2');
    expect(target.get('d1_1')).toBe('Y');
    expect(target.get('d1_1.comment')).toBe('Computer generated');
    expect(target.get('d1_2')).toBeNull();
    const checklist = engine.get('checklists', 'chk-2');
    expect(checklist?.copiedFrom).toEqual({ d1_1: 'chk-1', 'd1_1.comment': 'chk-1' });
    expect(checklist?.status).toBe('in-progress');
  });

  it('drops the provenance mark once the reviewer writes that answer themselves', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    expect(copy(engine, ['domain1']).error).toBeUndefined();

    answer(engine, 'chk-2', {
      type: 'ROB2',
      key: 'domain1',
      data: { answers: { d1_1: { answer: 'N' } } },
    });
    setText(engine, 'chk-2', 'd1_1.comment', 'Re-read the methods');

    const copiedFrom = engine.get('checklists', 'chk-2')?.copiedFrom ?? {};
    expect(copiedFrom['d1_1']).toBeUndefined();
    expect(copiedFrom['d1_1.comment']).toBeUndefined();
    expect(copiedFrom['d1_2']).toBe('chk-1');
    expect(copiedFrom['domain1.direction']).toBe('chk-1');
  });

  it('pulls a per-outcome answer one at a time even though it never bulk-copies', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    expect(copy(engine, [], { keys: ['d3_1'] }).error).toBeUndefined();
    expect(answersFor(engine, 'chk-2').get('d3_1')).toBe('Y');
  });

  it('rejects an unknown answer key and an empty request', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    expect(copy(engine, [], { keys: ['nope'] }).error?.code).toBe('InvalidArgs');
    expect(copy(engine, []).error?.code).toBe('InvalidArgs');
  });

  it('rejects when nothing is left to copy', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    const result = copy(engine, ['domain1']);
    expect(result.error?.code).toBe('NothingToCopy');
    expect(engine.get('checklists', 'chk-2')?.status).toBe('pending');
  });

  it('rejects an unknown section', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    expect(copy(engine, ['domain4']).error?.code).toBe('InvalidArgs');
  });

  it('rejects a source on the same outcome, another study, or another instrument', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    expect(copy(engine, ['domain1'], { toChecklistId: 'chk-1' }).error?.code).toBe('InvalidSource');

    engine.mutate('study.create', { id: 'study-2', name: 'Trial B', description: '', now: NOW });
    engine.mutate('checklist.create', {
      id: 'chk-other-study',
      studyId: 'study-2',
      type: 'ROB2',
      assignedTo: 'user-2',
      outcomeId: 'out-2',
      now: NOW,
    });
    expect(copy(engine, ['domain1'], { toChecklistId: 'chk-other-study' }).error?.code).toBe(
      'InvalidSource',
    );

    engine.mutate('checklist.create', {
      id: 'chk-robins',
      studyId: 'study-1',
      type: 'ROBINS_I',
      assignedTo: 'user-2',
      outcomeId: 'out-2',
      now: NOW,
    });
    expect(copy(engine, ['domain1'], { toChecklistId: 'chk-robins' }).error?.code).toBe(
      'InvalidSource',
    );
  });

  it("rejects a co-reviewer's checklist and the consensus checklist as sources", () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    engine.mutate('checklist.create', {
      id: 'chk-partner',
      studyId: 'study-1',
      type: 'ROB2',
      assignedTo: 'user-3',
      outcomeId: 'out-2',
      now: NOW,
    });
    expect(copy(engine, ['domain1'], { toChecklistId: 'chk-partner' }).error?.code).toBe(
      'InvalidSource',
    );

    engine.mutate('checklist.create', {
      id: 'chk-consensus',
      studyId: 'study-1',
      type: 'ROB2',
      kind: 'consensus',
      assignedTo: null,
      outcomeId: 'out-1',
      now: NOW,
    });
    expect(copy(engine, ['domain1'], { fromChecklistId: 'chk-consensus' }).error?.code).toBe(
      'InvalidSource',
    );
  });

  it('rejects a target that is no longer editable', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    fillRob2Source(engine);
    engine.mutate('checklist.update', {
      checklistId: 'chk-2',
      updates: { status: 'reviewer-completed' },
      now: NOW,
    });
    expect(copy(engine, ['domain1']).error?.code).toBe('NotEditable');
  });

  it('rejects a missing checklist', () => {
    const engine = newEngine();
    seedPair(engine, 'ROB2');
    expect(copy(engine, ['domain1'], { fromChecklistId: 'nope' }).error?.code).toBe('NotFound');
  });

  it('copies ROBINS-I study-level sections and keeps the prefilled outcome name', () => {
    const engine = newEngine();
    seedPair(engine, 'ROBINS_I');
    setText(engine, 'chk-1', 'planning.confoundingFactors', 'Age, sex');
    answer(engine, 'chk-1', { type: 'ROBINS_I', key: 'sectionC', data: { isPerProtocol: true } });
    setText(engine, 'chk-1', 'sectionC.participants', 'Adults');
    answer(engine, 'chk-1', { type: 'ROBINS_I', key: 'sectionB', data: { b1: { answer: 'Y' } } });
    answer(engine, 'chk-1', {
      type: 'ROBINS_I',
      key: 'domain1b',
      data: { judgement: 'Low', answers: { d1b_1: { answer: 'Y' } } },
    });
    answer(engine, 'chk-1', {
      type: 'ROBINS_I',
      key: 'domain4',
      data: { answers: { d4_1: { answer: 'Y' } } },
    });

    const result = copy(engine, ['planning', 'sectionC', 'sectionD', 'domain1', 'domain2']);
    expect(result.error).toBeUndefined();

    const target = answersFor(engine, 'chk-2');
    expect(target.get('planning.confoundingFactors')).toBe('Age, sex');
    expect(target.get('sectionC.isPerProtocol')).toBe(true);
    expect(target.get('sectionC.participants')).toBe('Adults');
    expect(target.get('domain1b.judgement')).toBe('Low');
    expect(target.get('d1b_1')).toBe('Y');
    // Section A names this outcome, section B asks about its measurement,
    // and domain 4 is missing data for it.
    expect(target.get('sectionA.outcome')).toBe('Quality of life');
    expect(target.get('sectionB.b1')).toBeNull();
    expect(target.get('d4_1')).toBeNull();
  });

  it('skips ROBINS-I domain 1 when the effect of interest differs', () => {
    const engine = newEngine();
    seedPair(engine, 'ROBINS_I');
    answer(engine, 'chk-1', { type: 'ROBINS_I', key: 'sectionC', data: { isPerProtocol: true } });
    answer(engine, 'chk-1', {
      type: 'ROBINS_I',
      key: 'domain1b',
      data: { answers: { d1b_1: { answer: 'Y' } } },
    });
    setText(engine, 'chk-2', 'sectionC.participants', 'Children');

    expect(copy(engine, ['sectionC', 'domain1']).error?.code).toBe('NothingToCopy');
    expect(answersFor(engine, 'chk-2').get('d1b_1')).toBeNull();
  });
});

describe('planAnswerCopy', () => {
  const defaults = defaultAnswerRows('ROB2');

  it('names every carry-over section with the reason it will not copy', () => {
    const source = { ...defaults, d1_1: 'Y', 'preliminary.aim': 'ASSIGNMENT', d2a_1: 'N' };
    const target = { ...defaults, d1_2: 'PY', 'preliminary.aim': 'ADHERING' };
    const plan = planAnswerCopy('ROB2', source, target);
    expect(plan.map(entry => [entry.section.id, entry.blocker])).toEqual([
      ['preliminary', 'target-answered'],
      ['domain1', 'target-answered'],
      ['domain2', 'mismatch'],
    ]);
  });

  it('reports a blank source and resolves the aim through a copying preliminary', () => {
    const source = { ...defaults, 'preliminary.aim': 'ASSIGNMENT', d2a_1: 'N' };
    const plan = planAnswerCopy('ROB2', source, defaults);
    expect(plan.map(entry => [entry.section.id, entry.blocker])).toEqual([
      ['preliminary', null],
      ['domain1', 'source-empty'],
      ['domain2', null],
    ]);
    expect(plan[2]!.keys).toContain('d2a_1');
    expect(plan[2]!.keys).toContain('d2b_1.comment');
    expect(plan[2]!.keys).toContain('domain2a.direction');
  });

  it('treats a missing row as its default and has no sections for AMSTAR 2', () => {
    const plan = planAnswerCopy('ROB2', { d1_1: 'Y' }, {});
    expect(plan.find(entry => entry.section.id === 'domain1')?.blocker).toBeNull();
    expect(planAnswerCopy('AMSTAR2', {}, {})).toEqual([]);
  });

  it('tells study-level keys from per-outcome ones', () => {
    expect(isCarryOverKey('ROB2', 'd1_1')).toBe(true);
    expect(isCarryOverKey('ROB2', 'd2b_3.comment')).toBe(true);
    expect(isCarryOverKey('ROB2', 'preliminary.aim')).toBe(true);
    expect(isCarryOverKey('ROB2', 'preliminary.numericalResult')).toBe(false);
    expect(isCarryOverKey('ROB2', 'd4_1')).toBe(false);
    expect(isCarryOverKey('ROBINS_I', 'd1a_2')).toBe(true);
    expect(isCarryOverKey('ROBINS_I', 'sectionB.b3')).toBe(false);
    expect(isCarryOverKey('AMSTAR2', 'q1.answers')).toBe(false);
  });

  it('never includes a per-outcome key', () => {
    const keys = planAnswerCopy('ROB2', defaults, defaults).flatMap(entry => entry.keys);
    expect(keys).not.toContain('preliminary.numericalResult');
    expect(keys.some(key => key.startsWith('d3_') || key.startsWith('d4_'))).toBe(false);
    expect(keys).not.toContain('overall.direction');
    expect(new Set(keys).size).toBe(keys.length);

    const robins = planAnswerCopy(
      'ROBINS_I',
      defaultAnswerRows('ROBINS_I'),
      defaultAnswerRows('ROBINS_I'),
    ).flatMap(entry => entry.keys);
    expect(robins.some(key => key.startsWith('sectionA.') || key.startsWith('sectionB.'))).toBe(
      false,
    );
    expect(robins.some(key => /^d[456]_/.test(key))).toBe(false);
  });
});

// Row ids stay per key, so a copied answer lands exactly where the reviewer's
// own edits would.
it('writes copied rows under the target checklist id', () => {
  const engine = newEngine();
  seedPair(engine, 'ROB2');
  fillRob2Source(engine);
  expect(copy(engine, ['domain1']).error).toBeUndefined();
  expect(engine.get('answers', answerRowId('chk-2', 'd1_1'))?.value).toBe('Y');
  expect(engine.get('answers', answerRowId('chk-2', 'd1_1'))?.checklistId).toBe('chk-2');
});
