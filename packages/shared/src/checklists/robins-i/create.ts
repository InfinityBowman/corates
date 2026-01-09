/**
 * ROBINS-I Checklist Creation
 *
 * Creates new ROBINS-I V2 checklist objects with proper structure and defaults.
 */

import type { ROBINSIChecklist } from '../types.js';
import {
  INFORMATION_SOURCES,
  getDomainQuestions,
  ROBINS_I_CHECKLIST,
  type DomainKey,
} from './schema.js';

interface CreateChecklistOptions {
  name: string;
  id: string;
  createdAt?: number | Date;
  reviewerName?: string;
}

interface DomainState {
  answers: Record<string, { answer: null; comment: string }>;
  judgement: null;
  judgementSource: 'auto';
  direction?: null;
}

/**
 * Creates a new ROBINS-I V2 checklist object with default empty answers.
 *
 * @param options - Checklist properties.
 * @param options.name - The checklist name (required).
 * @param options.id - Unique checklist ID (required).
 * @param options.createdAt - Timestamp of checklist creation.
 * @param options.reviewerName - Name of the reviewer.
 *
 * @returns A checklist object with all ROBINS-I questions initialized to default answers.
 *
 * @throws Error if `id` or `name` is missing or not a non-empty string.
 */
export function createROBINSIChecklist({
  name,
  id,
  createdAt = Date.now(),
  reviewerName = '',
}: CreateChecklistOptions): ROBINSIChecklist {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('ROBINS-I Checklist requires a non-empty string id.');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('ROBINS-I Checklist requires a non-empty string name.');
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
    type: 'ROBINS_I',

    planning: {
      confoundingFactors: '',
    },

    sectionA: {
      numericalResult: '',
      furtherDetails: '',
      outcome: '',
    },

    sectionB: {
      b1: { answer: null, comment: '' },
      b2: { answer: null, comment: '' },
      b3: { answer: null, comment: '' },
      stopAssessment: false,
    },

    sectionC: {
      participants: '',
      interventionStrategy: '',
      comparatorStrategy: '',
      isPerProtocol: false,
    },

    sectionD: {
      sources: INFORMATION_SOURCES.reduce(
        (acc, source) => {
          acc[source] = false;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
      otherSpecify: '',
    },

    confoundingEvaluation: {
      predefined: [],
      additional: [],
    },

    domain1a: createDomainState('domain1a'),
    domain1b: createDomainState('domain1b'),
    domain2: createDomainState('domain2'),
    domain3: createDomainState('domain3'),
    domain4: createDomainState('domain4'),
    domain5: createDomainState('domain5'),
    domain6: createDomainState('domain6'),

    overall: {
      judgement: null,
      judgementSource: 'auto',
      direction: null,
    },
  };
}

/**
 * Creates the initial state for a domain
 */
function createDomainState(domainKey: DomainKey): DomainState {
  const questions = getDomainQuestions(domainKey);
  const answers: Record<string, { answer: null; comment: string }> = {};

  Object.keys(questions).forEach(qKey => {
    answers[qKey] = { answer: null, comment: '' };
  });

  const domain = ROBINS_I_CHECKLIST[domainKey];

  return {
    answers,
    judgement: null,
    judgementSource: 'auto',
    direction: domain?.hasDirection ? null : undefined,
  };
}
