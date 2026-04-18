import { describe, it, expect } from 'vitest';
import {
  Rob2DomainUpdateSchema,
  Rob2OverallUpdateSchema,
  Rob2PreliminaryUpdateSchema,
  ROB2_KEY_SCHEMAS,
  isRob2Key,
} from '../rob2/answers-schema.js';

describe('RoB2 answer-payload schemas', () => {
  it('accepts partial domain update (answers only)', () => {
    const parsed = Rob2DomainUpdateSchema.parse({
      answers: { d1_1: { answer: 'Y' } },
    });
    expect(parsed.answers?.d1_1?.answer).toBe('Y');
  });

  it('accepts full domain update', () => {
    const parsed = Rob2DomainUpdateSchema.parse({
      judgement: 'Low',
      direction: 'NA',
      answers: {
        d1_1: { answer: 'Y', comment: 'ok' },
      },
    });
    expect(parsed.judgement).toBe('Low');
    expect(parsed.direction).toBe('NA');
  });

  it('rejects unknown keys on domain update (strict)', () => {
    expect(() => Rob2DomainUpdateSchema.parse({ judgement: 'Low', foo: 1 } as unknown)).toThrow();
  });

  it('accepts overall update', () => {
    const parsed = Rob2OverallUpdateSchema.parse({ judgement: 'High', direction: null });
    expect(parsed.judgement).toBe('High');
    expect(parsed.direction).toBeNull();
  });

  it('accepts full preliminary payload including text fields', () => {
    const parsed = Rob2PreliminaryUpdateSchema.parse({
      studyDesign: 'Individually-randomized parallel-group trial',
      aim: 'ASSIGNMENT',
      deviationsToAddress: [],
      sources: { 'Journal article(s)': true },
      experimental: 'Drug X',
      comparator: 'Placebo',
      numericalResult: 'RR=1.5',
    });
    expect(parsed.experimental).toBe('Drug X');
    expect(parsed.sources?.['Journal article(s)']).toBe(true);
  });

  it('accepts preliminary reset payload', () => {
    const parsed = Rob2PreliminaryUpdateSchema.parse({
      studyDesign: null,
      aim: null,
      deviationsToAddress: [],
      sources: {},
      experimental: '',
      comparator: '',
      numericalResult: '',
    });
    expect(parsed.studyDesign).toBeNull();
  });

  it('isRob2Key narrows known keys', () => {
    expect(isRob2Key('preliminary')).toBe(true);
    expect(isRob2Key('domain2b')).toBe(true);
    expect(isRob2Key('overall')).toBe(true);
    expect(isRob2Key('sectionB')).toBe(false);
  });

  it('ROB2_KEY_SCHEMAS covers every expected section', () => {
    const expected = [
      'preliminary',
      'domain1',
      'domain2a',
      'domain2b',
      'domain3',
      'domain4',
      'domain5',
      'overall',
    ];
    expect(Object.keys(ROB2_KEY_SCHEMAS).sort()).toEqual(expected.sort());
  });
});
