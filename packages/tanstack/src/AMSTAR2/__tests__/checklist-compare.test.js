/**
 * Tests for AMSTAR2 Checklist Comparison Module
 *
 * INTENDED BEHAVIOR:
 * - compareChecklists: Compares two checklists and identifies agreements/disagreements
 * - compareQuestion: Compares a single question between two checklists
 * - getFinalAnswer: Extracts the final answer from a question's last column
 * - answersMatch: Checks if two answer arrays are identical
 * - createReconciledChecklist: Creates a merged checklist from two sources
 * - getReconciliationSummary: Summarizes what needs reconciliation
 */

import { describe, it, expect } from 'vitest';
import {
  compareChecklists,
  compareQuestion,
  getFinalAnswer,
  answersMatch,
  createReconciledChecklist,
  getReconciliationSummary,
  getQuestionKeys,
} from '../checklist-compare.js';
import { createChecklist } from '../checklist.js';

describe('getQuestionKeys', () => {
  it('should return all question keys from the checklist map', () => {
    const keys = getQuestionKeys();
    expect(keys).toContain('q1');
    expect(keys).toContain('q16');
    expect(keys.length).toBeGreaterThan(10);
  });
});

describe('getFinalAnswer', () => {
  it('should return Yes for first selected option in 2-option column', () => {
    const answers = [[false], [true, false]];
    expect(getFinalAnswer(answers, 'q1')).toBe('Yes');
  });

  it('should return No for second selected option in 2-option column', () => {
    const answers = [[false], [false, true]];
    expect(getFinalAnswer(answers, 'q1')).toBe('No');
  });

  it('should return Partial Yes for second option in 3-option column', () => {
    const answers = [[false], [false, true, false]];
    expect(getFinalAnswer(answers, 'q2')).toBe('Partial Yes');
  });

  it('should return null if no answer is selected', () => {
    const answers = [[false], [false, false]];
    expect(getFinalAnswer(answers, 'q1')).toBe(null);
  });

  it('should return null for invalid input', () => {
    expect(getFinalAnswer(null, 'q1')).toBe(null);
    expect(getFinalAnswer([], 'q1')).toBe(null);
  });
});

describe('answersMatch', () => {
  it('should return true for identical answers', () => {
    const a1 = [
      [true, false],
      [false, true],
    ];
    const a2 = [
      [true, false],
      [false, true],
    ];
    expect(answersMatch(a1, a2)).toBe(true);
  });

  it('should return false for different answers', () => {
    const a1 = [
      [true, false],
      [false, true],
    ];
    const a2 = [
      [false, true],
      [false, true],
    ];
    expect(answersMatch(a1, a2)).toBe(false);
  });

  it('should return false for different lengths', () => {
    const a1 = [
      [true, false],
      [false, true],
    ];
    const a2 = [[true, false]];
    expect(answersMatch(a1, a2)).toBe(false);
  });

  it('should return false for null inputs', () => {
    expect(answersMatch(null, [[true]])).toBe(false);
    expect(answersMatch([[true]], null)).toBe(false);
  });
});

describe('compareQuestion', () => {
  it('should identify agreement when final answers match', () => {
    const q1 = {
      answers: [
        [true, true],
        [true, false],
      ],
      critical: false,
    };
    const q2 = {
      answers: [
        [true, true],
        [true, false],
      ],
      critical: false,
    };

    const result = compareQuestion('q1', q1, q2);

    expect(result.isAgreement).toBe(true);
    expect(result.finalMatch).toBe(true);
    expect(result.criticalMatch).toBe(true);
    expect(result.reviewer1.finalAnswer).toBe('Yes');
    expect(result.reviewer2.finalAnswer).toBe('Yes');
  });

  it('should identify disagreement when final answers differ', () => {
    const q1 = {
      answers: [
        [true, true],
        [true, false],
      ],
      critical: false,
    };
    const q2 = {
      answers: [
        [false, false],
        [false, true],
      ],
      critical: false,
    };

    const result = compareQuestion('q1', q1, q2);

    expect(result.isAgreement).toBe(false);
    expect(result.finalMatch).toBe(false);
    expect(result.reviewer1.finalAnswer).toBe('Yes');
    expect(result.reviewer2.finalAnswer).toBe('No');
  });

  it('should identify disagreement when critical status differs', () => {
    const q1 = {
      answers: [
        [true, true],
        [true, false],
      ],
      critical: true,
    };
    const q2 = {
      answers: [
        [true, true],
        [true, false],
      ],
      critical: false,
    };

    const result = compareQuestion('q1', q1, q2);

    expect(result.isAgreement).toBe(false);
    expect(result.finalMatch).toBe(true);
    expect(result.criticalMatch).toBe(false);
  });
});

