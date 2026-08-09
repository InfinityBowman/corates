/**
 * Tests for ROB-2 skipped-question derivation
 *
 * Skipped = domain scoring-complete + question off the scoring path + no
 * stored answer. NA stamping is only allowed for WITH_NA questions.
 */

import { describe, it, expect } from 'vitest';
import type { DomainAnswers } from '../scoring.js';
import {
  getSkippedDomainQuestions,
  getSkippedQuestions,
  isEffectivelyNotApplicable,
  questionHasNaOption,
} from '../skipped.js';

function answers(map: Record<string, string>): DomainAnswers {
  const result: DomainAnswers = {};
  for (const [key, answer] of Object.entries(map)) {
    result[key] = { answer };
  }
  return result;
}

describe('questionHasNaOption', () => {
  it('is false for STANDARD questions (Domain 1 and 5 have no NA on the official scale)', () => {
    expect(questionHasNaOption('domain1', 'd1_1')).toBe(false);
    expect(questionHasNaOption('domain1', 'd1_3')).toBe(false);
    expect(questionHasNaOption('domain5', 'd5_1')).toBe(false);
  });

  it('is true for the conditional WITH_NA questions', () => {
    expect(questionHasNaOption('domain2a', 'd2a_3')).toBe(true);
    expect(questionHasNaOption('domain3', 'd3_2')).toBe(true);
    expect(questionHasNaOption('domain4', 'd4_3')).toBe(true);
  });

  it('is false for unknown questions', () => {
    expect(questionHasNaOption('domain1', 'nope')).toBe(false);
    expect(questionHasNaOption('nope', 'd1_1')).toBe(false);
  });
});

describe('getSkippedDomainQuestions', () => {
  it('returns empty when the domain is not scoring-complete', () => {
    expect(getSkippedDomainQuestions('domain1', answers({ d1_2: 'Y' })).size).toBe(0);
    expect(getSkippedDomainQuestions('domain1', undefined).size).toBe(0);
  });

  it('derives off-path STANDARD questions when 1.2=N forces High', () => {
    const skipped = getSkippedDomainQuestions('domain1', answers({ d1_2: 'N' }));
    expect([...skipped].sort()).toEqual(['d1_1', 'd1_3']);
  });

  it('derives off-path WITH_NA questions when 2.1=N and 2.2=N end part 1', () => {
    const skipped = getSkippedDomainQuestions(
      'domain2a',
      answers({ d2a_1: 'N', d2a_2: 'N', d2a_6: 'Y' }),
    );
    expect([...skipped].sort()).toEqual(['d2a_3', 'd2a_4', 'd2a_5', 'd2a_7']);
  });

  it('derives 5.1 as skipped when 5.2=Y forces High', () => {
    const skipped = getSkippedDomainQuestions('domain5', answers({ d5_2: 'Y', d5_3: 'N' }));
    expect([...skipped]).toEqual(['d5_1']);
  });

  it('does not report answered off-path questions as skipped', () => {
    const skipped = getSkippedDomainQuestions('domain1', answers({ d1_2: 'N', d1_1: 'Y' }));
    expect([...skipped]).toEqual(['d1_3']);
  });

  it('does not report explicit NA answers as skipped', () => {
    const skipped = getSkippedDomainQuestions(
      'domain3',
      answers({ d3_1: 'N', d3_2: 'Y', d3_3: 'NA', d3_4: 'NA' }),
    );
    expect(skipped.size).toBe(0);
  });
});

describe('getSkippedQuestions', () => {
  it('aggregates across active domains only', () => {
    const checklist = {
      preliminary: { aim: 'ASSIGNMENT' },
      domain1: { answers: answers({ d1_2: 'N' }) },
      // Inactive 2b holds answers that would produce skips; they must not leak.
      domain2b: { answers: answers({ d2b_1: 'N', d2b_2: 'N' }) },
      domain5: { answers: answers({ d5_2: 'Y', d5_3: 'N' }) },
    };
    const skipped = getSkippedQuestions(checklist);
    expect([...skipped].sort()).toEqual(['d1_1', 'd1_3', 'd5_1']);
  });

  it('returns empty for null checklists', () => {
    expect(getSkippedQuestions(null).size).toBe(0);
  });
});

describe('isEffectivelyNotApplicable', () => {
  const skipped = new Set(['d1_3']);

  it('treats explicit NA answers as not applicable', () => {
    expect(isEffectivelyNotApplicable('d2a_3', 'NA', new Set())).toBe(true);
  });

  it('treats derived skips as not applicable', () => {
    expect(isEffectivelyNotApplicable('d1_3', null, skipped)).toBe(true);
    expect(isEffectivelyNotApplicable('d1_3', undefined, skipped)).toBe(true);
  });

  it('is false for real answers and for unanswered on-path questions', () => {
    expect(isEffectivelyNotApplicable('d1_3', 'Y', skipped)).toBe(false);
    expect(isEffectivelyNotApplicable('d1_1', null, skipped)).toBe(false);
  });
});
