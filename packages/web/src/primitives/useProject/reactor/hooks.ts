import { useContext } from 'react';
import { useValue } from '@tldraw/state-react';
import * as Y from 'yjs';
import { ProjectReactorContext } from './context';
import type { ProjectReactor, ChecklistReactor } from './core';
import { connectionPool } from '@/project/ConnectionPool';
import { useProjectStore } from '@/stores/projectStore';
import type { StudyInfo, ChecklistEntry, MemberEntry, ProjectMeta } from '@/stores/projectStore';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import {
  scoreRob2Domain,
  getActiveDomainKeys as getROB2ActiveDomainKeys,
  getDomainQuestions as getROB2DomainQuestions,
} from '@corates/shared/checklists/rob2';
import type { DomainAnswers as ROB2DomainAnswers } from '@corates/shared/checklists/rob2';
import {
  scoreRobinsDomain,
  getActiveDomainKeys as getROBINSIActiveDomainKeys,
  getDomainQuestions as getROBINSIDomainQuestions,
} from '@corates/shared/checklists/robins-i';
import type { DomainAnswers as ROBINSIDomainAnswers } from '@corates/shared/checklists/robins-i';
import {
  AMSTAR2_DATA_KEYS,
  scoreAMSTAR2Checklist,
  getAnswers as getAMSTAR2Answers,
} from '@corates/shared/checklists/amstar2';
import type { AMSTAR2Checklist } from '@corates/shared/checklists';
import { CHECKLIST_TYPES } from '@/checklist-registry/types';

export function useProjectReactor() {
  const reactor = useContext(ProjectReactorContext);
  if (!reactor) throw new Error('useProjectReactor must be used within ProjectReactorContext');
  return reactor;
}

export function useStudyIds(): string[] {
  const reactor = useProjectReactor();
  return useValue(reactor.studies.ids);
}

export function useSortedStudyIds(): string[] {
  const reactor = useProjectReactor();
  return useValue(reactor.sortedStudyIds);
}

export function useStudyField<T>(studyId: string, field: string): T | null {
  const reactor = useProjectReactor();
  return useValue(
    `sf:${studyId}:${field}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      return study.fields.field<T>(field).get();
    },
    [reactor, studyId, field],
  );
}

export function useChecklistIds(studyId: string): string[] {
  const reactor = useProjectReactor();
  return useValue(
    `ci:${studyId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return [];
      return study.checklists.ids.get();
    },
    [reactor, studyId],
  );
}

export function useChecklistField<T>(
  studyId: string,
  checklistId: string,
  field: string,
): T | null {
  const reactor = useProjectReactor();
  return useValue(
    `cf:${studyId}:${checklistId}:${field}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      return cl.fields.field<T>(field).get();
    },
    [reactor, studyId, checklistId, field],
  );
}

export function useAnswer<T = string | null>(
  studyId: string,
  checklistId: string,
  key: string,
): T | null {
  const reactor = useProjectReactor();
  return useValue(
    `a:${studyId}:${checklistId}:${key}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      return cl.answers.field<T>(key).get();
    },
    [reactor, studyId, checklistId, key],
  );
}

export function useAnswersYMap(studyId: string, checklistId: string): Y.Map<unknown> | null {
  const reactor = useProjectReactor();
  const study = reactor.studies.get(studyId);
  if (!study) return null;
  const cl = study.checklists.get(checklistId);
  if (!cl) return null;
  return cl.answers.ymap;
}

// --- ROB2 scoring hooks ---

