/**
 * Tests for ROB-2 scoring engine and question skip logic
 *
 * Tests scoreRob2Domain for correct judgements and getRequiredQuestions
 * for correct per-question path analysis across all 6 domains.
 */

import { describe, it, expect } from 'vitest';
import { scoreRob2Domain, getRequiredQuestions, type DomainAnswers } from '../scoring.js';

// Helper: build a DomainAnswers object from a shorthand map
function answers(map: Record<string, string>): DomainAnswers {
  const result: DomainAnswers = {};
  for (const [key, answer] of Object.entries(map)) {
    result[key] = { answer };
  }
  return result;
}

// Helper: extract required question keys as a sorted array for easier assertions
function required(domainKey: string, map: Record<string, string>): string[] {
  return [...getRequiredQuestions(domainKey, answers(map))].sort();
}

// ---------------------------------------------------------------------------
// Domain 1: Bias arising from the randomization process
// ---------------------------------------------------------------------------

describe('Domain 1 scoring', () => {
  it('should return High when 1.2=N', () => {
    const r = scoreRob2Domain('domain1', answers({ d1_2: 'N' }));
    expect(r.judgement).toBe('High');
    expect(r.isComplete).toBe(true);
  });

  it('should return Some concerns when 1.2=Y, 1.1=N', () => {
    const r = scoreRob2Domain('domain1', answers({ d1_2: 'Y', d1_1: 'N' }));
    expect(r.judgement).toBe('Some concerns');
  });

  it('should return Low when 1.2=Y, 1.1=Y, 1.3=N', () => {
    const r = scoreRob2Domain('domain1', answers({ d1_2: 'Y', d1_1: 'Y', d1_3: 'N' }));
    expect(r.judgement).toBe('Low');
  });

  it('should return Some concerns when 1.2=Y, 1.1=Y, 1.3=Y', () => {
    const r = scoreRob2Domain('domain1', answers({ d1_2: 'Y', d1_1: 'Y', d1_3: 'Y' }));
    expect(r.judgement).toBe('Some concerns');
  });

  it('should return Some concerns when 1.2=NI, 1.3=N', () => {
    const r = scoreRob2Domain('domain1', answers({ d1_2: 'NI', d1_3: 'N' }));
    expect(r.judgement).toBe('Some concerns');
  });

  it('should return High when 1.2=NI, 1.3=Y', () => {
    const r = scoreRob2Domain('domain1', answers({ d1_2: 'NI', d1_3: 'Y' }));
    expect(r.judgement).toBe('High');
  });
});

describe('Domain 1 required questions', () => {
  it('should require only 1.2 initially', () => {
    expect(required('domain1', {})).toEqual(['d1_2']);
  });

  it('should not require 1.1 or 1.3 when 1.2=N (early exit)', () => {
    expect(required('domain1', { d1_2: 'N' })).toEqual(['d1_2']);
  });

  it('should require 1.1 when 1.2=Y', () => {
    expect(required('domain1', { d1_2: 'Y' })).toEqual(['d1_1', 'd1_2']);
  });

  it('should require 1.3 when 1.2=Y, 1.1=Y', () => {
    expect(required('domain1', { d1_2: 'Y', d1_1: 'Y' })).toEqual(['d1_1', 'd1_2', 'd1_3']);
  });

  it('should not require 1.3 when 1.2=Y, 1.1=N (early exit)', () => {
    expect(required('domain1', { d1_2: 'Y', d1_1: 'N' })).toEqual(['d1_1', 'd1_2']);
  });

  it('should skip 1.1 and require 1.3 when 1.2=NI', () => {
    expect(required('domain1', { d1_2: 'NI' })).toEqual(['d1_2', 'd1_3']);
  });
});

// ---------------------------------------------------------------------------
// Domain 2a: Effect of assignment to intervention
// ---------------------------------------------------------------------------

describe('Domain 2a scoring', () => {
  it('should return Low when both parts score Low (2.1=N, 2.2=N, 2.6=Y)', () => {
    const r = scoreRob2Domain('domain2a', answers({ d2a_1: 'N', d2a_2: 'N', d2a_6: 'Y' }));
    expect(r.judgement).toBe('Low');
  });

  it('should be incomplete when Part 2 is missing', () => {
    const r = scoreRob2Domain('domain2a', answers({ d2a_1: 'N', d2a_2: 'N' }));
    expect(r.isComplete).toBe(false);
  });

  it('should return Low when 2.1=Y, 2.2=N, 2.3=N, 2.6=Y', () => {
    const r = scoreRob2Domain(
      'domain2a',
      answers({
        d2a_1: 'Y',
        d2a_2: 'N',
        d2a_3: 'N',
        d2a_6: 'Y',
      }),
    );
    expect(r.judgement).toBe('Low');
  });

  it('should return Some concerns when 2.3=NI, 2.6=Y', () => {
    const r = scoreRob2Domain(
      'domain2a',
      answers({
        d2a_1: 'Y',
        d2a_2: 'N',
        d2a_3: 'NI',
        d2a_6: 'Y',
      }),
    );
    expect(r.judgement).toBe('Some concerns');
  });

  it('should return High when 2.3=Y, 2.4=Y, 2.5=N, 2.6=Y', () => {
    const r = scoreRob2Domain(
      'domain2a',
      answers({
        d2a_1: 'Y',
        d2a_2: 'N',
        d2a_3: 'Y',
        d2a_4: 'Y',
        d2a_5: 'N',
        d2a_6: 'Y',
      }),
    );
    expect(r.judgement).toBe('High');
  });
});

