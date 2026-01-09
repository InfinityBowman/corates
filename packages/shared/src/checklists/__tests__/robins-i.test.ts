import { describe, it, expect } from 'vitest';
import {
  createROBINSIChecklist,
  scoreROBINSIChecklist,
  isROBINSIComplete,
  shouldStopAssessment,
  getAnswers,
} from '../robins-i/index.js';
import { scoreRobinsDomain, JUDGEMENTS } from '../robins-i/scoring.js';

describe('ROBINS-I', () => {
  describe('createROBINSIChecklist', () => {
    it('should create a checklist with all required fields', () => {
      const checklist = createROBINSIChecklist({
        name: 'Test Checklist',
        id: 'test-123',
        reviewerName: 'Bob',
      });

      expect(checklist.name).toBe('Test Checklist');
      expect(checklist.id).toBe('test-123');
      expect(checklist.reviewerName).toBe('Bob');
      expect(checklist.checklistType).toBe('ROBINS_I');
      expect(checklist.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Check all sections exist
      expect(checklist.planning).toBeDefined();
      expect(checklist.sectionA).toBeDefined();
      expect(checklist.sectionB).toBeDefined();
      expect(checklist.sectionC).toBeDefined();
      expect(checklist.sectionD).toBeDefined();

      // Check all domains exist
      expect(checklist.domain1a).toBeDefined();
      expect(checklist.domain1b).toBeDefined();
      expect(checklist.domain2).toBeDefined();
      expect(checklist.domain3).toBeDefined();
      expect(checklist.domain4).toBeDefined();
      expect(checklist.domain5).toBeDefined();
      expect(checklist.domain6).toBeDefined();
    });

    it('should throw if id is missing', () => {
      expect(() =>
        createROBINSIChecklist({
          name: 'Test',
          id: '',
        }),
      ).toThrow('non-empty string id');
    });

    it('should throw if name is missing', () => {
      expect(() =>
        createROBINSIChecklist({
          name: '',
          id: 'test-123',
        }),
      ).toThrow('non-empty string name');
    });

    it('should initialize domains with empty answers', () => {
      const checklist = createROBINSIChecklist({
        name: 'Test',
        id: 'test-123',
      });

      // Domain 1A should have questions d1a_1 through d1a_4
      expect(checklist.domain1a.answers.d1a_1).toEqual({ answer: null, comment: '' });
      expect(checklist.domain1a.answers.d1a_4).toEqual({ answer: null, comment: '' });

      // Domain 6 should have questions d6_1 through d6_4
      expect(checklist.domain6.answers.d6_1).toEqual({ answer: null, comment: '' });
      expect(checklist.domain6.answers.d6_4).toEqual({ answer: null, comment: '' });
    });
  });

  describe('shouldStopAssessment', () => {
    it('should return false when B2 and B3 are not Yes/PY', () => {
      const sectionB = {
        b1: { answer: 'Y' as const, comment: '' },
        b2: { answer: 'N' as const, comment: '' },
        b3: { answer: 'N' as const, comment: '' },
        stopAssessment: false,
      };

      expect(shouldStopAssessment(sectionB)).toBe(false);
    });

    it('should return true when B2 is Yes', () => {
      const sectionB = {
        b1: { answer: 'N' as const, comment: '' },
        b2: { answer: 'Y' as const, comment: '' },
        b3: { answer: 'N' as const, comment: '' },
        stopAssessment: false,
      };

      expect(shouldStopAssessment(sectionB)).toBe(true);
    });

    it('should return true when B3 is Probably Yes', () => {
      const sectionB = {
        b1: { answer: 'Y' as const, comment: '' },
        b2: { answer: 'N' as const, comment: '' },
        b3: { answer: 'PY' as const, comment: '' },
        stopAssessment: false,
      };

      expect(shouldStopAssessment(sectionB)).toBe(true);
    });
  });

  describe('scoreRobinsDomain', () => {
    describe('Domain 1A', () => {
      it('should return null for incomplete answers', () => {
        const answers = {
          d1a_1: { answer: null, comment: '' },
        };

        const result = scoreRobinsDomain('domain1a', answers);
        expect(result.judgement).toBe(null);
        expect(result.isComplete).toBe(false);
      });

      it('should return Low (except confounding) for Y/Y/N/N path', () => {
        const answers = {
          d1a_1: { answer: 'Y', comment: '' },
          d1a_2: { answer: 'Y', comment: '' },
          d1a_3: { answer: 'N', comment: '' },
          d1a_4: { answer: 'N', comment: '' },
        };

        const result = scoreRobinsDomain('domain1a', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW_EXCEPT_CONFOUNDING);
        expect(result.isComplete).toBe(true);
      });

      it('should return Serious for SN on Q1', () => {
        const answers = {
          d1a_1: { answer: 'SN', comment: '' },
          d1a_2: { answer: null, comment: '' },
          d1a_3: { answer: null, comment: '' },
          d1a_4: { answer: 'N', comment: '' },
        };

        const result = scoreRobinsDomain('domain1a', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
        expect(result.isComplete).toBe(true);
      });
    });

    describe('Domain 5', () => {
      it('should return Serious when Q1 is Y/PY', () => {
        const answers = {
          d5_1: { answer: 'Y', comment: '' },
          d5_2: { answer: null, comment: '' },
          d5_3: { answer: null, comment: '' },
        };

        const result = scoreRobinsDomain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.SERIOUS);
        expect(result.isComplete).toBe(true);
      });

      it('should return Low when Q1=N, Q2=N', () => {
        const answers = {
          d5_1: { answer: 'N', comment: '' },
          d5_2: { answer: 'N', comment: '' },
          d5_3: { answer: null, comment: '' },
        };

        const result = scoreRobinsDomain('domain5', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
      });
    });

    describe('Domain 6', () => {
      it('should return Low when Q1 is Yes', () => {
        const answers = {
          d6_1: { answer: 'Y', comment: '' },
          d6_2: { answer: null, comment: '' },
          d6_3: { answer: null, comment: '' },
          d6_4: { answer: null, comment: '' },
        };

        const result = scoreRobinsDomain('domain6', answers);
        expect(result.judgement).toBe(JUDGEMENTS.LOW);
        expect(result.isComplete).toBe(true);
      });

      it('should return Critical when 2+ selection questions are Yes', () => {
        const answers = {
          d6_1: { answer: 'N', comment: '' },
          d6_2: { answer: 'Y', comment: '' },
          d6_3: { answer: 'Y', comment: '' },
          d6_4: { answer: 'N', comment: '' },
        };

        const result = scoreRobinsDomain('domain6', answers);
        expect(result.judgement).toBe(JUDGEMENTS.CRITICAL);
        expect(result.isComplete).toBe(true);
      });
    });
  });

  describe('scoreROBINSIChecklist', () => {
    it('should return Error for invalid input', () => {
      expect(scoreROBINSIChecklist(null as any)).toBe('Error');
    });

    it('should return Critical when assessment stopped early', () => {
      const checklist = createROBINSIChecklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.sectionB.b2.answer = 'Y';

      expect(scoreROBINSIChecklist(checklist)).toBe('Critical');
    });

    it('should return Incomplete when domains are not complete', () => {
      const checklist = createROBINSIChecklist({
        name: 'Test',
        id: 'test-123',
      });

      expect(scoreROBINSIChecklist(checklist)).toBe('Incomplete');
    });
  });

  describe('isROBINSIComplete', () => {
    it('should return false for empty checklist', () => {
      const checklist = createROBINSIChecklist({
        name: 'Test',
        id: 'test-123',
      });

      expect(isROBINSIComplete(checklist)).toBe(false);
    });

    it('should return true when assessment stopped early (Critical)', () => {
      const checklist = createROBINSIChecklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.sectionB.b2.answer = 'Y';

      expect(isROBINSIComplete(checklist)).toBe(true);
    });
  });

  describe('getAnswers', () => {
    it('should return null for invalid input', () => {
      expect(getAnswers(null as any)).toBe(null);
    });

    it('should return structured answers object', () => {
      const checklist = createROBINSIChecklist({
        name: 'Test',
        id: 'test-123',
        reviewerName: 'Bob',
      });

      const answers = getAnswers(checklist);
      expect(answers).not.toBe(null);
      expect(answers?.metadata.name).toBe('Test');
      expect(answers?.metadata.reviewerName).toBe('Bob');
      expect(answers?.sectionB).toBeDefined();
      expect(answers?.domains).toBeDefined();
    });
  });
});