export function useROB2DomainScore(
  studyId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const reactor = useProjectReactor();
  return useValue(
    `rob2d:${studyId}:${checklistId}:${domainKey}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return { judgement: null, isComplete: false };
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return { judgement: null, isComplete: false };

      const questions = getROB2DomainQuestions(domainKey);
      const answers: ROB2DomainAnswers = {};
      for (const qKey of Object.keys(questions)) {
        answers[qKey] = {
          answer: cl.answers.field<string | null>(qKey).get(),
        };
      }

      const result = scoreRob2Domain(domainKey, answers);
      return { judgement: result.judgement, isComplete: result.isComplete };
    },
    [reactor, studyId, checklistId, domainKey],
  );
}

export function useROB2Score(studyId: string, checklistId: string): string {
  const reactor = useProjectReactor();
  return useValue(
    `rob2score:${studyId}:${checklistId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return 'Incomplete';
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return 'Incomplete';

      const aim = cl.answers.field<string | null>('preliminary.aim').get();
      const isAdhering = aim === 'ADHERING';
      const activeDomains = getROB2ActiveDomainKeys(isAdhering);

      const judgements: string[] = [];
      for (const dk of activeDomains) {
        const questions = getROB2DomainQuestions(dk);
        const answers: ROB2DomainAnswers = {};
        for (const qKey of Object.keys(questions)) {
          answers[qKey] = {
            answer: cl.answers.field<string | null>(qKey).get(),
          };
        }
        const result = scoreRob2Domain(dk, answers);
        if (result.judgement) {
          judgements.push(result.judgement);
        }
      }

      if (judgements.length < activeDomains.length) return 'Incomplete';
      if (judgements.includes('High')) return 'High';
      if (judgements.includes('Some concerns')) return 'Some concerns';
      return 'Low';
    },
    [reactor, studyId, checklistId],
  );
}

// --- ROBINS-I scoring hooks ---

export function useROBINSIDomainScore(
  studyId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const reactor = useProjectReactor();
  return useValue(
    `robinsiD:${studyId}:${checklistId}:${domainKey}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return { judgement: null, isComplete: false };
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return { judgement: null, isComplete: false };

      const questions = getROBINSIDomainQuestions(domainKey);
      const answers: ROBINSIDomainAnswers = {};
      for (const qKey of Object.keys(questions)) {
        answers[qKey] = {
          answer: cl.answers.field<string | null>(qKey).get(),
        };
      }

      const result = scoreRobinsDomain(domainKey, answers);
      return { judgement: result.judgement, isComplete: result.isComplete };
    },
    [reactor, studyId, checklistId, domainKey],
  );
}

export function useROBINSIScore(studyId: string, checklistId: string): string {
  const reactor = useProjectReactor();
  return useValue(
    `robinsiScore:${studyId}:${checklistId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return 'Incomplete';
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return 'Incomplete';

      const isPerProtocol =
        cl.answers.field<boolean | null>('sectionC.isPerProtocol').get() === true;
      const activeDomains = getROBINSIActiveDomainKeys(isPerProtocol);

      const judgements: string[] = [];
      for (const dk of activeDomains) {
        const questions = getROBINSIDomainQuestions(dk);
        const answers: ROBINSIDomainAnswers = {};
        for (const qKey of Object.keys(questions)) {
          answers[qKey] = {
            answer: cl.answers.field<string | null>(qKey).get(),
          };
        }
        const result = scoreRobinsDomain(dk, answers);
        if (result.judgement) {
          judgements.push(result.judgement);
        }
      }

      if (judgements.length < activeDomains.length) return 'Incomplete';
      if (judgements.includes('Critical')) return 'Critical';
      if (judgements.includes('Serious')) return 'Serious';
      if (judgements.includes('Moderate')) return 'Moderate';
      if (judgements.includes('Low (except for concerns about uncontrolled confounding)')) {
        return 'Low (except for concerns about uncontrolled confounding)';
      }
      return 'Low';
    },
    [reactor, studyId, checklistId],
  );
}

// --- Generic scoring hook ---

export function useChecklistScore(
  studyId: string,
  checklistId: string,
  checklistType: string | null,
): string | null {
  const reactor = useProjectReactor();
  return useValue(
    `score:${studyId}:${checklistId}:${checklistType}`,
    () => {
      if (!checklistType) return null;
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;

      if (checklistType === CHECKLIST_TYPES.ROB2) {
        return computeROB2Score(cl);
      }
      if (checklistType === CHECKLIST_TYPES.ROBINS_I) {
        return computeROBINSIScore(cl);
      }
      if (checklistType === CHECKLIST_TYPES.AMSTAR2) {
        return computeAMSTAR2Score(cl);
      }
      return null;
    },
    [reactor, studyId, checklistId, checklistType],
  );
}

