/**
 * ROB-2 Checklist Creation
 *
 * Creates new ROB-2 checklist objects with proper structure and defaults.
 */

import {
  INFORMATION_SOURCES,
  getDomainQuestions,
  ROB2_CHECKLIST,
  type DomainKey,
} from './schema.js';

export interface ROB2Checklist {
  id: string;
  name: string;
  reviewerName: string;
  createdAt: string;
  type: 'ROB2';
  assignedTo?: string | null;
  status?: string;

  preliminary: {
    studyDesign: string | null;
    experimental: string;
    comparator: string;
    numericalResult: string;
    aim: 'ASSIGNMENT' | 'ADHERING' | null;
    deviationsToAddress: string[];
    sources: Record<string, boolean>;
  };

  domain1: DomainState;
  domain2a: DomainState;
  domain2b: DomainState;
  domain3: DomainState;
  domain4: DomainState;
  domain5: DomainState;

  overall: {
    judgement: string | null;
    direction: string | null;
  };
}

interface DomainState {
  answers: Record<string, { answer: string | null; comment: string }>;
  judgement: string | null;
  direction: string | null;
}

interface CreateChecklistOptions {
  name: string;
  id: string;
  createdAt?: number | Date;
  reviewerName?: string;
}

/**
 * Creates a new ROB-2 checklist object with default empty answers.
 *
 * @param options - Checklist properties.
 * @param options.name - The checklist name (required).
 * @param options.id - Unique checklist ID (required).
 * @param options.createdAt - Timestamp of checklist creation.
 * @param options.reviewerName - Name of the reviewer.
 *
 * @returns A checklist object with all ROB-2 questions initialized to default answers.
 *
 * @throws Error if `id` or `name` is missing or not a non-empty string.
 */
export function createROB2Checklist({
  name,
  id,
  createdAt = Date.now(),
  reviewerName = '',
}: CreateChecklistOptions): ROB2Checklist {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('ROB-2 Checklist requires a non-empty string id.');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('ROB-2 Checklist requires a non-empty string name.');
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
    type: 'ROB2',

    preliminary: {
      studyDesign: null,
      experimental: '',
      comparator: '',
      numericalResult: '',
      aim: null,
      deviationsToAddress: [],
      sources: INFORMATION_SOURCES.reduce(
        (acc, source) => {
          acc[source] = false;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    },

    domain1: createDomainState('domain1'),
    domain2a: createDomainState('domain2a'),
    domain2b: createDomainState('domain2b'),
    domain3: createDomainState('domain3'),
    domain4: createDomainState('domain4'),
    domain5: createDomainState('domain5'),

    overall: {
      judgement: null,
      direction: null,
    },
  };
}

/**
 * Creates the initial state for a domain
 */
function createDomainState(domainKey: DomainKey): DomainState {
  const questions = getDomainQuestions(domainKey);
  const answers: Record<string, { answer: string | null; comment: string }> = {};

  Object.keys(questions).forEach(qKey => {
    answers[qKey] = { answer: null, comment: '' };
  });

  const domain = ROB2_CHECKLIST[domainKey];

  return {
    answers,
    judgement: null,
    direction: domain?.hasDirection ? null : null,
  };
}
