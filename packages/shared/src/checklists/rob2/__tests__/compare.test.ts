/**
 * Tests for ROB-2 Checklist Comparison
 *
 * INTENDED BEHAVIOR:
 * - compareChecklists: Compares two reviewer checklists per domain/question and
 *   surfaces each reviewer's answer verbatim so the reconciliation UI can
 *   display them side by side
 * - hasAimMismatch: Detects when reviewers selected different aims
 * - getReconciliationSummary: Summarizes what needs reconciliation
 */

import { describe, it, expect } from 'vitest';
import { compareChecklists, hasAimMismatch, getReconciliationSummary } from '../compare.js';
import type { ROB2Checklist } from '../../types.js';

type PartialChecklist = Partial<ROB2Checklist>;

function makeDomain1(
  answers: Record<string, string | null>,
  direction: string | null = null,
): NonNullable<PartialChecklist['domain1']> {
  const entries = Object.fromEntries(
    Object.entries(answers).map(([k, answer]) => [k, { answer, comment: '' }]),
  );
  return { answers: entries, direction, judgement: null } as NonNullable<
    PartialChecklist['domain1']
  >;
}

function makeChecklist(overrides: PartialChecklist = {}): PartialChecklist {
  return {
    preliminary: {
      studyDesign: 'PARALLEL',
      aim: 'ASSIGNMENT',
      deviationsToAddress: [],
      sources: {},
      experimental: 'Drug X',
      comparator: 'Placebo',
      numericalResult: 'RR 1.5',
    },
    ...overrides,
  } as PartialChecklist;
}

