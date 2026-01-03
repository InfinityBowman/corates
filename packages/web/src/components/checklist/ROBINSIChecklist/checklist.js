import {
  ROBINS_I_CHECKLIST,
  INFORMATION_SOURCES,
  getActiveDomainKeys,
  getDomainQuestions,
} from './checklist-map.js';
import {
  scoreRobinsDomain,
  getEffectiveDomainJudgement,
  scoreAllDomains,
  mapOverallJudgementToDisplay,
  JUDGEMENTS,
} from './scoring/robins-scoring.js';

/**
 * Creates a new ROBINS-I V2 checklist object with default empty answers.
 *
 * @param {Object} options - Checklist properties.
 * @param {string} options.name - The checklist name (required).
 * @param {string} options.id - Unique checklist ID (required).
 * @param {number} [options.createdAt=Date.now()] - Timestamp of checklist creation.
 * @param {string} [options.reviewerName=''] - Name of the reviewer.
 *
 * @returns {Object} A checklist object with all ROBINS-I questions initialized to default answers.
 *
 * @throws {Error} If `id` or `name` is missing or not a non-empty string.
 */
export function createChecklist({
  name = null,
  id = null,
  createdAt = Date.now(),
  reviewerName = '',
}) {
  if (!id || typeof id !== 'string' || !id.trim()) {
    throw new Error('ROBINS-I Checklist requires a non-empty string id.');
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('ROBINS-I Checklist requires a non-empty string name.');
  }

  let d = new Date(createdAt);
  if (isNaN(d)) d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const formattedDate = `${d.getFullYear()}-${mm}-${dd}`;

  return {
    // Metadata
    name: name,
    reviewerName: reviewerName || '',
    createdAt: formattedDate,
    id: id,
    checklistType: 'ROBINS_I',

    // Planning stage: confounding factors (free text)
    planning: {
      confoundingFactors: '',
    },

    // Section A: Result being assessed (metadata)
    sectionA: {
      numericalResult: '',
      furtherDetails: '',
      outcome: '',
    },

    // Section B: Proceed with assessment
    sectionB: {
      b1: { answer: null, comment: '' },
      b2: { answer: null, comment: '' },
      b3: { answer: null, comment: '' },
      stopAssessment: false,
    },

    // Section C: Target randomized trial
    sectionC: {
      participants: '',
      interventionStrategy: '',
      comparatorStrategy: '',
      isPerProtocol: false, // false = ITT, true = Per-Protocol
    },

    // Section D: Information sources
    sectionD: {
      sources: INFORMATION_SOURCES.reduce((acc, source) => {
        acc[source] = false;
        return acc;
      }, {}),
      otherSpecify: '',
    },

    // Confounding factors evaluation
    confoundingEvaluation: {
      predefined: [], // Array of { factor, variables, controlled, validReliable, unnecessary, direction, comment }
      additional: [], // Same structure
    },

    // Domain 1A: Confounding (ITT)
    domain1a: createDomainState('domain1a'),

    // Domain 1B: Confounding (Per-Protocol)
    domain1b: createDomainState('domain1b'),

    // Domain 2: Classification of interventions
    domain2: createDomainState('domain2'),

    // Domain 3: Selection of participants
    domain3: createDomainState('domain3'),

    // Domain 4: Missing data
    domain4: createDomainState('domain4'),

    // Domain 5: Measurement of outcome
    domain5: createDomainState('domain5'),

    // Domain 6: Selection of reported result
    domain6: createDomainState('domain6'),

    // Overall risk of bias
    overall: {
      judgement: null, // 'Low (except confounding)', 'Moderate', 'Serious', 'Critical'
      judgementSource: 'auto', // 'auto' | 'manual' - tracks whether judgement is auto-calculated or manually set
      direction: null,
    },
  };
}

/**
 * Creates the initial state for a domain
 * @param {string} domainKey - The domain key (e.g., 'domain1a')
 * @returns {Object} Domain state object
 */
