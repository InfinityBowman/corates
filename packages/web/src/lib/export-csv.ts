import type { StudyInfo, MemberEntry, ProjectMeta, ChecklistEntry } from '@/stores/projectStore';
import { amstar2 } from '@corates/shared';

interface ExportOptions {
  studies: StudyInfo[];
  members?: MemberEntry[];
  meta?: ProjectMeta;
}

const ROB2_HEADERS = [
  'D1 Judgment',
  'D2 Judgment',
  'D3 Judgment',
  'D4 Judgment',
  'D5 Judgment',
  'Overall Judgment',
  'Overall Direction',
];

const ROBINSI_HEADERS = [
  'D1 Judgment',
  'D2 Judgment',
  'D3 Judgment',
  'D4 Judgment',
  'D5 Judgment',
  'D6 Judgment',
  'Overall Judgment',
  'Overall Direction',
];

const TYPE_LABELS: Record<string, string> = {
  AMSTAR2: 'AMSTAR 2',
  ROB2: 'RoB 2',
  ROBINS_I: 'ROBINS-I',
};

function escapeField(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function resolveReviewer(assignedTo: string | null, members: MemberEntry[]): string {
  if (!assignedTo) return 'Reconciled';
  const member = members.find(m => m.userId === assignedTo);
  if (!member) return assignedTo;
  const name = [member.givenName, member.familyName].filter(Boolean).join(' ');
  return name || member.email;
}

function resolveOutcome(outcomeId: string | null, meta?: ProjectMeta): string {
  if (!outcomeId || !meta) return '';
  const outcome = meta.outcomes?.find(o => o.id === outcomeId);
  return outcome?.name || '';
}

type DomainData = {
  judgement?: string | null;
  direction?: string | null;
};

// --- AMSTAR2 ---

interface ColumnMapping {
  dataKey: string;
  columns: { label: string; options: string[] }[];
}

function getAmstar2ColumnMappings(): ColumnMapping[] {
  const schema = amstar2.AMSTAR_CHECKLIST;
  return amstar2.AMSTAR2_DATA_KEYS.map(dataKey => {
    let schemaKey: string;
    let useColumns2 = false;

    if (dataKey === 'q9a') {
      schemaKey = 'q9';
    } else if (dataKey === 'q9b') {
      schemaKey = 'q9';
      useColumns2 = true;
    } else if (dataKey === 'q11a') {
      schemaKey = 'q11';
    } else if (dataKey === 'q11b') {
      schemaKey = 'q11';
      useColumns2 = true;
    } else {
      schemaKey = dataKey;
    }

    const question = schema[schemaKey];
    const columns =
      useColumns2 ? (question.columns2 || question.columns) : question.columns;

    return { dataKey, columns };
  });
}

function buildAmstar2Headers(): string[] {
  const headers: string[] = [];
  const mappings = getAmstar2ColumnMappings();

  const DATA_KEY_LABELS: Record<string, string> = {
    q9a: 'Q9 RCTs',
    q9b: 'Q9 NRSI',
    q11a: 'Q11 RCTs',
    q11b: 'Q11 NRSI',
  };

  for (const { dataKey, columns } of mappings) {
    const label = DATA_KEY_LABELS[dataKey] || dataKey.toUpperCase();
    for (let colIdx = 0; colIdx < columns.length - 1; colIdx++) {
      for (const option of columns[colIdx].options) {
        headers.push(`${label} - ${option.trim()}`);
      }
    }
    headers.push(label);
  }

  return headers;
}

function getAmstar2Values(cl: ChecklistEntry): string[] {
  const mappings = getAmstar2ColumnMappings();
  const values: string[] = [];
  const raw = cl.answers as Record<string, { answers?: boolean[][] }> | null;

  for (const { dataKey, columns } of mappings) {
    const answerGrid = raw?.[dataKey]?.answers;

    for (let colIdx = 0; colIdx < columns.length - 1; colIdx++) {
      const colAnswers = answerGrid?.[colIdx];
      for (let optIdx = 0; optIdx < columns[colIdx].options.length; optIdx++) {
        values.push(colAnswers?.[optIdx] ? 'Yes' : '');
      }
    }

    const lastCol = answerGrid?.[answerGrid.length - 1];
    if (!lastCol) {
      values.push('');
    } else {
      const selectedIdx = lastCol.findIndex(v => v === true);
      const answerOptions = columns[columns.length - 1].options;
      values.push(selectedIdx >= 0 ? (answerOptions[selectedIdx]?.trim() || '') : '');
    }
  }

  return values;
}

// --- ROB2 ---

function getRob2Values(answers: Record<string, unknown> | null): string[] {
  if (!answers) return ROB2_HEADERS.map(() => '');

  const preliminary = answers.preliminary as { aim?: string } | undefined;
  const isAdhering = preliminary?.aim === 'ADHERING';
  const domain2Key = isAdhering ? 'domain2b' : 'domain2a';

  const domainKeys = ['domain1', domain2Key, 'domain3', 'domain4', 'domain5'];
  const judgments = domainKeys.map(k => {
    const domain = answers[k] as DomainData | undefined;
    return domain?.judgement ?? '';
  });

  const overall = answers.overall as DomainData | undefined;
  return [...judgments, overall?.judgement ?? '', overall?.direction ?? ''];
}

// --- ROBINS-I ---

function getRobinsiValues(answers: Record<string, unknown> | null): string[] {
  if (!answers) return ROBINSI_HEADERS.map(() => '');

  const sectionC = answers.sectionC as { isPerProtocol?: boolean } | undefined;
  const isPerProtocol = sectionC?.isPerProtocol ?? false;
  const domain1Key = isPerProtocol ? 'domain1b' : 'domain1a';

  const domainKeys = [domain1Key, 'domain2', 'domain3', 'domain4', 'domain5', 'domain6'];
  const judgments = domainKeys.map(k => {
    const domain = answers[k] as DomainData | undefined;
    return domain?.judgement ?? '';
  });

  const overall = answers.overall as DomainData | undefined;
  return [...judgments, overall?.judgement ?? '', overall?.direction ?? ''];
}

// --- Generic ---

function getTypeValues(cl: ChecklistEntry): string[] {
  switch (cl.type) {
    case 'AMSTAR2':
      return getAmstar2Values(cl);
    case 'ROB2':
      return getRob2Values(cl.answers);
    case 'ROBINS_I':
      return getRobinsiValues(cl.answers);
    default:
      return [];
  }
}

function getTypeHeaders(type: string): string[] {
  switch (type) {
    case 'AMSTAR2':
      return buildAmstar2Headers();
    case 'ROB2':
      return ROB2_HEADERS.map(h => `RoB2 ${h}`);
    case 'ROBINS_I':
      return ROBINSI_HEADERS.map(h => `ROBINS-I ${h}`);
    default:
      return [];
  }
}

function getChecklistTypesPresent(studies: StudyInfo[]): string[] {
  const types = new Set<string>();
  for (const study of studies) {
    for (const cl of study.checklists) {
      types.add(cl.type);
    }
  }
  return Array.from(types);
}

function hasMultipleReviewers(studies: StudyInfo[]): boolean {
  for (const study of studies) {
    if (study.checklists.length > 1) return true;
    if (study.reviewer2) return true;
  }
  return false;
}

function hasOutcomes(studies: StudyInfo[]): boolean {
  for (const study of studies) {
    for (const cl of study.checklists) {
      if (cl.outcomeId) return true;
    }
  }
  return false;
}

export function buildProjectCsv({ studies, members, meta }: ExportOptions): string {
  const typesPresent = getChecklistTypesPresent(studies);
  const showReviewer = hasMultipleReviewers(studies);
  const showOutcome = hasOutcomes(studies);

  const headers: string[] = ['Study', 'First Author', 'Year', 'Journal', 'DOI', 'Checklist Type'];
  if (showReviewer) headers.push('Reviewer');
  if (showOutcome) headers.push('Outcome');
  headers.push('Status', 'Overall Score');

  const typeHeadersMap = new Map<string, string[]>();
  for (const type of typesPresent) {
    const th = getTypeHeaders(type);
    typeHeadersMap.set(type, th);
    headers.push(...th);
  }

  const rows: string[][] = [headers];

  for (const study of studies) {
    if (study.checklists.length === 0) continue;

    for (const cl of study.checklists) {
      const row: string[] = [
        study.name || study.originalTitle || '',
        study.firstAuthor ?? '',
        study.publicationYear ?? '',
        study.journal ?? '',
        study.doi ?? '',
        TYPE_LABELS[cl.type] || cl.type,
      ];

      if (showReviewer) row.push(resolveReviewer(cl.assignedTo, members || []));
      if (showOutcome) row.push(resolveOutcome(cl.outcomeId, meta));
      row.push(cl.status, cl.score ?? '');

      for (const type of typesPresent) {
        if (cl.type === type) {
          row.push(...getTypeValues(cl));
        } else {
          row.push(...(typeHeadersMap.get(type) || []).map(() => ''));
        }
      }

      rows.push(row);
    }
  }

  return rows.map(row => row.map(escapeField).join(',')).join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
