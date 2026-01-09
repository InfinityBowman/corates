/**
 * Mock Data Templates for Yjs State Inspector
 *
 * Provides pre-built templates for testing different workflow states.
 * Used by dev API endpoints to quickly populate projects with test data.
 */

// AMSTAR2 question answer structure definitions (from schema)
const AMSTAR2_STRUCTURE = {
  q1: { parts: [[4], [1], [2]], critical: false },
  q2: { parts: [[4], [3], [3]], critical: true },
  q3: { parts: [[3], [1]], critical: false },
  q4: { parts: [[4], [2], [4], [3], [3], [3]], critical: true },
  q5: { parts: [[5], [5]], critical: false },
  q6: { parts: [[5], [5]], critical: false },
  q7: { parts: [[3], [3]], critical: true },
  q8: { parts: [[8], [3], [3], [3]], critical: false },
  q9a: { parts: [[2], [2], [4]], critical: true },
  q9b: { parts: [[2], [2], [4]], critical: true },
  q10: { parts: [[3], [2]], critical: false },
  q11a: { parts: [[3], [3]], critical: true },
  q11b: { parts: [[4], [3]], critical: true },
  q12: { parts: [[4], [2]], critical: false },
  q13: { parts: [[5]], critical: true },
  q14: { parts: [[5]], critical: false },
  q15: { parts: [[3]], critical: true },
  q16: { parts: [[2], [2]], critical: false },
};

// ROBINS-I domain question keys
const ROBINS_I_DOMAINS = {
  domain1a: ['d1a_1', 'd1a_2', 'd1a_3', 'd1a_4'],
  domain1b: ['d1b_1', 'd1b_2', 'd1b_3', 'd1b_4', 'd1b_5'],
  domain2: ['d2_1', 'd2_2', 'd2_3', 'd2_4', 'd2_5'],
  domain3: ['d3_1', 'd3_2', 'd3_3', 'd3_4', 'd3_5', 'd3_6', 'd3_7'],
  domain4: ['d4_1', 'd4_2'],
  domain5: ['d5_1', 'd5_2', 'd5_3'],
  domain6: ['d6_1', 'd6_2', 'd6_3'],
};

const ROBINS_I_RESPONSES = ['Y', 'PY', 'PN', 'N', 'NI', 'NA'];
const ROBINS_I_JUDGEMENTS = ['Low', 'Low except confounding', 'Moderate', 'Serious', 'Critical'];
const ROBINS_I_DIRECTIONS = [
  'Upward bias (overestimate the effect)',
  'Downward bias (underestimate the effect)',
  'Unpredictable',
];

/**
 * Generate AMSTAR2 question answers
 * @param {Object} options - Generation options
 * @param {string} options.fill - 'empty' | 'random' | 'all-yes' | 'all-no' | 'mixed'
 * @param {number} [options.seed] - Random seed for reproducible generation
 * @returns {Object} AMSTAR2 answers object
 */
export function generateAMSTAR2Answers(options = {}) {
  const { fill = 'empty', seed = Date.now() } = options;
  const rng = seededRandom(seed);
  const answers = {};

  for (const [questionKey, structure] of Object.entries(AMSTAR2_STRUCTURE)) {
    const questionAnswers = structure.parts.map(partSizes =>
      partSizes.map(size => {
        const row = new Array(size).fill(false);
        if (fill === 'random') {
          for (let i = 0; i < size; i++) {
            row[i] = rng() > 0.5;
          }
        } else if (fill === 'all-yes') {
          row[0] = true;
        } else if (fill === 'all-no') {
          row[row.length - 1] = true;
        } else if (fill === 'mixed') {
          const idx = Math.floor(rng() * size);
          row[idx] = true;
        }
        return row;
      }),
    );

    answers[questionKey] = {
      answers: questionAnswers,
      critical: structure.critical,
    };
  }

  return answers;
}

