import { describe, it, expect } from 'vitest';
import {
  createROB2Checklist,
  scoreROB2Checklist,
  isROB2Complete,
  getAnswers,
  scoreAllDomains,
  JUDGEMENTS,
} from '../rob2/index.js';
import type { ROB2Response, ROB2QuestionAnswer } from '../types.js';

function makeAnswers(answerMap: Record<string, ROB2Response>) {
  const result: Record<string, ROB2QuestionAnswer> = {};
  for (const [key, value] of Object.entries(answerMap)) {
    result[key] = { answer: value, comment: '' };
  }
  return result;
}

describe('ROB-2', () => {
  describe('createROB2Checklist', () => {
    it('should create a checklist with all required fields', () => {
      const checklist = createROB2Checklist({
        name: 'Test Checklist',
        id: 'test-123',
        reviewerName: 'Alice',
      });

      expect(checklist.name).toBe('Test Checklist');
      expect(checklist.id).toBe('test-123');
      expect(checklist.reviewerName).toBe('Alice');
      expect(checklist.type).toBe('ROB2');
      expect(checklist.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Check preliminary section exists
      expect(checklist.preliminary).toBeDefined();
      expect(checklist.preliminary.aim).toBe(null);

      // Check all domains exist
      expect(checklist.domain1).toBeDefined();
      expect(checklist.domain2a).toBeDefined();
      expect(checklist.domain2b).toBeDefined();
      expect(checklist.domain3).toBeDefined();
      expect(checklist.domain4).toBeDefined();
      expect(checklist.domain5).toBeDefined();

      // Check overall section exists
      expect(checklist.overall).toBeDefined();
    });

    it('should throw if id is missing', () => {
      expect(() =>
        createROB2Checklist({
          name: 'Test',
          id: '',
        }),
      ).toThrow('non-empty string id');
    });

    it('should throw if name is missing', () => {
      expect(() =>
        createROB2Checklist({
          name: '',
          id: 'test-123',
        }),
      ).toThrow('non-empty string name');
    });

    it('should initialize domains with empty answers', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Domain 1 should have questions d1_1, d1_2, d1_3
      expect(checklist.domain1.answers.d1_1).toEqual({ answer: null, comment: '' });
      expect(checklist.domain1.answers.d1_2).toEqual({ answer: null, comment: '' });
      expect(checklist.domain1.answers.d1_3).toEqual({ answer: null, comment: '' });

      // Domain 5 should have questions d5_1, d5_2, d5_3
      expect(checklist.domain5.answers.d5_1).toEqual({ answer: null, comment: '' });
      expect(checklist.domain5.answers.d5_3).toEqual({ answer: null, comment: '' });
    });
  });

  describe('scoreAllDomains', () => {
    it('should return empty result for null state', () => {
      const result = scoreAllDomains(null);
      expect(result.domains).toEqual({});
      expect(result.overall).toBe(null);
      expect(result.isComplete).toBe(false);
    });

    it('should use domain2a for ASSIGNMENT aim', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.domains.domain2a).toBeDefined();
      expect(result.domains.domain2b).toBeUndefined();
    });

    it('should use domain2b for ADHERING aim', () => {
      const state = {
        preliminary: { aim: 'ADHERING' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2b: {
          answers: makeAnswers({
            d2b_1: 'N',
            d2b_2: 'N',
            d2b_4: 'N',
            d2b_5: 'N',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.domains.domain2b).toBeDefined();
      expect(result.domains.domain2a).toBeUndefined();
    });

    it('should return overall Low when all domains are Low', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(JUDGEMENTS.LOW);
      expect(result.isComplete).toBe(true);
    });

    it('should return overall Some concerns when any domain has Some concerns', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'Y' }) }, // Some concerns
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(JUDGEMENTS.SOME_CONCERNS);
      expect(result.isComplete).toBe(true);
    });

    it('should return overall High when any domain is High', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'N', d1_3: 'N' }) }, // High
        domain2a: {
          answers: makeAnswers({
            d2a_1: 'N',
            d2a_2: 'N',
            d2a_6: 'Y',
          }),
        },
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(JUDGEMENTS.HIGH);
      expect(result.isComplete).toBe(true);
    });

    it('should return incomplete when not all domains are scored', () => {
      const state = {
        preliminary: { aim: 'ASSIGNMENT' },
        domain1: { answers: makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' }) },
        domain2a: { answers: makeAnswers({ d2a_1: null, d2a_2: null }) }, // Incomplete
        domain3: { answers: makeAnswers({ d3_1: 'Y' }) },
        domain4: { answers: makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' }) },
        domain5: { answers: makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' }) },
      };

      const result = scoreAllDomains(state);
      expect(result.overall).toBe(null);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('scoreROB2Checklist', () => {
    it('should return Error for invalid input', () => {
      expect(scoreROB2Checklist(null as any)).toBe('Error');
      expect(scoreROB2Checklist(undefined as any)).toBe('Error');
      expect(scoreROB2Checklist('string' as any)).toBe('Error');
    });

    it('should return Incomplete when domains are not complete', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      expect(scoreROB2Checklist(checklist)).toBe('Incomplete');
    });

    it('should return Low when all domains score Low', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.preliminary.aim = 'ASSIGNMENT';
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });
      checklist.domain2a.answers = makeAnswers({
        d2a_1: 'N',
        d2a_2: 'N',
        d2a_6: 'Y',
      });
      checklist.domain3.answers = makeAnswers({ d3_1: 'Y' });
      checklist.domain4.answers = makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' });
      checklist.domain5.answers = makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' });

      expect(scoreROB2Checklist(checklist)).toBe('Low');
    });
  });

  describe('isROB2Complete', () => {
    it('should return false for empty checklist', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      expect(isROB2Complete(checklist)).toBe(false);
    });

    it('should return false when aim is not selected', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Fill in all answers but don't select aim
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });

      expect(isROB2Complete(checklist)).toBe(false);
    });

    it('should return true when all domains are complete', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.preliminary.aim = 'ASSIGNMENT';
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });
      checklist.domain2a.answers = makeAnswers({
        d2a_1: 'N',
        d2a_2: 'N',
        d2a_6: 'Y',
      });
      checklist.domain3.answers = makeAnswers({ d3_1: 'Y' });
      checklist.domain4.answers = makeAnswers({ d4_1: 'N', d4_2: 'N', d4_3: 'N' });
      checklist.domain5.answers = makeAnswers({ d5_1: 'Y', d5_2: 'N', d5_3: 'N' });

      expect(isROB2Complete(checklist)).toBe(true);
    });
  });

  describe('getAnswers', () => {
    it('should return null for invalid input', () => {
      expect(getAnswers(null as any)).toBe(null);
    });

    it('should return structured answers object', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
        reviewerName: 'Alice',
      });

      const answers = getAnswers(checklist);
      expect(answers).not.toBe(null);
      expect(answers?.metadata.name).toBe('Test');
      expect(answers?.metadata.reviewerName).toBe('Alice');
      expect(answers?.preliminary).toBeDefined();
      expect(answers?.domains).toBeDefined();
      expect(answers?.overall).toBeDefined();
    });

    it('should include domain answers when filled', () => {
      const checklist = createROB2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.preliminary.aim = 'ASSIGNMENT';
      checklist.domain1.answers = makeAnswers({ d1_1: 'Y', d1_2: 'Y', d1_3: 'N' });

      const answers = getAnswers(checklist);
      expect(answers?.domains.domain1).toBeDefined();
      expect(answers?.domains.domain1.questions.d1_1).toBe('Y');
      expect(answers?.domains.domain1.questions.d1_2).toBe('Y');
      expect(answers?.domains.domain1.questions.d1_3).toBe('N');
    });
  });
});
