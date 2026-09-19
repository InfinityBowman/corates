/**
 * Tests for the per-tool reliability adapters and the project roll-up
 *
 * INTENDED BEHAVIOR:
 * - RoB 2: domain judgements are derived from the signaling answers, a
 *   domain assessed under different aims is not compared, and a question
 *   that branching skipped is treated as not applicable
 * - ROBINS-I: a Section B Critical rating leaves no domain judgements and
 *   sets the overall judgement to Critical
 * - AMSTAR 2: "No MA" is not applicable, the overall confidence rating is
 *   compared on its own scale
 * - calculateProjectReliability: pools every cell with two completed reviewer
 *   checklists per tool, ignoring consensus and single-reviewer cells
 */

import { describe, it, expect } from 'vitest';
import { extractRob2Pairs } from '../rob2.js';
import { extractRobinsIPairs } from '../robins-i.js';
import { extractAmstar2Pairs } from '../amstar2.js';
import { calculateProjectReliability } from '../index.js';
import { NOT_APPLICABLE } from '../stats.js';
import { createROB2Checklist } from '../../rob2/create.js';
import { createROBINSIChecklist } from '../../robins-i/create.js';
import { createAMSTAR2Checklist } from '../../amstar2/create.js';
import { CHECKLIST_STATUS } from '../../status.js';
import type { AMSTAR2Checklist, AMSTAR2Question, Study } from '../../types.js';

function rob2(answers: Record<string, Record<string, string | null>>, aim = 'ASSIGNMENT') {
  const checklist = createROB2Checklist({ id: 'c', name: 'c' });
  checklist.preliminary.aim = aim as 'ASSIGNMENT' | 'ADHERING';
  for (const [domainKey, domainAnswers] of Object.entries(answers)) {
    const domain = checklist[domainKey as 'domain1'];
    for (const [qKey, answer] of Object.entries(domainAnswers)) {
      domain.answers[qKey] = { answer: answer as 'Y', comment: '' };
    }
  }
  return checklist;
}

function pairFor(pairs: { item: string; a: string | null; b: string | null }[], item: string) {
  return pairs.find(p => p.item === item);
}

describe('extractRob2Pairs', () => {
  it('derives domain judgements from the signaling answers', () => {
    const a = rob2({ domain1: { d1_1: 'Y', d1_2: 'Y', d1_3: 'N' } });
    const b = rob2({ domain1: { d1_1: 'Y', d1_2: 'N', d1_3: 'N' } });
    const { judgements } = extractRob2Pairs(a, b);
    expect(pairFor(judgements, 'domain1')).toEqual({ item: 'domain1', a: 'Low', b: 'High' });
    expect(pairFor(judgements, 'domain3')).toEqual({ item: 'domain3', a: null, b: null });
  });

  it('skips domain 2 when the reviewers chose different aims', () => {
    const a = rob2({}, 'ASSIGNMENT');
    const b = rob2({}, 'ADHERING');
    const { judgements, questions } = extractRob2Pairs(a, b);
    expect(judgements.map(p => p.item)).toEqual(['domain1', 'domain3', 'domain4', 'domain5']);
    expect(questions.some(p => p.item.startsWith('d2'))).toBe(false);
  });

  it('marks a question skipped by branching as not applicable', () => {
    // 3.1 = Y ends domain 3 at Low, so 3.2 to 3.4 are off the path.
    const a = rob2({ domain3: { d3_1: 'Y' } });
    const b = rob2({ domain3: { d3_1: 'Y', d3_2: 'NA' } });
    const { questions } = extractRob2Pairs(a, b);
    expect(pairFor(questions, 'd3_2')).toEqual({
      item: 'd3_2',
      a: NOT_APPLICABLE,
      b: NOT_APPLICABLE,
    });
    expect(pairFor(questions, 'd3_1')).toEqual({ item: 'd3_1', a: 'Y', b: 'Y' });
  });

  it('keeps a substantive answer against a skip so the pair reads as one-sided', () => {
    const a = rob2({ domain3: { d3_1: 'N', d3_2: 'Y' } });
    const b = rob2({ domain3: { d3_1: 'Y' } });
    const { questions } = extractRob2Pairs(a, b);
    expect(pairFor(questions, 'd3_2')).toEqual({ item: 'd3_2', a: 'Y', b: NOT_APPLICABLE });
  });

  it('leaves an unanswered question as null', () => {
    const a = rob2({ domain1: { d1_2: 'Y' } });
    const b = rob2({ domain1: { d1_2: 'Y', d1_1: 'Y' } });
    const { questions } = extractRob2Pairs(a, b);
    expect(pairFor(questions, 'd1_1')).toEqual({ item: 'd1_1', a: null, b: 'Y' });
  });
});