function createDomainState(domainKey) {
  const questions = getDomainQuestions(domainKey);
  const answers = {};

  Object.keys(questions).forEach(qKey => {
    answers[qKey] = { answer: null, comment: '' };
  });

  const domain = ROBINS_I_CHECKLIST[domainKey];

  return {
    answers,
    judgement: null, // 'Low', 'Moderate', 'Serious', 'Critical'
    judgementSource: 'auto', // 'auto' | 'manual' - tracks whether judgement is auto-calculated or manually set
    direction: domain?.hasDirection ? null : undefined,
  };
}

/**
 * Determines if assessment should stop based on Section B answers
 * @param {Object} sectionB - Section B state
 * @returns {boolean} True if assessment should stop
 */
export function shouldStopAssessment(sectionB) {
  if (!sectionB) return false;

  const b2Answer = sectionB.b2?.answer;
  const b3Answer = sectionB.b3?.answer;

  // Stop if B2 or B3 is Yes or Probably Yes
  return b2Answer === 'Y' || b2Answer === 'PY' || b3Answer === 'Y' || b3Answer === 'PY';
}

/**
 * Score the overall checklist based on domain judgements (uses effective judgements from smart scoring)
 * @param {Object} state - The complete checklist state
 * @returns {string} Overall risk of bias: 'Low', 'Moderate', 'Serious', 'Critical', or 'Incomplete'
 */
export function scoreChecklist(state) {
  if (!state || typeof state !== 'object') return 'Error';

  // Check if assessment was stopped early
  if (shouldStopAssessment(state.sectionB)) {
    return 'Critical';
  }

  // Use the smart scoring engine to get all effective judgements
  const { overall, isComplete } = scoreAllDomains(state);

  if (!isComplete) {
    return 'Incomplete';
  }

  return overall || 'Incomplete';
}

/**
 * Get detailed scoring information for all domains using the smart scoring engine
 * @param {Object} state - The complete checklist state
 * @returns {Object} { domains, overall, isComplete } with auto/effective/source per domain
 */
export function getSmartScoring(state) {
  if (!state || typeof state !== 'object') {
    return { domains: {}, overall: null, isComplete: false };
  }

  // Check if assessment was stopped early
  if (shouldStopAssessment(state.sectionB)) {
    return {
      domains: {},
      overall: 'Critical',
      isComplete: true,
      stoppedEarly: true,
    };
  }

  return scoreAllDomains(state);
}

/**
 * Get the algorithmic suggestion for a domain's risk of bias based on signalling questions
 * Uses the table-driven smart scoring engine for accurate, deterministic results
 * @param {string} domainKey - The domain key
 * @param {Object} answers - The domain's answers object
 * @returns {string|null} Suggested judgement or null if incomplete
 */
export function suggestDomainJudgement(domainKey, answers) {
  const result = scoreRobinsDomain(domainKey, answers);
  return result.judgement;
}

// Re-export smart scoring functions for use in components
export { scoreRobinsDomain, getEffectiveDomainJudgement, mapOverallJudgementToDisplay, JUDGEMENTS };

/**
 * Get the selected answer for a specific question
 * @param {string} domainKey - The domain key
 * @param {string} questionKey - The question key
 * @param {Object} state - The checklist state
 * @returns {string|null} The selected answer or null
 */
export function getSelectedAnswer(domainKey, questionKey, state) {
  return state?.[domainKey]?.answers?.[questionKey]?.answer || null;
}

/**
 * Get all answers in a flat format for export/display
 * @param {Object} checklist - The complete checklist
 * @returns {Object} Flat object with all answers
 */
