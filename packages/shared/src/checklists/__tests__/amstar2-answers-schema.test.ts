import { describe, it, expect } from 'vitest';
import {
  Amstar2QuestionAnswerSchema,
  AMSTAR2_KEY_SCHEMAS,
  isAmstar2Key,
} from '../amstar2/answers-schema.js';

describe('Amstar2 answer-payload schemas', () => {
  it('accepts a well-formed answer payload', () => {
    const parsed = Amstar2QuestionAnswerSchema.parse({
      answers: [
        [true, false],
        [false, true],
      ],
      critical: true,
    });
    expect(parsed.answers).toHaveLength(2);
    expect(parsed.critical).toBe(true);
  });

  it('allows critical to be omitted', () => {
    const parsed = Amstar2QuestionAnswerSchema.parse({
      answers: [[true, false]],
    });
    expect(parsed.critical).toBeUndefined();
  });

  it('rejects non-boolean matrix entries', () => {
    expect(() =>
      Amstar2QuestionAnswerSchema.parse({
        answers: [['oops' as unknown as boolean]],
      }),
    ).toThrow();
  });

  it('rejects missing answers field', () => {
    expect(() =>
      Amstar2QuestionAnswerSchema.parse({ critical: false } as unknown),
    ).toThrow();
  });

  it('isAmstar2Key narrows known and rejects unknown keys', () => {
    expect(isAmstar2Key('q1')).toBe(true);
    expect(isAmstar2Key('q9a')).toBe(true);
    expect(isAmstar2Key('q11b')).toBe(true);
    expect(isAmstar2Key('q17')).toBe(false);
    expect(isAmstar2Key('notes')).toBe(false);
  });

  it('AMSTAR2_KEY_SCHEMAS covers every AMSTAR2 data key', () => {
    const expectedKeys = [
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
    ];
    expect(Object.keys(AMSTAR2_KEY_SCHEMAS).sort()).toEqual(expectedKeys.sort());
  });
});
