import { CHECKLIST_STATUS } from '@corates/shared';

interface QuestionStructure {
  parts: number[][];
  critical: boolean;
}

const AMSTAR2_STRUCTURE: Record<string, QuestionStructure> = {
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

const ROBINS_I_DOMAINS: Record<string, string[]> = {
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

type RngFunction = () => number;

interface AMSTAR2Options {
  fill?: 'empty' | 'random' | 'all-yes' | 'all-no' | 'mixed';
  seed?: number;
}

interface AMSTAR2Answers {
  [questionKey: string]: {
    answers: boolean[][];
    critical: boolean;
  };
}

export function generateAMSTAR2Answers(options: AMSTAR2Options = {}): AMSTAR2Answers {
  const { fill = 'empty', seed = Date.now() } = options;
  const rng = seededRandom(seed);
  const answers: AMSTAR2Answers = {};

  for (const [questionKey, structure] of Object.entries(AMSTAR2_STRUCTURE)) {
    const questionAnswers = structure.parts.map(partSizes => {
      const size = partSizes[0];
      const row = new Array<boolean>(size).fill(false);
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
    });

    answers[questionKey] = {
      answers: questionAnswers,
      critical: structure.critical,
    };
  }

  return answers;
}

interface ROBINSIOptions {
  fill?: 'empty' | 'random' | 'complete' | 'partial';
  isPerProtocol?: boolean;
  seed?: number;
}

interface ROBINSIAnswers {
  planning: {
    confoundingFactors: string;
  };
  sectionA: {
    numericalResult: string;
    furtherDetails: string;
    outcome: string;
  };
  sectionB: {
    b1: { answer: string | null; comment: string };
    b2: { answer: string | null; comment: string };
    b3: { answer: string | null; comment: string };
    stopAssessment: boolean;
  };
  sectionC: {
    participants: string;
    interventionStrategy: string;
    comparatorStrategy: string;
    isPerProtocol: boolean;
  };
  sectionD: {
    sources: Record<string, boolean>;
    otherSpecify: string;
  };
  confoundingEvaluation: {
    predefined: string[];
    additional: string[];
  };
  [domainKey: string]: unknown;
  overall: {
    judgement: string | null;
    judgementSource: string;
    direction: string | null;
  };
}

export function generateROBINSIAnswers(options: ROBINSIOptions = {}): ROBINSIAnswers {
  const { fill = 'empty', isPerProtocol = false, seed = Date.now() } = options;
  const rng = seededRandom(seed);

  const answers: ROBINSIAnswers = {
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
    overall: {
      judgement: fill === 'complete' ? pickRandom(rng, ROBINS_I_JUDGEMENTS) : null,
      judgementSource: 'auto',
      direction: fill === 'complete' ? pickRandom(rng, ROBINS_I_DIRECTIONS) : null,
    },
  };

  const domainsToFill =
    isPerProtocol ?
      ['domain1b', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6']
    : ['domain1a', 'domain2', 'domain3', 'domain4', 'domain5', 'domain6'];

  for (const domainKey of domainsToFill) {
    const questionKeys = ROBINS_I_DOMAINS[domainKey];
    if (!questionKeys) continue;

    const domainAnswers: Record<string, { answer: string | null; comment: string }> = {};
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

  return answers;
}

// ROB2 domain structure: questions per domain and their response types
const ROB2_DOMAINS: Record<string, Array<{ id: string; responseType: 'STANDARD' | 'WITH_NA' }>> = {
  domain1: [
    { id: 'd1_1', responseType: 'STANDARD' },
    { id: 'd1_2', responseType: 'STANDARD' },
    { id: 'd1_3', responseType: 'STANDARD' },
  ],
  domain2a: [
    { id: 'd2a_1', responseType: 'STANDARD' },
    { id: 'd2a_2', responseType: 'STANDARD' },
    { id: 'd2a_3', responseType: 'WITH_NA' },
    { id: 'd2a_4', responseType: 'WITH_NA' },
    { id: 'd2a_5', responseType: 'WITH_NA' },
    { id: 'd2a_6', responseType: 'STANDARD' },
    { id: 'd2a_7', responseType: 'WITH_NA' },
  ],
  domain2b: [
    { id: 'd2b_1', responseType: 'STANDARD' },
    { id: 'd2b_2', responseType: 'STANDARD' },
    { id: 'd2b_3', responseType: 'WITH_NA' },
    { id: 'd2b_4', responseType: 'WITH_NA' },
    { id: 'd2b_5', responseType: 'WITH_NA' },
    { id: 'd2b_6', responseType: 'WITH_NA' },
  ],
  domain3: [
    { id: 'd3_1', responseType: 'STANDARD' },
    { id: 'd3_2', responseType: 'WITH_NA' },
    { id: 'd3_3', responseType: 'WITH_NA' },
    { id: 'd3_4', responseType: 'WITH_NA' },
  ],
  domain4: [
    { id: 'd4_1', responseType: 'STANDARD' },
    { id: 'd4_2', responseType: 'STANDARD' },
    { id: 'd4_3', responseType: 'WITH_NA' },
    { id: 'd4_4', responseType: 'WITH_NA' },
    { id: 'd4_5', responseType: 'WITH_NA' },
  ],
  domain5: [
    { id: 'd5_1', responseType: 'STANDARD' },
    { id: 'd5_2', responseType: 'STANDARD' },
    { id: 'd5_3', responseType: 'STANDARD' },
  ],
};

const ROB2_STANDARD_RESPONSES = ['Y', 'PY', 'PN', 'N', 'NI'] as const;
const ROB2_WITH_NA_RESPONSES = ['NA', 'Y', 'PY', 'PN', 'N', 'NI'] as const;
const ROB2_JUDGEMENTS = ['Low', 'Some concerns', 'High'] as const;
const ROB2_DIRECTIONS = [
  'NA',
  'Favours experimental',
  'Favours comparator',
  'Towards null',
  'Away from null',
  'Unpredictable',
] as const;

const ROB2_STUDY_DESIGNS = [
  'Individually-randomized parallel-group trial',
  'Cluster-randomized parallel-group trial',
  'Individually randomized cross-over (or other matched) trial',
] as const;

const ROB2_INFORMATION_SOURCES = [
  'Journal article(s)',
  'Trial protocol',
  'Statistical analysis plan (SAP)',
  'Non-commercial trial registry record (e.g. ClinicalTrials.gov record)',
  'Company-owned trial registry record (e.g. GSK Clinical Study Register record)',
  'Grey literature (e.g. unpublished thesis)',
  'Conference abstract(s) about the trial',
  'Regulatory document (e.g. Clinical Study Report, Drug Approval Package)',
  'Research ethics application',
  'Grant database summary (e.g. NIH RePORTER or Research Councils UK Gateway to Research)',
  'Personal communication with trialist',
  'Personal communication with the sponsor',
] as const;

interface ROB2Options {
  fill?: 'empty' | 'random' | 'all-yes' | 'mixed';
  isAdhering?: boolean;
  seed?: number;
}

interface ROB2DomainAnswers {
  answers: Record<string, { answer: string | null; comment: string }>;
  judgement: string | null;
  direction: string | null;
}

interface ROB2Answers {
  preliminary: {
    studyDesign: string | null;
    experimental: string;
    comparator: string;
    numericalResult: string;
    aim: 'ASSIGNMENT' | 'ADHERING';
    deviationsToAddress: string[];
    sources: Record<string, boolean>;
  };
  domain1: ROB2DomainAnswers;
  domain2a: ROB2DomainAnswers;
  domain2b: ROB2DomainAnswers;
  domain3: ROB2DomainAnswers;
  domain4: ROB2DomainAnswers;
  domain5: ROB2DomainAnswers;
  overall: {
    judgement: string | null;
    direction: string | null;
  };
}

export function generateROB2Answers(options: ROB2Options = {}): ROB2Answers {
  const { fill = 'empty', isAdhering = false, seed = Date.now() } = options;
  const rng = seededRandom(seed);

  const aim: 'ASSIGNMENT' | 'ADHERING' = isAdhering ? 'ADHERING' : 'ASSIGNMENT';

  const sources: Record<string, boolean> = {};
  for (const src of ROB2_INFORMATION_SOURCES) {
    sources[src] = src === 'Journal article(s)' && fill !== 'empty';
  }

  const emptyDomain: ROB2DomainAnswers = { answers: {}, judgement: null, direction: null };

  const answers: ROB2Answers = {
    preliminary: {
      studyDesign: fill !== 'empty' ? pickRandom(rng, [...ROB2_STUDY_DESIGNS]) : null,
      experimental: fill !== 'empty' ? 'Experimental intervention A' : '',
      comparator: fill !== 'empty' ? 'Standard care B' : '',
      numericalResult: fill !== 'empty' ? 'RR = 1.52 (95% CI 0.83 to 2.77)' : '',
      aim,
      deviationsToAddress:
        isAdhering && fill !== 'empty' ?
          [
            "non-adherence to their assigned intervention regimen that could have affected participants' outcomes",
          ]
        : [],
      sources,
    },
    domain1: generateROB2Domain('domain1', fill, rng),
    domain2a: isAdhering ? emptyDomain : generateROB2Domain('domain2a', fill, rng),
    domain2b: isAdhering ? generateROB2Domain('domain2b', fill, rng) : emptyDomain,
    domain3: generateROB2Domain('domain3', fill, rng),
    domain4: generateROB2Domain('domain4', fill, rng),
    domain5: generateROB2Domain('domain5', fill, rng),
    overall: {
      judgement: fill !== 'empty' ? pickRandom(rng, [...ROB2_JUDGEMENTS]) : null,
      direction: fill !== 'empty' ? pickRandom(rng, [...ROB2_DIRECTIONS]) : null,
    },
  };

  return answers;
}

function generateROB2Domain(domainKey: string, fill: string, rng: RngFunction): ROB2DomainAnswers {
  const questions = ROB2_DOMAINS[domainKey] || [];
  const domainAnswers: Record<string, { answer: string | null; comment: string }> = {};

  for (const q of questions) {
    const pool =
      q.responseType === 'WITH_NA' ? [...ROB2_WITH_NA_RESPONSES] : [...ROB2_STANDARD_RESPONSES];

    let answer: string | null = null;
    if (fill === 'random') {
      answer = pickRandom(rng, pool);
    } else if (fill === 'all-yes') {
      answer = 'Y';
    } else if (fill === 'mixed') {
      answer = pickRandom(rng, pool);
    }

    domainAnswers[q.id] = { answer, comment: '' };
  }

  return {
    answers: domainAnswers,
    judgement: fill !== 'empty' ? pickRandom(rng, [...ROB2_JUDGEMENTS]) : null,
    direction: fill !== 'empty' ? pickRandom(rng, [...ROB2_DIRECTIONS]) : null,
  };
}

function seededRandom(seed: number): RngFunction {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pickRandom<T>(rng: RngFunction, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function generateId(prefix: string = ''): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix ? `${prefix}_${id}` : id;
}

function timestamp(): number {
  return Date.now();
}

interface MockMember {
  userId: string;
  role: string;
  joinedAt: number;
  name: string;
  email: string;
  givenName: string;
  image: string | null;
}

interface MockChecklist {
  id: string;
  type: string;
  title: string;
  // null marks a reconciled (consensus) checklist; reviewer checklists carry a userId.
  assignedTo: string | null;
  status: string;
  createdAt: number;
  updatedAt: number;
  outcomeId?: string;
  answers: AMSTAR2Answers | ROBINSIAnswers | ROB2Answers;
}

interface MockPdf {
  fileName: string;
  key: string;
  size: number;
  uploadedBy: string;
  uploadedAt: number;
}

interface MockReconciliation {
  status: string;
  completedAt: number;
  completedBy: string;
  notes: string;
}

interface MockStudy {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  originalTitle: string;
  firstAuthor: string;
  publicationYear: number;
  authors: string;
  journal: string;
  doi: string;
  abstract: string;
  pdfUrl: string | null;
  pdfSource: string | null;
  pdfAccessible: boolean;
  reviewer1: string | null;
  reviewer2: string | null;
  checklists: MockChecklist[];
  pdfs: MockPdf[];
  reconciliation: MockReconciliation | null;
}

interface MockProjectData {
  version: number;
  meta: {
    name: string;
    description: string;
    createdAt: number;
    updatedAt: number;
    outcomes?: Record<string, { name: string; createdAt: number }>;
  };
  members: MockMember[];
  studies: MockStudy[];
}

type TemplateFunction = () => MockProjectData;

const MOCK_TEMPLATES: Record<string, TemplateFunction> = {
  empty: () => ({
    version: 1,
    meta: {
      name: 'Empty Test Project',
      description: 'A project with no studies or members',
      createdAt: timestamp(),
      updatedAt: timestamp(),
    },
    members: [],
    studies: [],
  }),

  'studies-only': () => {
    const now = timestamp();
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
          givenName: 'Lead',
          image: null,
        },
      ],
      studies: [
        {
          id: generateId('study'),
          name: 'Page et al. 2021',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'The PRISMA 2020 statement: an updated guideline for reporting systematic reviews',
          firstAuthor: 'Page',
          publicationYear: 2021,
          authors: 'Page MJ, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, Mulrow CD, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.n71',
          abstract: '',
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
          name: 'Sterne et al. 2019',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'RoB 2: a revised tool for assessing risk of bias in randomised trials',
          firstAuthor: 'Sterne',
          publicationYear: 2019,
          authors: 'Sterne JAC, Savovic J, Page MJ, Elbers RG, Blencowe NS, Boutron I, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.l4898',
          abstract: '',
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

  'amstar2-complete': () => {
    const now = timestamp();
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
          givenName: 'Reviewer',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Page et al. 2021',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'The PRISMA 2020 statement: an updated guideline for reporting systematic reviews',
          firstAuthor: 'Page',
          publicationYear: 2021,
          authors: 'Page MJ, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, Mulrow CD, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.n71',
          abstract: '',
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
              status: CHECKLIST_STATUS.FINALIZED,
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

  'robins-i-progress': () => {
    const now = timestamp();
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
          givenName: 'Reviewer',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Sterne et al. 2019',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'RoB 2: a revised tool for assessing risk of bias in randomised trials',
          firstAuthor: 'Sterne',
          publicationYear: 2019,
          authors: 'Sterne JAC, Savovic J, Page MJ, Elbers RG, Blencowe NS, Boutron I, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.l4898',
          abstract: '',
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
              status: CHECKLIST_STATUS.IN_PROGRESS,
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

  'reconciliation-ready': () => {
    const now = timestamp();
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
          givenName: 'Reviewer',
          image: null,
        },
        {
          userId: 'user_reviewer2',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer Two',
          email: 'reviewer2@example.com',
          givenName: 'Reviewer',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Page et al. 2021',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'The PRISMA 2020 statement: an updated guideline for reporting systematic reviews',
          firstAuthor: 'Page',
          publicationYear: 2021,
          authors: 'Page MJ, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, Mulrow CD, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.n71',
          abstract: '',
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
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 11111 }),
            },
            {
              id: checklist2Id,
              type: 'AMSTAR2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
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

  'reconciliation-ready-rob2': () => {
    const now = timestamp();
    const studyId = generateId('study');
    const checklist1Id = generateId('checklist');
    const checklist2Id = generateId('checklist');
    const outcomeId = generateId('outcome');

    return {
      version: 1,
      meta: {
        name: 'Reconciliation Ready Project (ROB2)',
        description: 'Project with two completed ROB2 checklists ready for reconciliation',
        createdAt: now,
        updatedAt: now,
        outcomes: {
          [outcomeId]: { name: 'All-cause mortality', createdAt: now },
        },
      },
      members: [
        {
          userId: 'user_reviewer1',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer One',
          email: 'reviewer1@example.com',
          givenName: 'Reviewer',
          image: null,
        },
        {
          userId: 'user_reviewer2',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer Two',
          email: 'reviewer2@example.com',
          givenName: 'Reviewer',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Sterne et al. 2019',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'RoB 2: a revised tool for assessing risk of bias in randomised trials',
          firstAuthor: 'Sterne',
          publicationYear: 2019,
          authors: 'Sterne JAC, Savovic J, Page MJ, Elbers RG, Blencowe NS, Boutron I, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.l4898',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: checklist1Id,
              type: 'ROB2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              // Both reviewers must share the same aim, else reconciliation is
              // gated on resolving the aim mismatch before domain assessment.
              answers: generateROB2Answers({ fill: 'mixed', seed: 11111, isAdhering: false }),
            },
            {
              id: checklist2Id,
              type: 'ROB2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'mixed', seed: 22222, isAdhering: false }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
      ],
    };
  },

  'reconciliation-ready-robins-i': () => {
    const now = timestamp();
    const studyId = generateId('study');
    const checklist1Id = generateId('checklist');
    const checklist2Id = generateId('checklist');
    const outcomeId = generateId('outcome');

    return {
      version: 1,
      meta: {
        name: 'Reconciliation Ready Project (ROBINS-I)',
        description: 'Project with two completed ROBINS-I checklists ready for reconciliation',
        createdAt: now,
        updatedAt: now,
        outcomes: {
          [outcomeId]: { name: 'All-cause mortality', createdAt: now },
        },
      },
      members: [
        {
          userId: 'user_reviewer1',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer One',
          email: 'reviewer1@example.com',
          givenName: 'Reviewer',
          image: null,
        },
        {
          userId: 'user_reviewer2',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer Two',
          email: 'reviewer2@example.com',
          givenName: 'Reviewer',
          image: null,
        },
      ],
      studies: [
        {
          id: studyId,
          name: 'Sterne et al. 2016',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions',
          firstAuthor: 'Sterne',
          publicationYear: 2016,
          authors: 'Sterne JAC, Hernan MA, Reeves BC, Savovic J, Berkman ND, Viswanathan M, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.i4919',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: checklist1Id,
              type: 'ROBINS_I',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              // Both reviewers must share the same analysis (intention-to-treat vs
              // per-protocol), else they fill different domains (1a vs 1b) and the
              // comparison misaligns.
              answers: generateROBINSIAnswers({
                fill: 'complete',
                seed: 11111,
                isPerProtocol: false,
              }),
            },
            {
              id: checklist2Id,
              type: 'ROBINS_I',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'complete',
                seed: 22222,
                isPerProtocol: false,
              }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
      ],
    };
  },

  'full-workflow': () => {
    const now = timestamp();
    const outcomeId = generateId('outcome');

    return {
      version: 1,
      meta: {
        name: 'Full Workflow Project',
        description: 'Complex project with studies in various workflow states',
        createdAt: now,
        updatedAt: now,
        outcomes: {
          [outcomeId]: { name: 'All-cause mortality', createdAt: now },
        },
      },
      members: [
        {
          userId: 'user_lead',
          role: 'lead',
          joinedAt: now,
          name: 'Project Lead',
          email: 'lead@example.com',
          givenName: 'Lead',
          image: null,
        },
        {
          userId: 'user_reviewer1',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer One',
          email: 'reviewer1@example.com',
          givenName: 'Reviewer',
          image: null,
        },
        {
          userId: 'user_reviewer2',
          role: 'reviewer',
          joinedAt: now,
          name: 'Reviewer Two',
          email: 'reviewer2@example.com',
          givenName: 'Reviewer',
          image: null,
        },
      ],
      studies: [
        // --- Not started (no reviewers assigned, no checklists) ---
        {
          id: generateId('study'),
          name: 'Schulz et al. 2010',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'CONSORT 2010 Statement: updated guidelines for reporting parallel group randomised trials',
          firstAuthor: 'Schulz',
          publicationYear: 2010,
          authors: 'Schulz KF, Altman DG, Moher D, CONSORT Group',
          journal: 'BMJ',
          doi: '10.1136/bmj.c332',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: null,
          reviewer2: null,
          checklists: [],
          pdfs: [],
          reconciliation: null,
        },
        // --- Completed (finalized + reconciled) ---
        // A real reconciliation produces a third "Reconciled Checklist" that is
        // finalized and has no assignee (null = consensus); the two reviewer
        // checklists stay locked at reviewer-completed. The visualizations read
        // the reconciled checklist, so its answers carry the deliberately varied
        // profiles (all-yes / all-no / mixed) for completed-state rendering.
        {
          id: generateId('study'),
          name: 'Shea et al. 2017',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'AMSTAR 2: a critical appraisal tool for systematic reviews that include randomised or non-randomised studies of healthcare interventions, or both',
          firstAuthor: 'Shea',
          publicationYear: 2017,
          authors: 'Shea BJ, Reeves BC, Wells G, Thuku M, Hamel C, Moran J, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.j4008',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-yes', seed: 1001 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-yes', seed: 1011 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reconciled Checklist',
              assignedTo: null,
              status: CHECKLIST_STATUS.FINALIZED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-yes', seed: 1001 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Whiting et al. 2016',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'ROBIS: A new tool to assess risk of bias in systematic reviews was developed',
          firstAuthor: 'Whiting',
          publicationYear: 2016,
          authors: 'Whiting P, Savovic J, Higgins JPT, Caldwell DM, Reeves BC, Shea B, et al.',
          journal: 'Journal of Clinical Epidemiology',
          doi: '10.1016/j.jclinepi.2015.06.005',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-no', seed: 1002 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-no', seed: 1012 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reconciled Checklist',
              assignedTo: null,
              status: CHECKLIST_STATUS.FINALIZED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'all-no', seed: 1002 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Moher et al. 2009',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'Preferred reporting items for systematic reviews and meta-analyses: the PRISMA statement',
          firstAuthor: 'Moher',
          publicationYear: 2009,
          authors: 'Moher D, Liberati A, Tetzlaff J, Altman DG, PRISMA Group',
          journal: 'PLoS Medicine',
          doi: '10.1371/journal.pmed.1000097',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 1003 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 1013 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reconciled Checklist',
              assignedTo: null,
              status: CHECKLIST_STATUS.FINALIZED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 1003 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Sterne et al. 2016',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions',
          firstAuthor: 'Sterne',
          publicationYear: 2016,
          authors: 'Sterne JAC, Hernan MA, Reeves BC, Savovic J, Berkman ND, Viswanathan M, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.i4919',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'complete',
                seed: 1004,
                isPerProtocol: false,
              }),
            },
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'complete',
                seed: 1014,
                isPerProtocol: false,
              }),
            },
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'Reconciled Checklist',
              assignedTo: null,
              status: CHECKLIST_STATUS.FINALIZED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'complete',
                seed: 1004,
                isPerProtocol: false,
              }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Sterne et al. 2019',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'RoB 2: a revised tool for assessing risk of bias in randomised trials',
          firstAuthor: 'Sterne',
          publicationYear: 2019,
          authors: 'Sterne JAC, Savovic J, Page MJ, Elbers RG, Blencowe NS, Boutron I, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.l4898',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'ROB2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'mixed', seed: 1005, isAdhering: false }),
            },
            {
              id: generateId('checklist'),
              type: 'ROB2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'mixed', seed: 1015, isAdhering: false }),
            },
            {
              id: generateId('checklist'),
              type: 'ROB2',
              title: 'Reconciled Checklist',
              assignedTo: null,
              status: CHECKLIST_STATUS.FINALIZED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'mixed', seed: 1005, isAdhering: false }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        // --- In-progress reconcile (two reviewer-completed checklists) ---
        // Both reviewers use different seeds so there are genuine discrepancies
        // to reconcile. ROB2/ROBINS-I share an outcome and analysis so the
        // reconciler aligns them by domain rather than gating on a mismatch.
        {
          id: generateId('study'),
          name: 'Page et al. 2021',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'The PRISMA 2020 statement: an updated guideline for reporting systematic reviews',
          firstAuthor: 'Page',
          publicationYear: 2021,
          authors: 'Page MJ, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, Mulrow CD, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.n71',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 2001 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'mixed', seed: 2002 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Higgins et al. 2011',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            "The Cochrane Collaboration's tool for assessing risk of bias in randomised trials",
          firstAuthor: 'Higgins',
          publicationYear: 2011,
          authors: 'Higgins JPT, Altman DG, Gotzsche PC, Juni P, Moher D, Oxman AD, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.d5928',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'complete',
                seed: 3001,
                isPerProtocol: false,
              }),
            },
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'complete',
                seed: 3002,
                isPerProtocol: false,
              }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Guyatt et al. 2008',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'GRADE: an emerging consensus on rating quality of evidence and strength of recommendations',
          firstAuthor: 'Guyatt',
          publicationYear: 2008,
          authors: 'Guyatt GH, Oxman AD, Vist GE, Kunz R, Falck-Ytter Y, Alonso-Coello P, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.39489.470347.AD',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'ROB2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'mixed', seed: 4001, isAdhering: false }),
            },
            {
              id: generateId('checklist'),
              type: 'ROB2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'mixed', seed: 4002, isAdhering: false }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        // --- To-do / in-progress (active reviewer checklists) ---
        // Each reviewer has an in-progress checklist, so the study stays in the
        // To Do tab and never reaches the reconcile state.
        {
          id: generateId('study'),
          name: 'Liberati et al. 2009',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'The PRISMA statement for reporting systematic reviews and meta-analyses of studies that evaluate healthcare interventions: explanation and elaboration',
          firstAuthor: 'Liberati',
          publicationYear: 2009,
          authors:
            'Liberati A, Altman DG, Tetzlaff J, Mulrow C, Gotzsche PC, Ioannidis JPA, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.b2700',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.IN_PROGRESS,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'random', seed: 5001 }),
            },
            {
              id: generateId('checklist'),
              type: 'AMSTAR2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.IN_PROGRESS,
              createdAt: now,
              updatedAt: now,
              answers: generateAMSTAR2Answers({ fill: 'random', seed: 5002 }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Egger et al. 1997',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle: 'Bias in meta-analysis detected by a simple, graphical test',
          firstAuthor: 'Egger',
          publicationYear: 1997,
          authors: 'Egger M, Davey Smith G, Schneider M, Minder C',
          journal: 'BMJ',
          doi: '10.1136/bmj.315.7109.629',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.IN_PROGRESS,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'partial',
                seed: 6001,
                isPerProtocol: false,
              }),
            },
            {
              id: generateId('checklist'),
              type: 'ROBINS_I',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.IN_PROGRESS,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROBINSIAnswers({
                fill: 'partial',
                seed: 6002,
                isPerProtocol: false,
              }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
        {
          id: generateId('study'),
          name: 'Sterne et al. 2011',
          description: '',
          createdAt: now,
          updatedAt: now,
          originalTitle:
            'Multiple imputation for missing data in epidemiological and clinical research: potential and pitfalls',
          firstAuthor: 'Sterne',
          publicationYear: 2011,
          authors: 'Sterne JAC, White IR, Carlin JB, Spratt M, Royston P, Carpenter JR, et al.',
          journal: 'BMJ',
          doi: '10.1136/bmj.d4002',
          abstract: '',
          pdfUrl: null,
          pdfSource: null,
          pdfAccessible: false,
          reviewer1: 'user_reviewer1',
          reviewer2: 'user_reviewer2',
          checklists: [
            {
              id: generateId('checklist'),
              type: 'ROB2',
              title: 'Reviewer 1 Assessment',
              assignedTo: 'user_reviewer1',
              status: CHECKLIST_STATUS.IN_PROGRESS,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'random', seed: 7001, isAdhering: false }),
            },
            {
              id: generateId('checklist'),
              type: 'ROB2',
              title: 'Reviewer 2 Assessment',
              assignedTo: 'user_reviewer2',
              status: CHECKLIST_STATUS.IN_PROGRESS,
              createdAt: now,
              updatedAt: now,
              outcomeId,
              answers: generateROB2Answers({ fill: 'random', seed: 7002, isAdhering: false }),
            },
          ],
          pdfs: [],
          reconciliation: null,
        },
      ],
    };
  },
};

export function getTemplateNames(): string[] {
  return Object.keys(MOCK_TEMPLATES);
}

export function getTemplate(name: string): MockProjectData | null {
  const template = MOCK_TEMPLATES[name];
  if (!template) return null;
  return template();
}

export function getTemplateDescriptions(): Record<string, string> {
  return {
    empty: 'Empty project with no studies or members',
    'studies-only': 'Project with studies but no checklists attached',
    'amstar2-complete': 'Single study with completed AMSTAR2 checklist',
    'robins-i-progress': 'Study with partially completed ROBINS-I checklist',
    'reconciliation-ready': 'Two completed AMSTAR2 checklists ready for reconciliation',
    'reconciliation-ready-rob2': 'Two completed ROB2 checklists ready for reconciliation',
    'reconciliation-ready-robins-i': 'Two completed ROBINS-I checklists ready for reconciliation',
    'full-workflow': 'Complex project with studies in various workflow states',
  };
}