function computeROB2DomainJudgements(cl: {
  answers: { field: <T>(key: string) => { get: () => T | null } };
}): { judgements: Record<string, string | null>; overall: string } {
  const aim = cl.answers.field<string | null>('preliminary.aim').get();
  const isAdhering = aim === 'ADHERING';
  const activeDomains = getROB2ActiveDomainKeys(isAdhering);

  const judgements: Record<string, string | null> = {};
  for (const dk of activeDomains) {
    const questions = getROB2DomainQuestions(dk);
    const answers: ROB2DomainAnswers = {};
    for (const qKey of Object.keys(questions)) {
      answers[qKey] = { answer: cl.answers.field<string | null>(qKey).get() };
    }
    const result = scoreRob2Domain(dk, answers);
    judgements[dk] = result.judgement ?? null;
  }

  const values = Object.values(judgements);
  let overall: string;
  if (values.some(j => j === null)) overall = 'Incomplete';
  else if (values.includes('High')) overall = 'High';
  else if (values.includes('Some concerns')) overall = 'Some concerns';
  else overall = 'Low';
  return { judgements, overall };
}

function computeROB2Score(cl: {
  answers: { field: <T>(key: string) => { get: () => T | null } };
}): string {
  return computeROB2DomainJudgements(cl).overall;
}

// Chart column ids for the ROB2 figures; both variants of domain 2 render as D2
const ROB2_CHART_DOMAIN_KEYS: Record<string, string> = {
  domain1: 'd1',
  domain2a: 'd2',
  domain2b: 'd2',
  domain3: 'd3',
  domain4: 'd4',
  domain5: 'd5',
};

function computeROBINSIDomainJudgements(cl: {
  answers: { field: <T>(key: string) => { get: () => T | null } };
}): { judgements: Record<string, string | null>; overall: string } {
  const isPerProtocol = cl.answers.field<boolean | null>('sectionC.isPerProtocol').get() === true;
  const activeDomains = getROBINSIActiveDomainKeys(isPerProtocol);

  const judgements: Record<string, string | null> = {};
  for (const dk of activeDomains) {
    const questions = getROBINSIDomainQuestions(dk);
    const answers: ROBINSIDomainAnswers = {};
    for (const qKey of Object.keys(questions)) {
      answers[qKey] = { answer: cl.answers.field<string | null>(qKey).get() };
    }
    const result = scoreRobinsDomain(dk, answers);
    judgements[dk] = result.judgement ?? null;
  }

  const values = Object.values(judgements);
  let overall: string;
  if (values.some(j => j === null)) overall = 'Incomplete';
  else if (values.includes('Critical')) overall = 'Critical';
  else if (values.includes('Serious')) overall = 'Serious';
  else if (values.includes('Moderate')) overall = 'Moderate';
  else if (values.includes('Low (except for concerns about uncontrolled confounding)')) {
    overall = 'Low (except for concerns about uncontrolled confounding)';
  } else overall = 'Low';
  return { judgements, overall };
}

function computeROBINSIScore(cl: {
  answers: { field: <T>(key: string) => { get: () => T | null } };
}): string {
  return computeROBINSIDomainJudgements(cl).overall;
}

// Chart column ids for the ROBINS-I figures; both variants of domain 1 render as D1
const ROBINSI_CHART_DOMAIN_KEYS: Record<string, string> = {
  domain1a: 'd1',
  domain1b: 'd1',
  domain2: 'd2',
  domain3: 'd3',
  domain4: 'd4',
  domain5: 'd5',
  domain6: 'd6',
};