describe('compareChecklists', () => {
  it('should return empty results for null inputs', () => {
    const result = compareChecklists(null, null);
    expect(result.agreements).toHaveLength(0);
    expect(result.disagreements).toHaveLength(0);
  });

  it('should identify agreements and disagreements', () => {
    const cl1 = createChecklist({ id: 'test-1', name: 'Test 1' });
    const cl2 = createChecklist({ id: 'test-2', name: 'Test 2' });

    // Make cl1.q1 have Yes as the final answer
    cl1.q1.answers[2] = [true, false]; // Yes selected
    cl2.q1.answers[2] = [true, false]; // Yes selected (same)

    // Make q2 different
    cl1.q2.answers[2] = [true, false, false]; // Yes
    cl2.q2.answers[2] = [false, false, true]; // No

    const result = compareChecklists(cl1, cl2);

    expect(result.agreements.length).toBeGreaterThan(0);
    expect(result.disagreements.length).toBeGreaterThan(0);
    expect(result.stats.total).toBe(result.stats.agreed + result.stats.disagreed);
  });
});

describe('getReconciliationSummary', () => {
  it('should provide counts of agreements and disagreements', () => {
    const comparison = {
      agreements: [{ key: 'q1' }, { key: 'q3' }],
      disagreements: [{ key: 'q2', reviewer1: { critical: true }, reviewer2: { critical: false } }],
      stats: { total: 3, agreed: 2, disagreed: 1, agreementRate: 0.67 },
    };

    const summary = getReconciliationSummary(comparison);

    expect(summary.totalQuestions).toBe(3);
    expect(summary.agreementCount).toBe(2);
    expect(summary.disagreementCount).toBe(1);
    expect(summary.needsReconciliation).toBe(true);
    expect(summary.criticalDisagreements).toBe(1);
  });

  it('should report no reconciliation needed when no disagreements', () => {
    const comparison = {
      agreements: [{ key: 'q1' }],
      disagreements: [],
      stats: { total: 1, agreed: 1, disagreed: 0, agreementRate: 1 },
    };

    const summary = getReconciliationSummary(comparison);

    expect(summary.needsReconciliation).toBe(false);
  });
});

describe('createReconciledChecklist', () => {
  it('should create a checklist using selections from both reviewers', () => {
    const cl1 = createChecklist({ id: 'test-1', name: 'Test 1' });
    const cl2 = createChecklist({ id: 'test-2', name: 'Test 2' });

    // Set different answers for q1
    cl1.q1.answers[2] = [true, false]; // Yes
    cl2.q1.answers[2] = [false, true]; // No

    const selections = {
      q1: 'reviewer2', // Use reviewer 2's answer for q1
      q2: 'reviewer1', // Use reviewer 1's answer for q2
    };

    const reconciled = createReconciledChecklist(cl1, cl2, selections, {
      name: 'Reconciled',
      id: 'reconciled-1',
    });

    expect(reconciled.name).toBe('Reconciled');
    expect(reconciled.id).toBe('reconciled-1');
    expect(reconciled.q1.answers[2]).toEqual([false, true]); // From reviewer 2
    expect(reconciled.q2.answers).toEqual(cl1.q2.answers); // From reviewer 1
  });

  it('should default to reviewer1 when no selection is made', () => {
    const cl1 = createChecklist({ id: 'test-1', name: 'Test 1' });
    const cl2 = createChecklist({ id: 'test-2', name: 'Test 2' });

    const reconciled = createReconciledChecklist(cl1, cl2, {});

    // All questions should come from reviewer 1
    expect(reconciled.q1).toEqual(cl1.q1);
  });

  it('should include source checklist IDs', () => {
    const cl1 = createChecklist({ id: 'source-1', name: 'Test 1' });
    const cl2 = createChecklist({ id: 'source-2', name: 'Test 2' });

    const reconciled = createReconciledChecklist(cl1, cl2, {});

    expect(reconciled.sourceChecklists).toContain('source-1');
    expect(reconciled.sourceChecklists).toContain('source-2');
  });
});