/**
 * Generate ROBINS-I checklist answers
 * @param {Object} options - Generation options
 * @param {string} options.fill - 'empty' | 'random' | 'complete' | 'partial'
 * @param {boolean} [options.isPerProtocol] - Whether this is a per-protocol analysis (uses domain1b)
 * @param {number} [options.seed] - Random seed for reproducible generation
 * @returns {Object} ROBINS-I answers object for import
 */
export function generateROBINSIAnswers(options = {}) {
  const { fill = 'empty', isPerProtocol = false, seed = Date.now() } = options;
  const rng = seededRandom(seed);

  const answers = {
    planning: {
      confoundingFactors: fill !== 'empty' ? 'Age, comorbidities, baseline severity' : '',
    },
    sectionA: {
      numericalResult: fill !== 'empty' ? 'OR = 1.5 (95% CI: 1.2-1.9)' : '',
      furtherDetails: fill !== 'empty' ? 'Table 3, primary outcome analysis' : '',
      outcome: fill !== 'empty' ? 'All-cause mortality at 12 months' : '',
    },
    sectionB: {
      b1: {
        answer: fill !== 'empty' ? pickRandom(rng, ['Y', 'PY', 'PN', 'N']) : null,
        comment: '',
      },
      b2: {
        answer: fill !== 'empty' ? pickRandom(rng, ['Y', 'PY', 'PN', 'N']) : null,
        comment: '',
      },
      b3: {
        answer: fill !== 'empty' ? pickRandom(rng, ['Y', 'PY', 'PN', 'N']) : null,
        comment: '',
      },
      stopAssessment: false,
    },
    sectionC: {
      participants: fill !== 'empty' ? 'Adults aged 18+ with type 2 diabetes' : '',
      interventionStrategy: fill !== 'empty' ? 'Metformin 500mg twice daily' : '',
      comparatorStrategy: fill !== 'empty' ? 'Sulfonylurea therapy' : '',
      isPerProtocol,
    },
    sectionD: {
      sources: {
        'Journal article(s)': fill !== 'empty',
        'Study protocol': fill === 'complete' || (fill === 'random' && rng() > 0.5),
        'Statistical analysis plan (SAP)': false,
        'Non-commercial registry record (e.g. ClinicalTrials.gov record)': false,
        'Company-owned registry record (e.g. GSK Clinical Study Register record)': false,
        'Grey literature (e.g. unpublished thesis)': false,
        'Conference abstract(s)': false,
        'Regulatory document (e.g. Clinical Study Report, Drug Approval Package)': false,
        'Individual participant data': false,
        'Research ethics application': false,
        'Grant database summary (e.g. NIH RePORTER, Research Councils UK Gateway to Research)': false,
        'Personal communication with investigator': false,
        'Personal communication with sponsor': false,
      },
      otherSpecify: '',
    },
    confoundingEvaluation: {
      predefined: fill !== 'empty' ? ['Age', 'Baseline severity'] : [],
      additional: [],
    },
  };

  // Generate domain answers
  const domainsToFill =
    isPerProtocol ?
      ['domain1b', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6']
    : ['domain1a', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6'];

  for (const domainKey of domainsToFill) {
    const questionKeys = ROBINS_I_DOMAINS[domainKey];
    if (!questionKeys) continue;

    const domainAnswers = {};
    for (const qKey of questionKeys) {
      domainAnswers[qKey] = {
        answer:
          fill === 'empty' || (fill === 'partial' && rng() > 0.7) ?
            null
          : pickRandom(rng, ROBINS_I_RESPONSES),
        comment: '',
      };
    }

    const hasDirection =
      domainKey === 'domain1a' || domainKey === 'domain1b' || domainKey === 'domain2';

    answers[domainKey] = {
      answers: domainAnswers,
      judgement: fill === 'complete' ? pickRandom(rng, ROBINS_I_JUDGEMENTS) : null,
      judgementSource: 'auto',
      ...(hasDirection ?
        { direction: fill === 'complete' ? pickRandom(rng, ROBINS_I_DIRECTIONS) : null }
      : {}),
    };
  }

  // Overall judgement
  answers.overall = {
    judgement: fill === 'complete' ? pickRandom(rng, ROBINS_I_JUDGEMENTS) : null,
    judgementSource: 'auto',
    direction: fill === 'complete' ? pickRandom(rng, ROBINS_I_DIRECTIONS) : null,
  };

  return answers;
}

/**
 * Simple seeded random number generator
 */
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Pick a random element from an array
 */
function pickRandom(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Generate a UUID-like string
 */
function generateId(prefix = '') {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Get current ISO date string
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Mock Data Templates
 *
 * Each template returns a function that generates fresh data (with new IDs/timestamps).
 */
export const MOCK_TEMPLATES = {
  /**
   * Empty project - just meta, no studies or members
   */
  empty: () => ({
    version: 1,
    meta: {
      name: 'Empty Test Project',
      description: 'A project with no studies or members',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    members: [],
    studies: [],
  }),

  /**
   * Studies only - has studies but no checklists
   */
  'studies-only': () => {
    const now = nowISO();
    return {
      version: 1,
      meta: {
        name: 'Studies Only Project',
        description: 'Project with studies but no checklists attached',
        createdAt: now,
        updatedAt: now,
      },
      members: [
        {
          userId: 'user_lead',
          role: 'lead',
          joinedAt: now,
          name: 'Project Lead',
          email: 'lead@example.com',
          displayName: 'Lead User',
          image: null,
        },
      ],
      studies: [
        {
          id: generateId('study'),
          name: 'Smith et al. 2023',
          description: 'Randomized controlled trial of intervention A',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'Effects of Intervention A on Patient Outcomes',
          firstAuthor: 'Smith',
          publicationYear: 2023,
          authors: 'Smith J, Johnson K, Williams L',
          journal: 'Journal of Medical Research',
          doi: '10.1234/jmr.2023.001',
          abstract:
            'Background: This study examines... Methods: We conducted... Results: We found...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: null,
          reviewer2: null,
          checklists: [],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Johnson et al. 2022',
          description: 'Cohort study of treatment outcomes',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'Long-term Outcomes of Treatment B',
          firstAuthor: 'Johnson',
          publicationYear: 2022,
          authors: 'Johnson K, Brown M',
          journal: 'Clinical Studies Quarterly',
          doi: '10.1234/csq.2022.045',
          abstract:
            'Objective: To evaluate... Design: Prospective cohort... Conclusions: Treatment B...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: null,
          reviewer2: null,
          checklists: [],
          pdfs: [],
          reconciliation: null,
        },
      ],
    };
  },

  /**
   * AMSTAR2 complete - single study with completed AMSTAR2 checklist
   */
  'amstar2-complete': () => {
    const now = nowISO();
    const studyId = generateId('study');
    const checklistId = generateId('checklist');

    return {
      version: 1,
      meta: {
        name: 'AMSTAR2 Complete Project',
        description: 'Project with a fully completed AMSTAR2 checklist',
        createdAt: now,
        updatedAt: now,
      },
      members: [
        {
          userId: 'user_reviewer1',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer One',
          email: 'reviewer1@example.com',
          displayName: 'Reviewer 1',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Meta-Analysis of Drug X',
          description: 'Systematic review requiring AMSTAR2 assessment',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'A Systematic Review and Meta-Analysis of Drug X Efficacy',
          firstAuthor: 'Garcia',
          publicationYear: 2024,
          authors: 'Garcia M, Chen L, Patel R',
          journal: 'Systematic Reviews',
          doi: '10.1234/sr.2024.100',
          abstract:
            'Background: Drug X has shown promise... Methods: We searched... Results: 15 studies...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: null,
          checklists: [
            {
              id: checklistId,
              type: 'AMSTAR2',
              title: 'AMSTAR2 Assessment',
              assignedTo: 'user_reviewer1',
              status: 'completed',
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 12345 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
      ],
    };
  },

  /**
   * ROBINS-I in progress - study with partially completed ROBINS-I checklist
   */
  'robins-i-progress': () => {
    const now = nowISO();
    const studyId = generateId('study');
    const checklistId = generateId('checklist');

    return {
      version: 1,
      meta: {
        name: 'ROBINS-I In Progress Project',
        description: 'Project with a partially completed ROBINS-I checklist',
        createdAt: now,
        updatedAt: now,
      },
      members: [
        {
          userId: 'user_reviewer1',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer One',
          email: 'reviewer1@example.com',
          displayName: 'Reviewer 1',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Observational Study of Intervention Y',
          description: 'Non-randomized study requiring ROBINS-I assessment',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'Real-World Evidence for Intervention Y',
          firstAuthor: 'Lee',
          publicationYear: 2023,
          authors: 'Lee S, Kumar A, Wilson D',
          journal: 'Observational Studies Journal',
          doi: '10.1234/osj.2023.050',
          abstract:
            'Objective: To assess real-world effectiveness... Methods: Retrospective cohort...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: null,
          checklists: [
            {
              id: checklistId,
              type: 'ROBINS_I',
              title: 'ROBINS-I Assessment',
              assignedTo: 'user_reviewer1',
              status: 'in_progress',
              createdAt: now,
              updatedAt: now,
              answers: generateROBINSIAnswers({ fill: 'partial', seed: 54321 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
      ],
    };
  },

  /**
   * Reconciliation ready - study with 2 completed checklists from different reviewers
   */
  'reconciliation-ready': () => {
    const now = nowISO();
    const studyId = generateId('study');
    const checklist1Id = generateId('checklist');
    const checklist2Id = generateId('checklist');

    return {
      version: 1,
      meta: {
        name: 'Reconciliation Ready Project',
        description: 'Project with two completed checklists ready for reconciliation',
        createdAt: now,
        updatedAt: now,
      },
      members: [
        {
          userId: 'user_reviewer1',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer One',
          email: 'reviewer1@example.com',
          displayName: 'Reviewer 1',
          image: null,
        },
        {
          userId: 'user_reviewer2',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer Two',
          email: 'reviewer2@example.com',
          displayName: 'Reviewer 2',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Dual Review Study',
          description: 'Study assessed by two independent reviewers',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'Comparative Effectiveness of Treatment Z',
          firstAuthor: 'Thompson',
          publicationYear: 2024,
          authors: 'Thompson E, Davis R, Miller T',
          journal: 'Evidence-Based Medicine',
          doi: '10.1234/ebm.2024.025',
          abstract: 'Background: Treatment Z is widely used... Objective: To compare...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: checklist1Id,
              type: 'AMSTAR2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: 'completed',
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 11111 }),
            },
            {
              id: checklist2Id,
              type: 'AMSTAR2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: 'completed',
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 22222 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
      ],
    };
  },

  /**
   * Full workflow - multiple studies in various states
   */
  'full-workflow': () => {
    const now = nowISO();
    const study1Id = generateId('study');
    const study2Id = generateId('study');
    const study3Id = generateId('study');

    return {
      version: 1,
      meta: {
        name: 'Full Workflow Project',
        description: 'Complex project with studies in various workflow states',
        createdAt: now,
        updatedAt: now,
      },
      members: [
        {
          userId: 'user_lead',
          role: 'lead',
          joinedAt: now,
          name: 'Project Lead',
          email: 'lead@example.com',
          displayName: 'Lead User',
          image: null,
        },
        {
          userId: 'user_reviewer1',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer One',
          email: 'reviewer1@example.com',
          displayName: 'Reviewer 1',
          image: null,
        },
        {
          userId: 'user_reviewer2',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer Two',
          email: 'reviewer2@example.com',
          displayName: 'Reviewer 2',
          image: null,
        },
      ],
      studies: [
        // Study 1: Not yet started
        {
          id: study1Id,
          name: 'Pending Review Study',
          description: 'Study awaiting reviewer assignment',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'New Study Awaiting Assessment',
          firstAuthor: 'Anderson',
          publicationYear: 2024,
          authors: 'Anderson P, White S',
          journal: 'New Research Journal',
          doi: '10.1234/nrj.2024.001',
          abstract: 'This newly published study examines...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: null,
          reviewer2: null,
          checklists: [],
          pdfs: [],
          reconciliation: null,
        },
        // Study 2: In progress with both AMSTAR2 and ROBINS-I
        {
          id: study2Id,
          name: 'Mixed Assessment Study',
          description: 'Study with both checklist types in progress',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'Hybrid Study Design Analysis',
          firstAuthor: 'Brown',
          publicationYear: 2023,
          authors: 'Brown C, Green D, Black E',
          journal: 'Comprehensive Reviews',
          doi: '10.1234/cr.2023.088',
          abstract: 'This study combines systematic review methodology with...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'AMSTAR2 - Reviewer 1',
              assignedTo: 'user_reviewer1',
              status: 'in_progress',
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'random', seed: 33333 }),
            },
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'ROBINS-I - Reviewer 2',
              assignedTo: 'user_reviewer2',
              status: 'in_progress',
              createdAt: now,
              updatedAt: now,
              answers: generateROBINSIAnswers({ fill: 'partial', seed: 44444 }),
            },
          ],
          pdfs: [
            {
              fileName: 'brown_2023_full.pdf',
              key: 'uploads/brown_2023_full.pdf',
              size: 1234567,
              uploadedBy: 'user_lead',
              uploadedAt: now,
            },
          ],
          reconciliation: null,
        },
        // Study 3: Completed with reconciliation
        {
          id: study3Id,
          name: 'Reconciled Study',
          description: 'Study with completed reconciliation',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'Fully Assessed and Reconciled Study',
          firstAuthor: 'Davis',
          publicationYear: 2022,
          authors: 'Davis M, Evans N, Foster O',
          journal: 'Quality Reviews',
          doi: '10.1234/qr.2022.200',
          abstract: 'Final reconciled assessment of this high-quality study...',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'AMSTAR2 - Reviewer 1 (Final)',
              assignedTo: 'user_reviewer1',
              status: 'completed',
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-yes', seed: 55555 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'AMSTAR2 - Reviewer 2 (Final)',
              assignedTo: 'user_reviewer2',
              status: 'completed',
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-yes', seed: 66666 }),
            },
          ],
          pdfs: [
            {
              fileName: 'davis_2022_manuscript.pdf',
              key: 'uploads/davis_2022_manuscript.pdf',
              size: 987654,
              uploadedBy: 'user_lead',
              uploadedAt: now,
            },
            {
              fileName: 'davis_2022_supplementary.pdf',
              key: 'uploads/davis_2022_supplementary.pdf',
              size: 456789,
              uploadedBy: 'user_reviewer1',
              uploadedAt: now,
            },
          ],
          reconciliation: {
            status: 'completed',
            completedAt: now,
            completedBy: 'user_lead',
            notes: 'Minor discrepancies resolved through discussion',
          },
        },
      ],
    };
  },
};

/**
 * Get available template names
 */
export function getTemplateNames() {
  return Object.keys(MOCK_TEMPLATES);
}

/**
 * Get a template by name
 * @param {string} name - Template name
 * @returns {Object|null} Generated template data or null if not found
 */
export function getTemplate(name) {
  const template = MOCK_TEMPLATES[name];
  if (!template) return null;
  return template();
}

/**
 * Get template descriptions for display
 */
export function getTemplateDescriptions() {
  return {
    empty: 'Empty project with no studies or members',
    'studies-only': 'Project with studies but no checklists attached',
    'amstar2-complete': 'Single study with completed AMSTAR2 checklist',
    'robins-i-progress': 'Study with partially completed ROBINS-I checklist',
    'reconciliation-ready': 'Two completed checklists ready for reconciliation',
    'full-workflow': 'Complex project with studies in various workflow states',
  };
}