describe('Domain 2a required questions', () => {
  it('should always require 2.1, 2.2, and 2.6', () => {
    const r = required('domain2a', {});
    expect(r).toContain('d2a_1');
    expect(r).toContain('d2a_2');
    expect(r).toContain('d2a_6');
  });

  it('should not require 2.3-2.5 when both 2.1 and 2.2 are N/PN (Part 1 early exit)', () => {
    const r = required('domain2a', { d2a_1: 'N', d2a_2: 'N' });
    expect(r).not.toContain('d2a_3');
    expect(r).not.toContain('d2a_4');
    expect(r).not.toContain('d2a_5');
  });

  it('should require 2.3 when either 2.1 or 2.2 is Y', () => {
    const r = required('domain2a', { d2a_1: 'Y', d2a_2: 'N' });
    expect(r).toContain('d2a_3');
  });

  it('should not require 2.4 or 2.5 when 2.3=N', () => {
    const r = required('domain2a', { d2a_1: 'Y', d2a_2: 'N', d2a_3: 'N' });
    expect(r).not.toContain('d2a_4');
    expect(r).not.toContain('d2a_5');
  });

  it('should not require 2.4 or 2.5 when 2.3=NI (early exit to Some concerns)', () => {
    const r = required('domain2a', { d2a_1: 'Y', d2a_2: 'N', d2a_3: 'NI' });
    expect(r).not.toContain('d2a_4');
    expect(r).not.toContain('d2a_5');
  });

  it('should require 2.4 when 2.3=Y', () => {
    const r = required('domain2a', { d2a_1: 'Y', d2a_2: 'N', d2a_3: 'Y' });
    expect(r).toContain('d2a_4');
    expect(r).not.toContain('d2a_5');
  });

  it('should require 2.5 when 2.3=Y, 2.4=Y', () => {
    const r = required('domain2a', { d2a_1: 'Y', d2a_2: 'N', d2a_3: 'Y', d2a_4: 'Y' });
    expect(r).toContain('d2a_5');
  });

  it('should not require 2.5 when 2.4=N (early exit)', () => {
    const r = required('domain2a', { d2a_1: 'Y', d2a_2: 'N', d2a_3: 'Y', d2a_4: 'N' });
    expect(r).not.toContain('d2a_5');
  });

  it('should require 2.7 when 2.6=N', () => {
    const r = required('domain2a', { d2a_1: 'N', d2a_2: 'N', d2a_6: 'N' });
    expect(r).toContain('d2a_7');
  });

  it('should not require 2.7 when 2.6=Y', () => {
    const r = required('domain2a', { d2a_1: 'N', d2a_2: 'N', d2a_6: 'Y' });
    expect(r).not.toContain('d2a_7');
  });
});

// ---------------------------------------------------------------------------
// Domain 2b: Effect of adhering to intervention
// ---------------------------------------------------------------------------

describe('Domain 2b required questions', () => {
  it('should always require 2.1 and 2.2', () => {
    const r = required('domain2b', {});
    expect(r).toEqual(['d2b_1', 'd2b_2']);
  });

  it('should skip 2.3 and require 2.4/2.5 when both N/PN', () => {
    const r = required('domain2b', { d2b_1: 'N', d2b_2: 'N' });
    expect(r).not.toContain('d2b_3');
    expect(r).toContain('d2b_4');
    expect(r).toContain('d2b_5');
  });

  it('should not require 2.6 when 2.1=N, 2.2=N, 2.4=N, 2.5=N (Low exit)', () => {
    const r = required('domain2b', { d2b_1: 'N', d2b_2: 'N', d2b_4: 'N', d2b_5: 'N' });
    expect(r).not.toContain('d2b_6');
  });

  it('should require 2.6 when 2.1=N, 2.2=N, 2.4=Y', () => {
    const r = required('domain2b', { d2b_1: 'N', d2b_2: 'N', d2b_4: 'Y', d2b_5: 'N' });
    expect(r).toContain('d2b_6');
  });

  it('should require 2.3 when either 2.1 or 2.2 is Y', () => {
    const r = required('domain2b', { d2b_1: 'Y', d2b_2: 'N' });
    expect(r).toContain('d2b_3');
  });

  it('should require 2.4/2.5 when 2.3=Y', () => {
    const r = required('domain2b', { d2b_1: 'Y', d2b_2: 'N', d2b_3: 'Y' });
    expect(r).toContain('d2b_4');
    expect(r).toContain('d2b_5');
  });

  it('should skip 2.4/2.5 and require 2.6 when 2.3=N', () => {
    const r = required('domain2b', { d2b_1: 'Y', d2b_2: 'N', d2b_3: 'N' });
    expect(r).not.toContain('d2b_4');
    expect(r).not.toContain('d2b_5');
    expect(r).toContain('d2b_6');
  });
});