export function getAnswers(checklist) {
  if (!checklist || typeof checklist !== 'object') return null;

  const result = {
    metadata: {
      name: checklist.name,
      reviewerName: checklist.reviewerName,
      createdAt: checklist.createdAt,
      id: checklist.id,
    },
    sectionB: {},
    domains: {},
    overall: checklist.overall,
  };

  // Section B
  Object.keys(ROBINS_I_CHECKLIST.sectionB).forEach(key => {
    result.sectionB[key] = checklist.sectionB?.[key]?.answer || null;
  });

  // Domains
  const isPerProtocol = checklist.sectionC?.isPerProtocol || false;
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  activeDomains.forEach(domainKey => {
    const domain = checklist[domainKey];
    if (!domain) return;

    result.domains[domainKey] = {
      judgement: domain.judgement,
      direction: domain.direction,
      questions: {},
    };

    Object.keys(domain.answers || {}).forEach(qKey => {
      result.domains[domainKey].questions[qKey] = domain.answers[qKey]?.answer || null;
    });
  });

  return result;
}

/**
 * Get a summary of domain judgements
 * @param {Object} checklist - The complete checklist
 * @returns {Object} Summary of domain judgements
 */
export function getDomainSummary(checklist) {
  if (!checklist) return null;

  const isPerProtocol = checklist.sectionC?.isPerProtocol || false;
  const activeDomains = getActiveDomainKeys(isPerProtocol);

  const summary = {};

  activeDomains.forEach(domainKey => {
    const domain = checklist[domainKey];
    summary[domainKey] = {
      judgement: domain?.judgement || null,
      direction: domain?.direction || null,
      complete: isQuestionnaireComplete(domainKey, domain?.answers),
    };
  });

  return summary;
}

/**
 * Check if all questions in a domain are answered
 * @param {string} domainKey - The domain key
 * @param {Object} answers - The domain's answers
 * @returns {boolean} True if all questions have answers
 */
function isQuestionnaireComplete(domainKey, answers) {
  if (!answers) return false;

  const questions = getDomainQuestions(domainKey);
  const requiredKeys = Object.keys(questions);

  return requiredKeys.every(key => answers[key]?.answer !== null);
}

/**
 * Export checklist to CSV format
 * @param {Array|Object} checklists - One or more checklist objects
 * @returns {string} CSV string
 */
export function exportChecklistsToCSV(checklists) {
  const list = Array.isArray(checklists) ? checklists : [checklists];

  const headers = [
    'Checklist Name',
    'Reviewer',
    'Created At',
    'Domain',
    'Question',
    'Answer',
    'Comment',
    'Domain Judgement',
    'Domain Direction',
    'Overall Judgement',
    'Overall Direction',
  ];

  const rows = [];

  list.forEach(cl => {
    const isPerProtocol = cl.sectionC?.isPerProtocol || false;
    const activeDomains = getActiveDomainKeys(isPerProtocol);
    const overallScore = scoreChecklist(cl);

    // Section B
    Object.entries(ROBINS_I_CHECKLIST.sectionB).forEach(([key, def]) => {
      const ans = cl.sectionB?.[key];
      rows.push([
        cl.name || '',
        cl.reviewerName || '',
        cl.createdAt || '',
        'Section B',
        def.text,
        ans?.answer || '',
        ans?.comment || '',
        '',
        '',
        overallScore,
        cl.overall?.direction || '',
      ]);
    });

    // Domains
    activeDomains.forEach(domainKey => {
      const domainDef = ROBINS_I_CHECKLIST[domainKey];
      const domain = cl[domainKey];
      const questions = getDomainQuestions(domainKey);

      Object.entries(questions).forEach(([qKey, qDef]) => {
        const ans = domain?.answers?.[qKey];
        rows.push([
          cl.name || '',
          cl.reviewerName || '',
          cl.createdAt || '',
          domainDef?.name || domainKey,
          `${qDef.number}: ${qDef.text}`,
          ans?.answer || '',
          ans?.comment || '',
          domain?.judgement || '',
          domain?.direction || '',
          overallScore,
          cl.overall?.direction || '',
        ]);
      });
    });
  });

  // CSV encode
  const csvEscape = val => `"${String(val).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
  const csv =
    headers.map(csvEscape).join(',') +
    '\n' +
    rows.map(row => row.map(csvEscape).join(',')).join('\n');

  return csv;
}