function computeAMSTAR2Score(cl: {
  answers: { field: <T>(key: string) => { get: () => T | null } };
}): string {
  const checklist: Record<string, unknown> = {};
  for (const qKey of AMSTAR2_DATA_KEYS) {
    const answers = cl.answers.field<boolean[][]>(`${qKey}.answers`).get();
    const critical = cl.answers.field<boolean>(`${qKey}.critical`).get();
    if (!answers) continue;
    checklist[qKey] = { answers, critical: critical ?? false };
  }

  const hasAllAnswers = AMSTAR2_DATA_KEYS.every(qKey => {
    const q = checklist[qKey] as { answers: boolean[][] } | undefined;
    if (!q?.answers?.length) return false;
    const lastCol = q.answers[q.answers.length - 1];
    return Array.isArray(lastCol) && lastCol.some(v => v === true);
  });

  if (!hasAllAnswers) return 'Incomplete';
  return scoreAMSTAR2Checklist(checklist as unknown as AMSTAR2Checklist);
}

// ---------------------------------------------------------------------------
// ProjectId-based hooks (work outside ProjectReactorContext)
// ---------------------------------------------------------------------------

const EMPTY_META: ProjectMeta = { outcomes: [] };
const EMPTY_MEMBERS: MemberEntry[] = [];
const EMPTY_STUDIES: StudyInfo[] = [];

function useReactorByProjectId(projectId: string): ProjectReactor | null {
  useProjectStore(state => state.connections[projectId]?.phase);
  return connectionPool.getReactor(projectId);
}

export function useProjectMetaById(projectId: string): ProjectMeta {
  const reactor = useReactorByProjectId(projectId);
  return useValue(
    `meta:${projectId}`,
    () => {
      if (!reactor) return EMPTY_META;
      return reactor.meta.get();
    },
    [reactor],
  );
}

export function useProjectMembersById(projectId: string): MemberEntry[] {
  const reactor = useReactorByProjectId(projectId);
  return useValue(
    `members:${projectId}`,
    () => {
      if (!reactor) return EMPTY_MEMBERS;
      return reactor.members.get();
    },
    [reactor],
  );
}

export function useSortedStudyIdsById(projectId: string): string[] {
  const reactor = useReactorByProjectId(projectId);
  return useValue(
    `studyIds:${projectId}`,
    () => {
      if (!reactor) return [];
      return reactor.sortedStudyIds.get();
    },
    [reactor],
  );
}

function buildChecklistEntry(clId: string, cl: ChecklistReactor): ChecklistEntry {
  const status = cl.fields.field<string>('status').get() ?? 'pending';
  const type = cl.fields.field<string>('type').get() ?? 'AMSTAR2';

  let score: string | null = null;
  let consolidatedAnswers: Record<string, string | null> | null = null;
  if (status === CHECKLIST_STATUS.FINALIZED) {
    if (type === 'ROB2') {
      const { judgements, overall } = computeROB2DomainJudgements(cl);
      score = overall;
      consolidatedAnswers = {};
      for (const [domainKey, judgement] of Object.entries(judgements)) {
        consolidatedAnswers[ROB2_CHART_DOMAIN_KEYS[domainKey]] = judgement ?? 'No information';
      }
      consolidatedAnswers.overall = overall === 'Incomplete' ? 'No information' : overall;
    } else if (type === 'ROBINS_I') {
      const { judgements, overall } = computeROBINSIDomainJudgements(cl);
      score = overall;
      consolidatedAnswers = {};
      for (const [domainKey, judgement] of Object.entries(judgements)) {
        consolidatedAnswers[ROBINSI_CHART_DOMAIN_KEYS[domainKey]] = judgement ?? 'No information';
      }
      consolidatedAnswers.overall = overall === 'Incomplete' ? 'No information' : overall;
    } else if (type === 'AMSTAR2') {
      score = computeAMSTAR2Score(cl);
      const checklist: Record<string, unknown> = {};
      for (const qKey of AMSTAR2_DATA_KEYS) {
        const answers = cl.answers.field<boolean[][]>(`${qKey}.answers`).get();
        const critical = cl.answers.field<boolean>(`${qKey}.critical`).get();
        if (!answers) continue;
        checklist[qKey] = { answers, critical: critical ?? false };
      }
      consolidatedAnswers = getAMSTAR2Answers(checklist as unknown as AMSTAR2Checklist) ?? null;
    }
    if (score === 'Incomplete' || score === 'Error') score = null;
  }

  return {
    id: clId,
    type,
    title: cl.fields.field<string | null>('title').get() ?? null,
    assignedTo: cl.fields.field<string | null>('assignedTo').get() ?? null,
    outcomeId: cl.fields.field<string | null>('outcomeId').get() ?? null,
    status,
    createdAt: cl.fields.field<number>('createdAt').get() ?? 0,
    updatedAt: cl.fields.field<number>('updatedAt').get() ?? 0,
    score,
    answers: null,
    consolidatedAnswers,
  };
}

