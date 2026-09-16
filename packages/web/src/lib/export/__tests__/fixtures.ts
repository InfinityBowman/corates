import type { ChecklistEntry, MemberEntry, ProjectMeta, StudyInfo } from '@/stores/projectStore';

export const OUTCOME_PAIN = 'outcome-pain';
export const OUTCOME_DISABILITY = 'outcome-disability';
export const REVIEWER_A = 'user-a';
export const REVIEWER_B = 'user-b';

export const meta: ProjectMeta = {
  name: 'Exercise for chronic low back pain',
  outcomes: [
    { id: OUTCOME_PAIN, name: 'Pain intensity', createdAt: 1 },
    { id: OUTCOME_DISABILITY, name: 'Disability', createdAt: 2 },
  ],
};

export const members: MemberEntry[] = [
  {
    userId: REVIEWER_A,
    role: 'owner',
    joinedAt: 0,
    name: 'Ravi Anand',
    email: 'ravi@example.org',
    givenName: 'Ravi',
    familyName: 'Anand',
    image: null,
  },
  {
    userId: REVIEWER_B,
    role: 'member',
    joinedAt: 0,
    name: 'Lena Ortiz',
    email: 'lena@example.org',
    givenName: 'Lena',
    familyName: 'Ortiz',
    image: null,
  },
];

let seq = 0;

export function checklist(overrides: Partial<ChecklistEntry> = {}): ChecklistEntry {
  seq += 1;
  return {
    id: `cl-${seq}`,
    type: 'ROB2',
    kind: 'reviewer',
    title: null,
    assignedTo: REVIEWER_A,
    outcomeId: OUTCOME_PAIN,
    status: 'finalized',
    createdAt: seq,
    updatedAt: seq,
    score: 'Low',
    answers: {
      domain1: { judgement: 'Low' },
      overall: { judgement: 'Low', direction: 'NA' },
    },
    ...overrides,
  };
}

export function study(
  id: string,
  checklists: ChecklistEntry[],
  overrides: Partial<StudyInfo> = {},
) {
  return {
    id,
    name: `${id} trial`,
    description: '',
    originalTitle: null,
    firstAuthor: null,
    publicationYear: null,
    authors: null,
    journal: null,
    doi: null,
    abstract: null,
    importSource: null,
    pdfUrl: null,
    pdfSource: null,
    pdfAccessible: false,
    pmid: null,
    url: null,
    volume: null,
    issue: null,
    pages: null,
    type: null,
    reviewer1: REVIEWER_A,
    reviewer2: null,
    createdAt: 0,
    updatedAt: 0,
    checklists,
    appraisals: [],
    pdfs: [],
    ...overrides,
  } satisfies StudyInfo;
}

/**
 * A dual-reviewer cell: two reviewer copies plus the finalized consensus, so
 * "consensus only" and the reviewer filter have something to disagree about.
 */
export function reconciledCell(outcomeId: string | null, type = 'ROB2'): ChecklistEntry[] {
  return [
    checklist({ type, outcomeId, assignedTo: REVIEWER_A, status: 'reviewer-completed' }),
    checklist({ type, outcomeId, assignedTo: REVIEWER_B, status: 'reviewer-completed' }),
    checklist({ type, outcomeId, kind: 'consensus', assignedTo: null, status: 'finalized' }),
  ];
}

/** 80 studies across two outcomes; the first 12 are the ones the tests pick. */
export function largeProject(): StudyInfo[] {
  return Array.from({ length: 80 }, (_, i) => {
    const outcomeId = i % 2 === 0 ? OUTCOME_PAIN : OUTCOME_DISABILITY;
    return study(`s${String(i + 1).padStart(2, '0')}`, [checklist({ outcomeId })], {
      firstAuthor: `Author${i + 1}`,
      publicationYear: '2021',
    });
  });
}