describe('extractRobinsIPairs', () => {
  it('turns a Section B Critical rating into a Critical overall with no domain judgements', () => {
    const a = createROBINSIChecklist({ id: 'a', name: 'a' });
    a.sectionB.b1.answer = 'N';
    a.sectionB.b2.answer = 'Y';
    const b = createROBINSIChecklist({ id: 'b', name: 'b' });
    b.sectionB.b1.answer = 'Y';
    b.sectionB.b2.answer = 'N';
    b.sectionB.b3.answer = 'N';
    b.domain2.answers.d2_1 = { answer: 'Y', comment: '' };
    b.domain2.answers.d2_4 = { answer: 'SY', comment: '' };
    b.domain2.answers.d2_5 = { answer: 'N', comment: '' };

    const { judgements, overall, questions } = extractRobinsIPairs(a, b);
    expect(pairFor(judgements, 'domain2')).toEqual({ item: 'domain2', a: null, b: 'Serious' });
    expect(overall).toEqual([{ item: 'overall', a: 'Critical', b: null }]);
    expect(pairFor(questions, 'b2')).toEqual({ item: 'b2', a: 'Y', b: 'N' });
    // Every domain question is skipped for the reviewer who stopped at Section B.
    expect(pairFor(questions, 'd2_1')).toEqual({ item: 'd2_1', a: NOT_APPLICABLE, b: 'Y' });
  });

  it('merges both domain 1 variants onto one row', () => {
    const a = createROBINSIChecklist({ id: 'a', name: 'a' });
    const b = createROBINSIChecklist({ id: 'b', name: 'b' });
    const { judgements } = extractRobinsIPairs(a, b);
    expect(judgements.map(p => p.item)).toEqual([
      'domain1',
      'domain2',
      'domain3',
      'domain4',
      'domain5',
      'domain6',
    ]);
  });

  it('skips domain 1 when only one reviewer assessed the per-protocol effect', () => {
    const a = createROBINSIChecklist({ id: 'a', name: 'a' });
    const b = createROBINSIChecklist({ id: 'b', name: 'b' });
    b.sectionC.isPerProtocol = true;
    const { judgements } = extractRobinsIPairs(a, b);
    expect(judgements.map(p => p.item)).not.toContain('domain1');
  });
});

function amstar2(answers: Record<string, number>): AMSTAR2Checklist {
  const checklist = createAMSTAR2Checklist({ id: 'c', name: 'c' });
  for (const [key, index] of Object.entries(answers)) {
    const question = checklist[key as keyof AMSTAR2Checklist] as AMSTAR2Question;
    const last = question.answers[question.answers.length - 1];
    question.answers[question.answers.length - 1] = last.map((_, i) => i === index);
  }
  return checklist;
}

describe('extractAmstar2Pairs', () => {
  it('compares final answers per item and maps No MA to not applicable', () => {
    const a = amstar2({ q1: 0, q2: 1, q9a: 3 });
    const b = amstar2({ q1: 0, q2: 2, q9a: 0 });
    const { judgements } = extractAmstar2Pairs(a, b);
    expect(pairFor(judgements, 'q1')).toEqual({ item: 'q1', a: 'Yes', b: 'Yes' });
    expect(pairFor(judgements, 'q2')).toEqual({ item: 'q2', a: 'Partial Yes', b: 'No' });
    expect(pairFor(judgements, 'q9a')).toEqual({ item: 'q9a', a: NOT_APPLICABLE, b: 'Yes' });
    expect(pairFor(judgements, 'q3')).toEqual({ item: 'q3', a: null, b: null });
  });

  it('compares the overall confidence rating only for complete checklists', () => {
    const allYes = Object.fromEntries(
      [
        'q1',
        'q2',
        'q3',
        'q4',
        'q5',
        'q6',
        'q7',
        'q8',
        'q9a',
        'q9b',
        'q10',
        'q11a',
        'q11b',
        'q12',
        'q13',
        'q14',
        'q15',
        'q16',
      ].map(key => [key, 0]),
    );
    const a = amstar2(allYes);
    const b = amstar2({ ...allYes, q1: 1 });
    const incomplete = amstar2({ q1: 0 });
    expect(extractAmstar2Pairs(a, b).overall).toEqual([{ item: 'overall', a: 'High', b: 'High' }]);
    expect(extractAmstar2Pairs(a, incomplete).overall).toEqual([
      { item: 'overall', a: 'High', b: null },
    ]);
  });
});

