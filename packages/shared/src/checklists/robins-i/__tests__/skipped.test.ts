/**
 * Tests for ROBINS-I skipped-question derivation
 *
 * Skipped = domain early-complete (judgement determined) + no stored answer,
 * or Section B Critical which skips all domain questions. NA stamping is only
 * allowed for questions whose response scale includes NA.
 */

import { describe, it, expect } from 'vitest';
import type { DomainAnswers } from '../scoring.js';
import {
  getSkippedDomainQuestions,
  getSkippedQuestions,
  isEffectivelyNotApplicable,
  isSectionBCritical,
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
  it('is false for questions without NA on the official scale', () => {
    expect(questionHasNaOption('domain1a', 'd1a_1')).toBe(false);
    expect(questionHasNaOption('domain5', 'd5_1')).toBe(false);
    expect(questionHasNaOption('domain6', 'd6_1')).toBe(false);
  });

  it('is true for conditional questions with NA variants', () => {
    expect(questionHasNaOption('domain1a', 'd1a_2')).toBe(true);
    expect(questionHasNaOption('domain2', 'd2_2')).toBe(true);
    expect(questionHasNaOption('domain4', 'd4_7')).toBe(true);
    expect(questionHasNaOption('domain5', 'd5_3')).toBe(true);
  });

  it('is false for unknown questions', () => {
    expect(questionHasNaOption('domain5', 'nope')).toBe(false);
    expect(questionHasNaOption('nope', 'd5_1')).toBe(false);
  });
});

describe('isSectionBCritical', () => {
  it('is true when B2 or B3 is Y/PY', () => {
    expect(isSectionBCritical({ b2: { answer: 'Y' } })).toBe(true);
    expect(isSectionBCritical({ b3: { answer: 'PY' } })).toBe(true);
  });

  it('is false otherwise', () => {
    expect(isSectionBCritical({ b2: { answer: 'N' }, b3: { answer: 'PN' } })).toBe(false);
    expect(isSectionBCritical(undefined)).toBe(false);
  });
});

describe('getSkippedDomainQuestions', () => {
  it('returns empty when the domain is not early-complete', () => {
    expect(getSkippedDomainQuestions('domain5', answers({ d5_1: 'N' })).size).toBe(0);
    expect(getSkippedDomainQuestions('domain5', undefined).size).toBe(0);
  });

  it('derives unanswered questions once the judgement is determined', () => {
    // 5.1=Y forces Serious immediately; 5.2 and 5.3 become skippable
    const skipped = getSkippedDomainQuestions('domain5', answers({ d5_1: 'Y' }));
    expect([...skipped].sort()).toEqual(['d5_2', 'd5_3']);
  });

  it('derives the remaining questions when 6.1=Y forces Low', () => {
    const skipped = getSkippedDomainQuestions('domain6', answers({ d6_1: 'Y' }));
    expect([...skipped].sort()).toEqual(['d6_2', 'd6_3', 'd6_4']);
  });

  it('does not report answered questions as skipped', () => {
    const skipped = getSkippedDomainQuestions('domain6', answers({ d6_1: 'Y', d6_2: 'N' }));
    expect([...skipped].sort()).toEqual(['d6_3', 'd6_4']);
  });
});

describe('getSkippedQuestions', () => {
  it('skips all unanswered domain questions when Section B is Critical', () => {
    const checklist = {
      sectionB: { b1: { answer: 'N' }, b2: { answer: 'Y' }, b3: { answer: 'N' } },
      sectionC: { isPerProtocol: false },
    };
    const skipped = getSkippedQuestions(checklist);
    // Every question of every active domain is unanswered, so all are skipped
    expect(skipped.has('d1a_1')).toBe(true);
    expect(skipped.has('d2_1')).toBe(true);
    expect(skipped.has('d6_4')).toBe(true);
    // Inactive variant (1b) is not included
    expect(skipped.has('d1b_1')).toBe(false);
  });

  it('aggregates early-complete skips across active domains only', () => {
    const checklist = {
      sectionB: { b1: { answer: 'Y' }, b2: { answer: 'N' }, b3: { answer: 'N' } },
      sectionC: { isPerProtocol: false },
      domain5: { answers: answers({ d5_1: 'Y' }) },
      // Inactive 1b would produce skips if active; it must not leak
      domain1b: { answers: answers({ d1b_1: 'N', d1b_4: 'Y' }) },
    };
    const skipped = getSkippedQuestions(checklist);
    expect([...skipped].sort()).toEqual(['d5_2', 'd5_3']);
  });

  it('returns empty for null checklists', () => {
    expect(getSkippedQuestions(null).size).toBe(0);
  });
});

describe('isEffectivelyNotApplicable', () => {
  const skipped = new Set(['d5_3']);

  it('treats explicit NA answers as not applicable', () => {
    expect(isEffectivelyNotApplicable('d5_3', 'NA', new Set())).toBe(true);
  });

  it('treats derived skips as not applicable', () => {
    expect(isEffectivelyNotApplicable('d5_3', null, skipped)).toBe(true);
    expect(isEffectivelyNotApplicable('d5_3', undefined, skipped)).toBe(true);
  });

  it('is false for real answers and for unanswered on-path questions', () => {
    expect(isEffectivelyNotApplicable('d5_3', 'SY', skipped)).toBe(false);
    expect(isEffectivelyNotApplicable('d5_1', null, skipped)).toBe(false);
  });
});
