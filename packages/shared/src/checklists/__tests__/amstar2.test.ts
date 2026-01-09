import { describe, it, expect } from 'vitest';
import {
  createAMSTAR2Checklist,
  scoreAMSTAR2Checklist,
  isAMSTAR2Complete,
  getSelectedAnswer,
  getAnswers,
  consolidateAnswers,
} from '../amstar2/index.js';

describe('AMSTAR2', () => {
  describe('createAMSTAR2Checklist', () => {
    it('should create a checklist with all required fields', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test Checklist',
        id: 'test-123',
        reviewerName: 'Alice',
      });

      expect(checklist.name).toBe('Test Checklist');
      expect(checklist.id).toBe('test-123');
      expect(checklist.reviewerName).toBe('Alice');
      expect(checklist.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Check all questions exist
      expect(checklist.q1).toBeDefined();
      expect(checklist.q2).toBeDefined();
      expect(checklist.q9a).toBeDefined();
      expect(checklist.q9b).toBeDefined();
      expect(checklist.q16).toBeDefined();
    });

    it('should throw if id is missing', () => {
      expect(() =>
        createAMSTAR2Checklist({
          name: 'Test',
          id: '',
        }),
      ).toThrow('non-empty string id');
    });

    it('should throw if name is missing', () => {
      expect(() =>
        createAMSTAR2Checklist({
          name: '',
          id: 'test-123',
        }),
      ).toThrow('non-empty string name');
    });

    it('should set critical flags correctly', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Critical questions: q2, q4, q7, q9a, q9b, q11a, q11b, q13, q15
      expect(checklist.q2.critical).toBe(true);
      expect(checklist.q4.critical).toBe(true);
      expect(checklist.q7.critical).toBe(true);
      expect(checklist.q9a.critical).toBe(true);
      expect(checklist.q9b.critical).toBe(true);
      expect(checklist.q11a.critical).toBe(true);
      expect(checklist.q11b.critical).toBe(true);
      expect(checklist.q13.critical).toBe(true);
      expect(checklist.q15.critical).toBe(true);

      // Non-critical questions
      expect(checklist.q1.critical).toBe(false);
      expect(checklist.q3.critical).toBe(false);
      expect(checklist.q5.critical).toBe(false);
      expect(checklist.q6.critical).toBe(false);
    });
  });

  describe('getSelectedAnswer', () => {
    it('should return Yes for first option selected in 2-option question', () => {
      const answers = [[false], [true, false]];
      expect(getSelectedAnswer(answers, 'q1')).toBe('Yes');
    });

    it('should return No for second option selected in 2-option question', () => {
      const answers = [[false], [false, true]];
      expect(getSelectedAnswer(answers, 'q1')).toBe('No');
    });

    it('should return Partial Yes for second option in 3-option question', () => {
      const answers = [
        [false, false, false],
        [false, true, false],
      ];
      expect(getSelectedAnswer(answers, 'q2')).toBe('Partial Yes');
    });

    it('should return null if no option selected', () => {
      const answers = [[false], [false, false]];
      expect(getSelectedAnswer(answers, 'q1')).toBe(null);
    });

    it('should handle No MA for questions with that option', () => {
      const answers = [
        [false, false, false],
        [false, false, true],
      ];
      expect(getSelectedAnswer(answers, 'q11a')).toBe('No MA');
    });
  });

  describe('isAMSTAR2Complete', () => {
    it('should return false for empty checklist', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      expect(isAMSTAR2Complete(checklist)).toBe(false);
    });

    it('should return true when all questions answered', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Set all final column answers to true (first option = Yes)
      checklist.q1.answers[2][0] = true;
      checklist.q2.answers[2][0] = true;
      checklist.q3.answers[1][0] = true;
      checklist.q4.answers[2][0] = true;
      checklist.q5.answers[1][0] = true;
      checklist.q6.answers[1][0] = true;
      checklist.q7.answers[2][0] = true;
      checklist.q8.answers[2][0] = true;
      checklist.q9a.answers[2][0] = true;
      checklist.q9b.answers[2][0] = true;
      checklist.q10.answers[1][0] = true;
      checklist.q11a.answers[1][0] = true;
      checklist.q11b.answers[1][0] = true;
      checklist.q12.answers[1][0] = true;
      checklist.q13.answers[1][0] = true;
      checklist.q14.answers[1][0] = true;
      checklist.q15.answers[1][0] = true;
      checklist.q16.answers[1][0] = true;

      expect(isAMSTAR2Complete(checklist)).toBe(true);
    });
  });

  describe('scoreAMSTAR2Checklist', () => {
    it('should return Error for invalid input', () => {
      expect(scoreAMSTAR2Checklist(null as any)).toBe('Error');
    });

    it('should return High when all answers are Yes', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Set all final column answers to true (first option = Yes)
      checklist.q1.answers[2][0] = true;
      checklist.q2.answers[2][0] = true;
      checklist.q3.answers[1][0] = true;
      checklist.q4.answers[2][0] = true;
      checklist.q5.answers[1][0] = true;
      checklist.q6.answers[1][0] = true;
      checklist.q7.answers[2][0] = true;
      checklist.q8.answers[2][0] = true;
      checklist.q9a.answers[2][0] = true;
      checklist.q9b.answers[2][0] = true;
      checklist.q10.answers[1][0] = true;
      checklist.q11a.answers[1][0] = true;
      checklist.q11b.answers[1][0] = true;
      checklist.q12.answers[1][0] = true;
      checklist.q13.answers[1][0] = true;
      checklist.q14.answers[1][0] = true;
      checklist.q15.answers[1][0] = true;
      checklist.q16.answers[1][0] = true;

      expect(scoreAMSTAR2Checklist(checklist)).toBe('High');
    });

    it('should return Critically Low with more than one critical flaw', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      // Set most answers to Yes
      checklist.q1.answers[2][0] = true;
      checklist.q3.answers[1][0] = true;
      checklist.q5.answers[1][0] = true;
      checklist.q6.answers[1][0] = true;
      checklist.q8.answers[2][0] = true;
      checklist.q10.answers[1][0] = true;
      checklist.q12.answers[1][0] = true;
      checklist.q14.answers[1][0] = true;
      checklist.q16.answers[1][0] = true;

      // Set multiple critical questions to No
      checklist.q2.answers[2][2] = true; // No
      checklist.q4.answers[2][2] = true; // No (more than 1 critical flaw)
      checklist.q7.answers[2][0] = true;
      checklist.q9a.answers[2][0] = true;
      checklist.q9b.answers[2][0] = true;
      checklist.q11a.answers[1][0] = true;
      checklist.q11b.answers[1][0] = true;
      checklist.q13.answers[1][0] = true;
      checklist.q15.answers[1][0] = true;

      expect(scoreAMSTAR2Checklist(checklist)).toBe('Critically Low');
    });
  });

  describe('consolidateAnswers', () => {
    it('should merge q9a and q9b into q9', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.q9a.answers[2][0] = true; // Yes
      checklist.q9b.answers[2][0] = true; // Yes

      const consolidated = consolidateAnswers(checklist);

      expect(consolidated.q9).toBeDefined();
      expect(consolidated.q9a).toBeUndefined();
      expect(consolidated.q9b).toBeUndefined();
    });

    it('should merge q11a and q11b into q11', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.q11a.answers[1][0] = true; // Yes
      checklist.q11b.answers[1][0] = true; // Yes

      const consolidated = consolidateAnswers(checklist);

      expect(consolidated.q11).toBeDefined();
      expect(consolidated.q11a).toBeUndefined();
      expect(consolidated.q11b).toBeUndefined();
    });
  });

  describe('getAnswers', () => {
    it('should return null for invalid input', () => {
      expect(getAnswers(null as any)).toBe(null);
    });

    it('should return answers object with selected values', () => {
      const checklist = createAMSTAR2Checklist({
        name: 'Test',
        id: 'test-123',
      });

      checklist.q1.answers[2][0] = true; // Yes

      const answers = getAnswers(checklist);
      expect(answers).not.toBe(null);
      expect(answers?.q1).toBe('Yes');
    });
  });
});