describe('calculateProjectReliability', () => {
  const data = new Map<string, unknown>();
  const getChecklistData = (_studyId: string, checklistId: string) => {
    const answers = data.get(checklistId);
    return answers ? { answers } : null;
  };

  function reviewer(id: string, type: string, assignedTo: string | null, outcomeId: string | null) {
    return { id, type, assignedTo, outcomeId, status: CHECKLIST_STATUS.REVIEWER_COMPLETED };
  }

  it('pools cells per tool and skips consensus, single-reviewer, same-reviewer and unassigned cells', () => {
    data.set('r1', rob2({ domain1: { d1_1: 'Y', d1_2: 'Y', d1_3: 'N' } }));
    data.set('r2', rob2({ domain1: { d1_1: 'Y', d1_2: 'N', d1_3: 'N' } }));
    data.set('r3', rob2({ domain1: { d1_1: 'Y', d1_2: 'Y', d1_3: 'N' } }));
    data.set('r4', rob2({ domain1: { d1_1: 'Y', d1_2: 'Y', d1_3: 'N' } }));
    data.set('a1', amstar2({ q1: 0 }));
    data.set('a2', amstar2({ q1: 0 }));

    const studies: Study[] = [
      {
        id: 's1',
        checklists: [
          reviewer('r1', 'ROB2', 'u1', 'o1'),
          reviewer('r2', 'ROB2', 'u2', 'o1'),
          { id: 'x1', type: 'ROB2', kind: 'consensus', outcomeId: 'o1', status: 'finalized' },
          reviewer('r3', 'ROB2', 'u1', 'o2'),
          reviewer('r4', 'ROB2', 'u2', 'o2'),
        ],
      },
      {
        id: 's2',
        checklists: [
          reviewer('a1', 'AMSTAR2', 'u1', null),
          reviewer('a2', 'AMSTAR2', 'u2', null),
          reviewer('r5', 'ROB2', 'u1', 'o3'),
        ],
      },
      {
        id: 's3',
        checklists: [reviewer('r6', 'ROB2', 'u1', 'o4'), reviewer('r7', 'ROB2', 'u1', 'o4')],
      },
      {
        id: 's4',
        checklists: [reviewer('r8', 'ROB2', null, 'o5'), reviewer('r9', 'ROB2', null, 'o5')],
      },
    ];

    const result = calculateProjectReliability(studies, getChecklistData);
    expect(result.map(t => t.definition.type)).toEqual(['ROB2', 'AMSTAR2']);

    const rob = result[0];
    expect(rob.cells).toBe(2);
    expect(rob.studies).toBe(1);
    expect(rob.judgements.compared).toBe(2);
    expect(rob.judgements.agreed).toBe(1);
    expect(rob.judgements.items.find(i => i.key === 'domain1')).toMatchObject({
      compared: 2,
      agreed: 1,
    });
    expect(rob.questions?.compared).toBe(6);
    expect(rob.overall.compared).toBe(0);

    const amstar = result[1];
    expect(amstar.cells).toBe(1);
    expect(amstar.judgements.compared).toBe(1);
    expect(amstar.judgements.agreed).toBe(1);
    expect(amstar.questions).toBeNull();
  });

  it('returns nothing for an empty project', () => {
    expect(calculateProjectReliability([], getChecklistData)).toEqual([]);
    expect(calculateProjectReliability(null, getChecklistData)).toEqual([]);
  });
});