describe('compareChecklists', () => {
  it('should return empty results for null inputs', () => {
    const result = compareChecklists(null, null);
    expect(result.preliminary.fields).toHaveLength(0);
    expect(result.domains).toEqual({});
    expect(result.stats.total).toBe(0);
  });

  it("should surface each reviewer's answer on disagreements", () => {
    const c1 = makeChecklist({ domain1: makeDomain1({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) });
    const c2 = makeChecklist({ domain1: makeDomain1({ d1_1: 'N', d1_2: 'Y', d1_3: 'N' }) });

    const result = compareChecklists(c1, c2);
    const d1 = result.domains.domain1;

    const disagreement = d1.questions.disagreements.find(q => q.key === 'd1_1');
    expect(disagreement).toBeDefined();
    expect(disagreement!.reviewer1.answer).toBe('Y');
    expect(disagreement!.reviewer2.answer).toBe('N');

    const agreement = d1.questions.agreements.find(q => q.key === 'd1_2');
    expect(agreement).toBeDefined();
    expect(agreement!.reviewer1.answer).toBe('Y');
    expect(agreement!.reviewer2.answer).toBe('Y');
  });

  it("should carry each reviewer's comment through comparison", () => {
    const c1 = makeChecklist({ domain1: makeDomain1({ d1_1: 'Y' }) });
    const c2 = makeChecklist({ domain1: makeDomain1({ d1_1: 'N' }) });
    c1.domain1!.answers.d1_1.comment = 'Randomized via computer';
    c2.domain1!.answers.d1_1.comment = 'No mention of randomization';

    const result = compareChecklists(c1, c2);
    const q = result.domains.domain1.questions.disagreements.find(d => d.key === 'd1_1');

    expect(q!.reviewer1.comment).toBe('Randomized via computer');
    expect(q!.reviewer2.comment).toBe('No mention of randomization');
  });

  it('should not count matching empty answers as agreement', () => {
    const c1 = makeChecklist({ domain1: makeDomain1({}) });
    const c2 = makeChecklist({ domain1: makeDomain1({}) });

    const result = compareChecklists(c1, c2);
    const d1 = result.domains.domain1;

    // All domain 1 questions unanswered by both: still disagreements (need a final answer)
    expect(d1.questions.agreements).toHaveLength(0);
    expect(d1.questions.disagreements.length).toBeGreaterThan(0);
    for (const q of d1.questions.disagreements) {
      expect(q.reviewer1.answer).toBe(null);
      expect(q.reviewer2.answer).toBe(null);
    }
  });

  it('should compare directions per domain', () => {
    const c1 = makeChecklist({
      domain1: makeDomain1({ d1_1: 'Y' }, 'FAVOURS_EXPERIMENTAL'),
    });
    const c2 = makeChecklist({
      domain1: makeDomain1({ d1_1: 'Y' }, 'FAVOURS_COMPARATOR'),
    });

    const result = compareChecklists(c1, c2);
    const d1 = result.domains.domain1;

    expect(d1.direction1).toBe('FAVOURS_EXPERIMENTAL');
    expect(d1.direction2).toBe('FAVOURS_COMPARATOR');
    expect(d1.directionMatch).toBe(false);
  });

  it('should compare preliminary fields and flag aim mismatch', () => {
    const c1 = makeChecklist();
    const c2 = makeChecklist({
      preliminary: { ...c1.preliminary!, aim: 'ADHERING' },
    });

    const result = compareChecklists(c1, c2);

    expect(result.preliminary.aimMismatch).toBe(true);
    expect(result.preliminary.aim1).toBe('ASSIGNMENT');
    expect(result.preliminary.aim2).toBe('ADHERING');

    const aimField = result.preliminary.fields.find(f => f.key === 'aim');
    expect(aimField!.isAgreement).toBe(false);
    expect(aimField!.reviewer1Value).toBe('ASSIGNMENT');
    expect(aimField!.reviewer2Value).toBe('ADHERING');
  });

  it('should use domain2a for ASSIGNMENT aim and domain2b for ADHERING aim', () => {
    const c1 = makeChecklist();
    const c2 = makeChecklist();

    const assignment = compareChecklists(c1, c2);
    expect(assignment.domains).toHaveProperty('domain2a');
    expect(assignment.domains).not.toHaveProperty('domain2b');

    const adhering = compareChecklists(c1, c2, 'ADHERING');
    expect(adhering.domains).toHaveProperty('domain2b');
    expect(adhering.domains).not.toHaveProperty('domain2a');
  });

  it('should keep stats consistent', () => {
    const c1 = makeChecklist({ domain1: makeDomain1({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) });
    const c2 = makeChecklist({ domain1: makeDomain1({ d1_1: 'N', d1_2: 'Y', d1_3: 'N' }) });

    const { stats } = compareChecklists(c1, c2);
    expect(stats.total).toBe(stats.agreed + stats.disagreed);
    expect(stats.agreementRate).toBeGreaterThan(0);
    expect(stats.agreementRate).toBeLessThanOrEqual(1);
  });
});

describe('hasAimMismatch', () => {
  it('should detect differing aims', () => {
    const c1 = makeChecklist();
    const c2 = makeChecklist({ preliminary: { ...c1.preliminary!, aim: 'ADHERING' } });
    expect(hasAimMismatch(c1, c2)).toBe(true);
  });

  it('should not flag when either aim is unset', () => {
    const c1 = makeChecklist();
    const c2 = makeChecklist({ preliminary: { ...c1.preliminary!, aim: null } });
    expect(hasAimMismatch(c1, c2)).toBe(false);
    expect(hasAimMismatch(null, c1)).toBe(false);
  });
});

describe('getReconciliationSummary', () => {
  it('should summarize disagreements per domain', () => {
    const c1 = makeChecklist({ domain1: makeDomain1({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) });
    const c2 = makeChecklist({ domain1: makeDomain1({ d1_1: 'N', d1_2: 'Y', d1_3: 'N' }) });

    const summary = getReconciliationSummary(compareChecklists(c1, c2));

    expect(summary.needsReconciliation).toBe(true);
    const d1 = summary.domainDisagreements.find(d => d.domain === 'domain1');
    expect(d1).toBeDefined();
    expect(d1!.questions).toContain('d1_1');
    expect(d1!.questions).not.toContain('d1_2');
  });
});
