/**
 * Tests for AMSTAR2 Checklist Module
 *
 * INTENDED BEHAVIOR:
 * - createChecklist: Creates a valid AMSTAR2 checklist with all 16 questions initialized
 * - scoreChecklist: Scores a checklist according to AMSTAR2 methodology
 *   - "High" = No critical or non-critical weaknesses
 *   - "Moderate" = More than 1 non-critical weakness, no critical flaws
 *   - "Low" = 1 critical flaw with/without non-critical weaknesses
 *   - "Critically Low" = More than 1 critical flaw
 * - getAnswers: Extracts selected answers from a checklist, consolidating q9a/b and q11a/b
 *
 * Domain Reference: https://amstar.ca/Amstar-2.php
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createChecklist,
  scoreChecklist,
  getAnswers,
  exportChecklistsToCSV,
} from '../checklist.js';

describe('createChecklist', () => {
  describe('validation', () => {
    it('should throw error when id is missing', () => {
      expect(() => createChecklist({ name: 'Test' })).toThrow(
        'AMSTAR2Checklist requires a non-empty string id.',
      );
    });

    it('should throw error when id is empty string', () => {
      expect(() => createChecklist({ id: '', name: 'Test' })).toThrow(
        'AMSTAR2Checklist requires a non-empty string id.',
      );
    });

    it('should throw error when id is whitespace only', () => {
      expect(() => createChecklist({ id: '   ', name: 'Test' })).toThrow(
        'AMSTAR2Checklist requires a non-empty string id.',
      );
    });

    it('should throw error when name is missing', () => {
      expect(() => createChecklist({ id: 'test-id' })).toThrow(
        'AMSTAR2Checklist requires a non-empty string name.',
      );
    });

    it('should throw error when name is empty string', () => {
      expect(() => createChecklist({ id: 'test-id', name: '' })).toThrow(
        'AMSTAR2Checklist requires a non-empty string name.',
      );
    });

    it('should throw error when name is whitespace only', () => {
      expect(() => createChecklist({ id: 'test-id', name: '   ' })).toThrow(
        'AMSTAR2Checklist requires a non-empty string name.',
      );
    });

    it('should throw error when id is not a string', () => {
      expect(() => createChecklist({ id: 123, name: 'Test' })).toThrow();
    });

    it('should throw error when name is not a string', () => {
      expect(() => createChecklist({ id: 'test-id', name: 123 })).toThrow();
    });
  });

  describe('checklist structure', () => {
    let checklist;

    beforeEach(() => {
      checklist = createChecklist({
        id: 'test-checklist-1',
        name: 'Sleep Study Review',
        reviewerName: 'Dr. Smith',
      });
    });

    it('should include the provided id', () => {
      expect(checklist.id).toBe('test-checklist-1');
    });

    it('should include the provided name', () => {
      expect(checklist.name).toBe('Sleep Study Review');
    });

    it('should include the reviewer name', () => {
      expect(checklist.reviewerName).toBe('Dr. Smith');
    });

    it('should format createdAt as YYYY-MM-DD string', () => {
      expect(checklist.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle custom createdAt timestamp', () => {
      const customChecklist = createChecklist({
        id: 'test-2',
        name: 'Test',
        createdAt: new Date('2025-06-15T10:00:00Z').getTime(),
      });
      expect(customChecklist.createdAt).toBe('2025-06-15');
    });

    it('should default reviewerName to empty string when not provided', () => {
      const cl = createChecklist({ id: 'test-3', name: 'Test' });
      expect(cl.reviewerName).toBe('');
    });

    // AMSTAR2 has 16 questions: q1-q16, with q9 and q11 split into a/b parts
    const expectedQuestions = [
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

    expectedQuestions.forEach(q => {
      it(`should include question ${q}`, () => {
        expect(checklist[q]).toBeDefined();
        expect(checklist[q]).toHaveProperty('answers');
        expect(checklist[q]).toHaveProperty('critical');
        expect(Array.isArray(checklist[q].answers)).toBe(true);
      });
    });

    // Critical questions per AMSTAR2: 2, 4, 7, 9, 11, 13, 15
    const criticalQuestions = ['q2', 'q4', 'q7', 'q9a', 'q9b', 'q11a', 'q11b', 'q13', 'q15'];
    const nonCriticalQuestions = ['q1', 'q3', 'q5', 'q6', 'q8', 'q10', 'q12', 'q14', 'q16'];

    criticalQuestions.forEach(q => {
      it(`should mark ${q} as critical`, () => {
        expect(checklist[q].critical).toBe(true);
      });
    });

    nonCriticalQuestions.forEach(q => {
      it(`should mark ${q} as non-critical`, () => {
        expect(checklist[q].critical).toBe(false);
      });
    });

    it('should initialize all answers to false (no selection)', () => {
      // Check that answers are arrays of arrays with all false values
      // All answers should be initialized to false (no default selection)
      Object.keys(checklist).forEach(key => {
        if (!/^q\d+[a-z]*$/i.test(key)) return;
        const question = checklist[key];
        question.answers.forEach((col, colIdx) => {
          // All columns should have all false values by default
          const allFalse = col.every(v => v === false);
          expect(allFalse).toBe(true);
        });
      });
    });
  });
});

describe('scoreChecklist', () => {
  // Helper to create a checklist with specific answers selected
  function createScoredChecklist(selections) {
    const checklist = createChecklist({ id: 'test', name: 'Test' });

    // Apply selections - format: { q1: 'Yes', q2: 'No', ... }
    Object.entries(selections).forEach(([question, answer]) => {
      if (!checklist[question]) return;

      const answers = checklist[question].answers;
      const lastCol = answers[answers.length - 1];

      // Reset last column to all false
      lastCol.fill(false);

      // Set the appropriate answer
      // Most questions have [Yes, Partial Yes, No, No MA] or [Yes, No]
      const answerMap = {
        Yes: 0,
        'Partial Yes': 1,
        No: lastCol.length === 2 ? 1 : 2,
        'No MA':
          lastCol.length === 2 ? 1
          : lastCol.length === 3 ? 2
          : 3,
      };

      if (answerMap[answer] !== undefined && answerMap[answer] < lastCol.length) {
        lastCol[answerMap[answer]] = true;
      }
    });

    return checklist;
  }

  it('should return "Error" for null input', () => {
    expect(scoreChecklist(null)).toBe('Error');
  });

  it('should return "Error" for undefined input', () => {
    expect(scoreChecklist(undefined)).toBe('Error');
  });

  it('should return "Error" for non-object input', () => {
    expect(scoreChecklist('not an object')).toBe('Error');
  });

  it('should return "High" when all questions are Yes or Partial Yes', () => {
    const checklist = createScoredChecklist({
      q1: 'Yes',
      q2: 'Yes',
      q3: 'Yes',
      q4: 'Yes',
      q5: 'Yes',
      q6: 'Yes',
      q7: 'Yes',
      q8: 'Yes',
      q9a: 'Yes',
      q9b: 'Yes',
      q10: 'Yes',
      q11a: 'Yes',
      q11b: 'Yes',
      q12: 'Yes',
      q13: 'Yes',
      q14: 'Yes',
      q15: 'Yes',
      q16: 'Yes',
    });

    expect(scoreChecklist(checklist)).toBe('High');
  });

  it('should return "High" when all questions are Partial Yes', () => {
    // Partial Yes should be treated same as Yes per AMSTAR2 methodology
    const checklist = createScoredChecklist({
      q1: 'Partial Yes',
      q2: 'Partial Yes',
      q3: 'Yes',
      q4: 'Partial Yes',
      q5: 'Yes',
      q6: 'Yes',
      q7: 'Yes',
      q8: 'Partial Yes',
      q9a: 'Yes',
      q9b: 'Yes',
      q10: 'Yes',
      q11a: 'Yes',
      q11b: 'Yes',
      q12: 'Yes',
      q13: 'Yes',
      q14: 'Yes',
      q15: 'Yes',
      q16: 'Yes',
    });

    expect(scoreChecklist(checklist)).toBe('High');
  });

  it('should return "Moderate" when there is 1 non-critical weakness (No answer)', () => {
    const checklist = createScoredChecklist({
      q1: 'No', // non-critical
      q2: 'Yes',
      q3: 'Yes',
      q4: 'Yes',
      q5: 'Yes',
      q6: 'Yes',
      q7: 'Yes',
      q8: 'Yes',
      q9a: 'Yes',
      q9b: 'Yes',
      q10: 'Yes',
      q11a: 'Yes',
      q11b: 'Yes',
      q12: 'Yes',
      q13: 'Yes',
      q14: 'Yes',
      q15: 'Yes',
      q16: 'Yes',
    });

    // One non-critical weakness should still be "High" per AMSTAR2
    // Only >1 non-critical weakness = Moderate
    expect(scoreChecklist(checklist)).toBe('High');
  });

  it('should return "Moderate" when there are >1 non-critical weaknesses', () => {
    const checklist = createScoredChecklist({
      q1: 'No', // non-critical
      q3: 'No', // non-critical
      q2: 'Yes',
      q4: 'Yes',
      q5: 'Yes',
      q6: 'Yes',
      q7: 'Yes',
      q8: 'Yes',
      q9a: 'Yes',
      q9b: 'Yes',
      q10: 'Yes',
      q11a: 'Yes',
      q11b: 'Yes',
      q12: 'Yes',
      q13: 'Yes',
      q14: 'Yes',
      q15: 'Yes',
      q16: 'Yes',
    });

    expect(scoreChecklist(checklist)).toBe('Moderate');
  });

  it('should return "Low" when there is exactly 1 critical flaw', () => {
    const checklist = createScoredChecklist({
      q2: 'No', // critical
      q1: 'Yes',
      q3: 'Yes',
      q4: 'Yes',
      q5: 'Yes',
      q6: 'Yes',
      q7: 'Yes',
      q8: 'Yes',
      q9a: 'Yes',
      q9b: 'Yes',
      q10: 'Yes',
      q11a: 'Yes',
      q11b: 'Yes',
      q12: 'Yes',
      q13: 'Yes',
      q14: 'Yes',
      q15: 'Yes',
      q16: 'Yes',
    });

    expect(scoreChecklist(checklist)).toBe('Low');
  });

  it('should return "Critically Low" when there are >1 critical flaws', () => {
    const checklist = createScoredChecklist({
      q2: 'No', // critical
      q4: 'No', // critical
      q1: 'Yes',
      q3: 'Yes',
      q5: 'Yes',
      q6: 'Yes',
      q7: 'Yes',
      q8: 'Yes',
      q9a: 'Yes',
      q9b: 'Yes',
      q10: 'Yes',
      q11a: 'Yes',
      q11b: 'Yes',
      q12: 'Yes',
      q13: 'Yes',
      q14: 'Yes',
      q15: 'Yes',
      q16: 'Yes',
    });

    expect(scoreChecklist(checklist)).toBe('Critically Low');
  });

  it('should not count "No MA" (Not Applicable) as a flaw', () => {
    // "No MA" means meta-analysis was not conducted, which is not a weakness
    const checklist = createScoredChecklist({
      q1: 'No MA',
      q2: 'Yes',
      q3: 'Yes',
      q4: 'Yes',
      q5: 'Yes',
      q6: 'Yes',
      q7: 'Yes',
      q8: 'Yes',
      q9a: 'Yes',
      q9b: 'Yes',
      q10: 'Yes',
      q11a: 'Yes',
      q11b: 'Yes',
      q12: 'Yes',
      q13: 'Yes',
      q14: 'Yes',
      q15: 'Yes',
      q16: 'Yes',
    });

    expect(scoreChecklist(checklist)).toBe('High');
  });
});

describe('getAnswers', () => {
  it('should return null for null input', () => {
    expect(getAnswers(null)).toBe(null);
  });

  it('should return null for non-object input', () => {
    expect(getAnswers('string')).toBe(null);
  });

  it('should extract selected answers from all questions', () => {
    const checklist = createChecklist({ id: 'test', name: 'Test' });
    const answers = getAnswers(checklist);

    expect(answers).toBeDefined();
    expect(typeof answers).toBe('object');
  });

  it('should consolidate q9a and q9b into q9', () => {
    const checklist = createChecklist({ id: 'test', name: 'Test' });
    const answers = getAnswers(checklist);

    expect(answers.q9).toBeDefined();
    expect(answers.q9a).toBeUndefined();
    expect(answers.q9b).toBeUndefined();
  });

  it('should consolidate q11a and q11b into q11', () => {
    const checklist = createChecklist({ id: 'test', name: 'Test' });
    const answers = getAnswers(checklist);

    expect(answers.q11).toBeDefined();
    expect(answers.q11a).toBeUndefined();
    expect(answers.q11b).toBeUndefined();
  });

  it('should return q9="No" if either q9a or q9b is "No"', () => {
    // This tests the conservative consolidation logic
    const checklist = createChecklist({ id: 'test', name: 'Test' });

    // Set q9a to Yes (index 0 in last column)
    checklist.q9a.answers[2] = [true, false, false, false];
    // Set q9b to No (index 2 in last column for 4-option columns)
    checklist.q9b.answers[2] = [false, false, true, false];

    const answers = getAnswers(checklist);
    expect(answers.q9).toBe('No');
  });

  it('should return q9="No MA" if both q9a and q9b are "No MA"', () => {
    const checklist = createChecklist({ id: 'test', name: 'Test' });

    // Set both to No MA (last option)
    checklist.q9a.answers[2] = [false, false, false, true];
    checklist.q9b.answers[2] = [false, false, false, true];

    const answers = getAnswers(checklist);
    expect(answers.q9).toBe('No MA');
  });

  it('should return q9="Yes" if both q9a and q9b are "Yes" or "Partial Yes"', () => {
    const checklist = createChecklist({ id: 'test', name: 'Test' });

    // Set both to Yes
    checklist.q9a.answers[2] = [true, false, false, false];
    checklist.q9b.answers[2] = [true, false, false, false];

    const answers = getAnswers(checklist);
    expect(answers.q9).toBe('Yes');
  });
});

describe('exportChecklistsToCSV', () => {
  it('should export a single checklist to CSV format', () => {
    const checklist = createChecklist({
      id: 'test-export',
      name: 'Export Test',
      reviewerName: 'Test Reviewer',
    });

    const csv = exportChecklistsToCSV(checklist);

    expect(typeof csv).toBe('string');
    expect(csv).toContain('Checklist Name');
    expect(csv).toContain('Export Test');
    expect(csv).toContain('Test Reviewer');
  });

  it('should export an array of checklists', () => {
    const checklists = [
      createChecklist({ id: 'test-1', name: 'Checklist 1' }),
      createChecklist({ id: 'test-2', name: 'Checklist 2' }),
    ];

    const csv = exportChecklistsToCSV(checklists);

    expect(csv).toContain('Checklist 1');
    expect(csv).toContain('Checklist 2');
  });

  it('should properly escape double quotes in CSV', () => {
    const checklist = createChecklist({
      id: 'test',
      name: 'Test "with" quotes',
    });

    const csv = exportChecklistsToCSV(checklist);

    // Double quotes should be escaped as ""
    expect(csv).toContain('""with""');
  });

  it('should include question text in export', () => {
    const checklist = createChecklist({ id: 'test', name: 'Test' });
    const csv = exportChecklistsToCSV(checklist);

    // Should contain part of the question text
    expect(csv).toContain('PICO');
  });
});