function buildStudyInfoFromReactor(studyId: string, reactor: ProjectReactor): StudyInfo | null {
  reactor.studies.ids.get();
  const study = reactor.studies.get(studyId);
  if (!study) return null;

  const f = study.fields;
  const checklistIds = study.checklists.ids.get();
  const checklists: ChecklistEntry[] = [];
  for (const clId of checklistIds) {
    const cl = study.checklists.get(clId);
    if (cl) checklists.push(buildChecklistEntry(clId, cl));
  }

  return {
    id: studyId,
    name: f.field<string>('name').get() ?? '',
    description: f.field<string>('description').get() ?? '',
    originalTitle: f.field<string | null>('originalTitle').get() ?? null,
    firstAuthor: f.field<string | null>('firstAuthor').get() ?? null,
    publicationYear: f.field<string | null>('publicationYear').get() ?? null,
    authors: f.field<string | null>('authors').get() ?? null,
    journal: f.field<string | null>('journal').get() ?? null,
    doi: f.field<string | null>('doi').get() ?? null,
    abstract: f.field<string | null>('abstract').get() ?? null,
    importSource: f.field<string | null>('importSource').get() ?? null,
    pdfUrl: f.field<string | null>('pdfUrl').get() ?? null,
    pdfSource: f.field<string | null>('pdfSource').get() ?? null,
    pdfAccessible: Boolean(f.field<boolean>('pdfAccessible').get()),
    pmid: f.field<string | null>('pmid').get() ?? null,
    url: f.field<string | null>('url').get() ?? null,
    volume: f.field<string | null>('volume').get() ?? null,
    issue: f.field<string | null>('issue').get() ?? null,
    pages: f.field<string | null>('pages').get() ?? null,
    type: f.field<string | null>('type').get() ?? null,
    reviewer1: f.field<string | null>('reviewer1').get() ?? null,
    reviewer2: f.field<string | null>('reviewer2').get() ?? null,
    createdAt: f.field<number>('createdAt').get() ?? 0,
    updatedAt: f.field<number>('updatedAt').get() ?? 0,
    checklists,
    pdfs: study.pdfs.get(),
  };
}

export function useStudyById(projectId: string, studyId: string): StudyInfo | undefined {
  const reactor = useReactorByProjectId(projectId);
  return useValue(
    `studyInfo:${projectId}:${studyId}`,
    () => {
      if (!reactor) return undefined;
      return buildStudyInfoFromReactor(studyId, reactor) ?? undefined;
    },
    [reactor, studyId],
  );
}

export function useAllStudiesById(projectId: string): StudyInfo[] {
  const reactor = useReactorByProjectId(projectId);
  return useValue(
    `allStudies:${projectId}`,
    () => {
      if (!reactor) return EMPTY_STUDIES;
      const ids = reactor.sortedStudyIds.get();
      const result: StudyInfo[] = [];
      for (const id of ids) {
        const info = buildStudyInfoFromReactor(id, reactor);
        if (info) result.push(info);
      }
      return result;
    },
    [reactor],
  );
}
