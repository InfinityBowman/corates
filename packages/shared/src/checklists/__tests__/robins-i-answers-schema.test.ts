import { describe, it, expect } from 'vitest';
import {
  RobinsIDomainUpdateSchema,
  RobinsISectionBUpdateSchema,
  RobinsISectionDUpdateSchema,
  ROBINS_I_KEY_SCHEMAS,
  isRobinsIKey,
} from '../robins-i/answers-schema.js';

describe('ROBINS-I answer-payload schemas', () => {
  it('accepts partial domain updates (direction only)', () => {
    const parsed = RobinsIDomainUpdateSchema.parse({ direction: 'Favours intervention' });
    expect(parsed.direction).toBe('Favours intervention');
    expect(parsed.judgement).toBeUndefined();
  });

  it('accepts full domain update with answers record', () => {
    const parsed = RobinsIDomainUpdateSchema.parse({
      judgement: 'Moderate',
      direction: null,
      answers: {
        d1_1: { answer: 'Y', comment: 'rationale' },
        d1_2: { answer: null },
      },
    });
    expect(parsed.answers?.d1_1?.answer).toBe('Y');
    expect(parsed.answers?.d1_2?.answer).toBeNull();
  });

  it('rejects unknown keys on domain update (strict)', () => {
    expect(() =>
      RobinsIDomainUpdateSchema.parse({ judgement: 'Low', bogus: true } as unknown),
    ).toThrow();
  });

  it('accepts sectionB partial (b1 only)', () => {
    const parsed = RobinsISectionBUpdateSchema.parse({ b1: { answer: 'Y' } });
    expect(parsed.b1?.answer).toBe('Y');
  });

  it('accepts sectionB with stopAssessment flag', () => {
    const parsed = RobinsISectionBUpdateSchema.parse({ stopAssessment: true });
    expect(parsed.stopAssessment).toBe(true);
  });

  it('accepts sectionD partial', () => {
    const parsed = RobinsISectionDUpdateSchema.parse({
      sources: { 'Journal article(s)': true },
      otherSpecify: 'extra',
    });
    expect(parsed.sources?.['Journal article(s)']).toBe(true);
    expect(parsed.otherSpecify).toBe('extra');
  });

  it('isRobinsIKey accepts known section keys', () => {
    expect(isRobinsIKey('sectionB')).toBe(true);
    expect(isRobinsIKey('domain1a')).toBe(true);
    expect(isRobinsIKey('domain6')).toBe(true);
    expect(isRobinsIKey('overall')).toBe(true);
    expect(isRobinsIKey('garbage')).toBe(false);
  });

  it('ROBINS_I_KEY_SCHEMAS covers every expected section', () => {
    const expected = [
      'planning',
      'sectionA',
      'sectionB',
      'sectionC',
      'sectionD',
      'confoundingEvaluation',
      'domain1a',
      'domain1b',
      'domain2',
      'domain3',
      'domain4',
      'domain5',
      'domain6',
      'overall',
    ];
    expect(Object.keys(ROBINS_I_KEY_SCHEMAS).sort()).toEqual(expected.sort());
  });
});