// ---------------------------------------------------------------------------
// Domain 3: Missing outcome data
// ---------------------------------------------------------------------------

describe('Domain 3 required questions', () => {
  it('should require only 3.1 initially', () => {
    expect(required('domain3', {})).toEqual(['d3_1']);
  });

  it('should not require 3.2-3.4 when 3.1=Y (Low exit)', () => {
    const r = required('domain3', { d3_1: 'Y' });
    expect(r).toEqual(['d3_1']);
  });

  it('should require 3.2 when 3.1=N', () => {
    const r = required('domain3', { d3_1: 'N' });
    expect(r).toContain('d3_2');
  });

  it('should not require 3.3 when 3.2=Y (Low exit)', () => {
    const r = required('domain3', { d3_1: 'N', d3_2: 'Y' });
    expect(r).not.toContain('d3_3');
  });

  it('should require 3.3 when 3.2=N', () => {
    const r = required('domain3', { d3_1: 'N', d3_2: 'N' });
    expect(r).toContain('d3_3');
  });

  it('should not require 3.4 when 3.3=N (Low exit)', () => {
    const r = required('domain3', { d3_1: 'N', d3_2: 'N', d3_3: 'N' });
    expect(r).not.toContain('d3_4');
  });

  it('should require 3.4 when 3.3=Y', () => {
    const r = required('domain3', { d3_1: 'N', d3_2: 'N', d3_3: 'Y' });
    expect(r).toContain('d3_4');
  });
});

// ---------------------------------------------------------------------------
// Domain 4: Measurement of the outcome
// ---------------------------------------------------------------------------

describe('Domain 4 required questions', () => {
  it('should require only 4.1 initially', () => {
    expect(required('domain4', {})).toEqual(['d4_1']);
  });

  it('should not require 4.2-4.5 when 4.1=Y (High exit)', () => {
    expect(required('domain4', { d4_1: 'Y' })).toEqual(['d4_1']);
  });

  it('should require 4.2 when 4.1=N', () => {
    expect(required('domain4', { d4_1: 'N' })).toContain('d4_2');
  });

  it('should not require 4.3-4.5 when 4.2=Y (High exit)', () => {
    const r = required('domain4', { d4_1: 'N', d4_2: 'Y' });
    expect(r).not.toContain('d4_3');
  });

  it('should require 4.3 when 4.2=N', () => {
    expect(required('domain4', { d4_1: 'N', d4_2: 'N' })).toContain('d4_3');
  });

  it('should not require 4.4 when 4.3=N on branch A (Low exit)', () => {
    const r = required('domain4', { d4_1: 'N', d4_2: 'N', d4_3: 'N' });
    expect(r).not.toContain('d4_4');
  });

  it('should require 4.4 when 4.3=Y', () => {
    expect(required('domain4', { d4_1: 'N', d4_2: 'N', d4_3: 'Y' })).toContain('d4_4');
  });

  it('should require 4.5 when 4.4=Y', () => {
    expect(required('domain4', { d4_1: 'N', d4_2: 'N', d4_3: 'Y', d4_4: 'Y' })).toContain('d4_5');
  });

  it('should not require 4.5 when 4.4=N (Low exit)', () => {
    const r = required('domain4', { d4_1: 'N', d4_2: 'N', d4_3: 'Y', d4_4: 'N' });
    expect(r).not.toContain('d4_5');
  });

  it('should require 4.3 on branch B when 4.2=NI', () => {
    expect(required('domain4', { d4_1: 'N', d4_2: 'NI' })).toContain('d4_3');
  });

  it('should not require 4.4 when 4.2=NI, 4.3=N (Some concerns exit)', () => {
    const r = required('domain4', { d4_1: 'N', d4_2: 'NI', d4_3: 'N' });
    expect(r).not.toContain('d4_4');
  });
});

// ---------------------------------------------------------------------------
// Domain 5: Selection of the reported result
// ---------------------------------------------------------------------------

describe('Domain 5 required questions', () => {
  it('should require 5.2 and 5.3 initially (not 5.1)', () => {
    expect(required('domain5', {})).toEqual(['d5_2', 'd5_3']);
  });

  it('should not require 5.1 when 5.2=Y (High exit)', () => {
    const r = required('domain5', { d5_2: 'Y', d5_3: 'N' });
    expect(r).not.toContain('d5_1');
  });

  it('should not require 5.1 when 5.2=NI (Some concerns exit)', () => {
    const r = required('domain5', { d5_2: 'NI', d5_3: 'N' });
    expect(r).not.toContain('d5_1');
  });

  it('should require 5.1 when both 5.2=N, 5.3=N', () => {
    const r = required('domain5', { d5_2: 'N', d5_3: 'N' });
    expect(r).toContain('d5_1');
  });
});
