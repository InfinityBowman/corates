/**
 * AMSTAR2 Checklist Creation
 *
 * Creates new checklist objects with proper structure and defaults.
 */

import type { AMSTAR2Checklist, AMSTAR2Question } from '../types.js';

interface CreateChecklistOptions {
  name: string;
  id: string;
  createdAt?: number | Date;
  reviewerName?: string;
}

/**
 * Creates a new AMSTAR2 checklist object with default empty answers for all questions.
 *
 * @param options - Checklist properties.
 * @param options.name - The checklist name (required).
 * @param options.id - Unique checklist ID (required).
 * @param options.createdAt - Timestamp of checklist creation.
 * @param options.reviewerName - Name of the reviewer.
 *
 * @returns A checklist object with all AMSTAR2 questions initialized to default answers.
 *
 * @throws Error if `id` or `name` is missing or not a non-empty string.
 *
 * @example
 *   createChecklist({ name: 'My Checklist', id: 'chk-123', reviewerName: 'Alice' });
 */
export function createAMSTAR2Checklist({
  name,
  id,
  createdAt = Date.now(),
  reviewerName = '',
}: CreateChecklistOptions): AMSTAR2Checklist {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('AMSTAR2Checklist requires a non-empty string id.');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('AMSTAR2Checklist requires a non-empty string name.');
  }

  let d = new Date(createdAt);
  if (isNaN(d.getTime())) d = new Date();

  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const formattedDate = `${d.getFullYear()}-${mm}-${dd}`;

  return {
    name: name,
    reviewerName: reviewerName || '',
    createdAt: formattedDate,
    id: id,
    q1: { answers: [[false, false, false, false], [false], [false, false]], critical: false },
    q2: {
      answers: [
        [false, false, false, false],
        [false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q3: {
      answers: [
        [false, false, false],
        [false, false],
      ],
      critical: false,
    },
    q4: {
      answers: [
        [false, false, false],
        [false, false, false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q5: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
    q6: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
    q7: { answers: [[false], [false], [false, false, false]], critical: true },
    q8: {
      answers: [
        [false, false, false, false, false],
        [false, false, false, false, false],
        [false, false, false],
      ],
      critical: false,
    },
    q9a: {
      answers: [
        [false, false],
        [false, false],
        [false, false, false, false],
      ],
      critical: true,
    },
    q9b: {
      answers: [
        [false, false],
        [false, false],
        [false, false, false, false],
      ],
      critical: true,
    },
    q10: { answers: [[false], [false, false]], critical: false },
    q11a: {
      answers: [
        [false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q11b: {
      answers: [
        [false, false, false, false],
        [false, false, false],
      ],
      critical: true,
    },
    q12: {
      answers: [
        [false, false],
        [false, false, false],
      ],
      critical: false,
    },
    q13: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: true,
    },
    q14: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
    q15: { answers: [[false], [false, false, false]], critical: true },
    q16: {
      answers: [
        [false, false],
        [false, false],
      ],
      critical: false,
    },
  };
}

/**
 * Create an empty question object with the correct answer structure
 */
export function createEmptyQuestion(critical: boolean, answerStructure: number[]): AMSTAR2Question {
  return {
    answers: answerStructure.map(len => Array(len).fill(false)),
    critical,
  };
}
