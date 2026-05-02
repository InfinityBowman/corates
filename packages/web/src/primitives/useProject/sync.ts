/**
 * Y.js sync utilities for useProject
 * Handles syncing Y.Doc state to the project store
 */

import * as Y from 'yjs';
import type {
  StudyInfo,
  ChecklistEntry,
  MemberEntry,
  ProjectMeta,
  OutcomeEntry,
} from '@/stores/projectStore';
import { useProjectStore } from '@/stores/projectStore';
import { getProjectAtoms, cleanupProjectAtoms } from '@/stores/projectAtoms';
import { scoreChecklistOfType } from '@/checklist-registry/index';
import { amstar2 } from '@corates/shared';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import type { AMSTAR2Checklist } from '@corates/shared/checklists';
import { markCycleStart, countProbe, addBuildStudyTime } from './sync-perf';

const getAMSTAR2Answers = amstar2.getAnswers;

export interface SyncManager {
  syncFromYDocImmediate: () => void;
  attach: (ydoc: Y.Doc) => void;
  detach: () => void;
  pause: () => void;
  resume: () => void;
}

export function createSyncManager(projectId: string, getYDoc: () => Y.Doc | null): SyncManager {
  let pendingSync = false;
  let rafId: number | null = null;
  let detached = false;
  let paused = false;
  const cleanupHandlers: (() => void)[] = [];

  // Per-slice dirty flags -- set by scoped observers, consumed by doSync
  const dirtySlices = { studies: false, members: false, meta: false };

  // Per-study snapshot cache -- dirty studies get rebuilt, clean studies keep their reference
  const studyCache = new Map<string, StudyInfo>();
  let sortedStudies: StudyInfo[] = [];

  function handleReviewsEvents(events: Y.YEvent<any>[]): void {
    if (paused) return;
    markCycleStart();
    countProbe('handleReviewsEvents');

    const reviewsMap = getYDoc()?.getMap('reviews');
    if (!reviewsMap) return;

    const dirtyStudyIds = new Set<string>();
    let structuralChange = false;

    for (const event of events) {
      if (event.path.length === 0 && 'keys' in event) {
        // Top-level: studies added or removed from the reviews map
        structuralChange = true;
        for (const [key] of (event as Y.YMapEvent<unknown>).keys) {
          dirtyStudyIds.add(key);
        }
      } else if (event.path.length > 0) {
        // Nested: something inside a specific study changed
        dirtyStudyIds.add(String(event.path[0]));
      }
    }

    // Rebuild only dirty studies
    for (const studyId of dirtyStudyIds) {
      const studyYMap = reviewsMap.get(studyId) as Y.Map<unknown> | undefined;
      if (studyYMap) {
        countProbe('buildStudy');
        const t0 = performance.now();
        studyCache.set(studyId, buildStudyFromYMap(studyId, studyYMap));
        addBuildStudyTime(performance.now() - t0);
      } else {
        studyCache.delete(studyId);
      }
    }

    // Clean up entries for studies that no longer exist in the Y.Map
    if (structuralChange) {
      for (const cachedId of studyCache.keys()) {
        if (!reviewsMap.has(cachedId)) {
          studyCache.delete(cachedId);
        }
      }
    }

    if (dirtyStudyIds.size > 0 || structuralChange) {
      sortedStudies = [...studyCache.values()].sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
      );
      dirtySlices.studies = true;
      scheduleSync();
    }
  }

  function rebuildAllStudies(): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const reviewsMap = ydoc.getMap('reviews');
    studyCache.clear();

    for (const [studyId, studyYMap] of reviewsMap.entries()) {
      const ymap = studyYMap as Y.Map<unknown>;
      studyCache.set(studyId, buildStudyFromYMap(studyId, ymap));
    }

    sortedStudies = [...studyCache.values()].sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
    );
  }

  function buildMetaData(ydoc: Y.Doc): ProjectMeta {
    const metaMap = ydoc.getMap('meta');
    const metaData = (metaMap.toJSON ? metaMap.toJSON() : {}) as ProjectMeta;

    const outcomesMap = metaMap.get('outcomes') as Y.Map<unknown> | undefined;
    if (outcomesMap && typeof outcomesMap.entries === 'function') {
      const outcomesList: OutcomeEntry[] = [];
      for (const [outcomeId, outcomeYMap] of outcomesMap.entries()) {
        const ymap = outcomeYMap as { toJSON?: () => Record<string, unknown> };
        const outcomeData = ymap.toJSON ? ymap.toJSON() : (outcomeYMap as Record<string, unknown>);
        outcomesList.push({ id: outcomeId, ...outcomeData } as OutcomeEntry);
      }
      outcomesList.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      metaData.outcomes = outcomesList;
    } else {
      metaData.outcomes = [];
    }

    return metaData;
  }

  function doSync(): void {
    countProbe('doSync');
    const ydoc = getYDoc();
    if (!ydoc) return;

    const updates: {
      studies?: StudyInfo[];
      meta?: ProjectMeta;
      members?: MemberEntry[];
    } = {};

    if (dirtySlices.studies) {
      // If the cache is empty, this is the first sync -- populate from scratch
      if (studyCache.size === 0) {
        rebuildAllStudies();
      }
      updates.studies = sortedStudies;
    }

    if (dirtySlices.members) {
      updates.members = buildMembersList(ydoc.getMap('members'));
    }

    if (dirtySlices.meta) {
      updates.meta = buildMetaData(ydoc);
    }

    // Reset dirty flags before store update
    dirtySlices.studies = false;
    dirtySlices.members = false;
    dirtySlices.meta = false;

    const projectAtoms = getProjectAtoms(projectId);
    if (updates.studies !== undefined) {
      projectAtoms.setStudies(updates.studies);
      useProjectStore.getState().updateProjectStats(projectId, updates.studies);
    }
    if (updates.members !== undefined) {
      projectAtoms.members.set(updates.members);
    }
    if (updates.meta !== undefined) {
      projectAtoms.meta.set(updates.meta);
    }
  }

  function scheduleSync(): void {
    if (pendingSync) return;
    pendingSync = true;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      pendingSync = false;
      if (!detached) doSync();
    });
  }

  function syncFromYDocImmediate(): void {
    pendingSync = false;
    // Full rebuild: clear cache so doSync repopulates from scratch
    studyCache.clear();
    sortedStudies = [];
    dirtySlices.studies = true;
    dirtySlices.members = true;
    dirtySlices.meta = true;
    doSync();
  }

  function attach(ydoc: Y.Doc): void {
    const reviewsMap = ydoc.getMap('reviews');
    const membersMap = ydoc.getMap('members');
    const metaMap = ydoc.getMap('meta');

    const onReviews = (events: Y.YEvent<any>[]) => {
      handleReviewsEvents(events);
    };
    const onMembers = () => {
      if (paused) return;
      dirtySlices.members = true;
      scheduleSync();
    };
    const onMeta = () => {
      if (paused) return;
      dirtySlices.meta = true;
      scheduleSync();
    };

    reviewsMap.observeDeep(onReviews);
    membersMap.observe(onMembers);
    metaMap.observeDeep(onMeta);

    cleanupHandlers.push(
      () => reviewsMap.unobserveDeep(onReviews),
      () => membersMap.unobserve(onMembers),
      () => metaMap.unobserveDeep(onMeta),
    );
  }

  function detach(): void {
    detached = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      pendingSync = false;
    }
    for (const cleanup of cleanupHandlers) {
      try {
        cleanup();
      } catch (_) {
        /* ignore */
      }
    }
    cleanupHandlers.length = 0;
    studyCache.clear();
    sortedStudies = [];
    cleanupProjectAtoms(projectId);
  }

  function pause(): void {
    paused = true;
  }

  function resume(): void {
    paused = false;
  }

  return { syncFromYDocImmediate, attach, detach, pause, resume };
}

function getStr(m: Y.Map<unknown>, key: string): string | null {
  return (m.get(key) as string) || null;
}

function buildStudyFromYMap(studyId: string, studyYMap: Y.Map<unknown>): StudyInfo {
  const study: StudyInfo = {
    id: studyId,
    name: (studyYMap.get('name') as string) || '',
    description: (studyYMap.get('description') as string) || '',
    originalTitle: getStr(studyYMap, 'originalTitle'),
    firstAuthor: getStr(studyYMap, 'firstAuthor'),
    publicationYear: getStr(studyYMap, 'publicationYear'),
    authors: getStr(studyYMap, 'authors'),
    journal: getStr(studyYMap, 'journal'),
    doi: getStr(studyYMap, 'doi'),
    abstract: getStr(studyYMap, 'abstract'),
    importSource: getStr(studyYMap, 'importSource'),
    pdfUrl: getStr(studyYMap, 'pdfUrl'),
    pdfSource: getStr(studyYMap, 'pdfSource'),
    pdfAccessible: Boolean(studyYMap.get('pdfAccessible') || false),
    pmid: getStr(studyYMap, 'pmid'),
    url: getStr(studyYMap, 'url'),
    volume: getStr(studyYMap, 'volume'),
    issue: getStr(studyYMap, 'issue'),
    pages: getStr(studyYMap, 'pages'),
    type: getStr(studyYMap, 'type'),
    reviewer1: getStr(studyYMap, 'reviewer1'),
    reviewer2: getStr(studyYMap, 'reviewer2'),
    createdAt: studyYMap.get('createdAt') as number,
    updatedAt: studyYMap.get('updatedAt') as number,
    checklists: [],
    pdfs: [],
  };

  // Checklists
  const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
  if (checklistsMap && typeof checklistsMap.entries === 'function') {
    for (const [checklistId, checklistYMap] of checklistsMap.entries()) {
      const clYMap = checklistYMap as Y.Map<unknown>;
      const checklistType = (clYMap.get('type') as string) || 'AMSTAR2';
      const status = (clYMap.get('status') as string) || 'pending';

      const checklistEntry: ChecklistEntry = {
        id: checklistId,
        type: checklistType,
        title: getStr(clYMap, 'title'),
        assignedTo: getStr(clYMap, 'assignedTo'),
        outcomeId: getStr(clYMap, 'outcomeId'),
        status,
        createdAt: clYMap.get('createdAt') as number,
        updatedAt: clYMap.get('updatedAt') as number,
        score: null,
        answers: null,
      };

      if (status === CHECKLIST_STATUS.FINALIZED) {
        const answersMap = clYMap.get('answers') as Y.Map<unknown> | undefined;
        if (answersMap && typeof answersMap.entries === 'function') {
          const answers = extractAnswersFromYMap(answersMap, checklistType);
          checklistEntry.answers = answers;

          const score = scoreChecklistOfType(checklistType, answers);
          if (score && score !== 'Error') {
            checklistEntry.score = score;
          }

          if (checklistType === 'AMSTAR2') {
            checklistEntry.consolidatedAnswers = getAMSTAR2Answers(
              answers as unknown as AMSTAR2Checklist,
            );
          }
        }
      }

      study.checklists.push(checklistEntry);
    }
  }

  // PDFs
  const pdfsMap = studyYMap.get('pdfs') as Y.Map<unknown> | undefined;
  if (pdfsMap && typeof pdfsMap.entries === 'function') {
    for (const [pdfId, pdfYMap] of pdfsMap.entries()) {
      const pYMap = pdfYMap as Y.Map<unknown>;
      study.pdfs.push({
        id: (pYMap.get('id') as string) || pdfId,
        fileName: (pYMap.get('fileName') as string) || pdfId,
        key: pYMap.get('key') as string,
        size: pYMap.get('size') as number,
        uploadedBy: pYMap.get('uploadedBy') as string,
        uploadedAt: pYMap.get('uploadedAt') as number,
        tag: (pYMap.get('tag') as string) || 'secondary',
        title: getStr(pYMap, 'title'),
        firstAuthor: getStr(pYMap, 'firstAuthor'),
        publicationYear: getStr(pYMap, 'publicationYear'),
        journal: getStr(pYMap, 'journal'),
        doi: getStr(pYMap, 'doi'),
      });
    }
  }

  // Reconciliation
  const reconciliationMap = studyYMap.get('reconciliation') as Y.Map<unknown> | undefined;
  if (reconciliationMap) {
    const c1 = reconciliationMap.get('checklist1Id') as string | undefined;
    const c2 = reconciliationMap.get('checklist2Id') as string | undefined;
    if (c1 && c2) {
      study.reconciliation = {
        checklist1Id: c1,
        checklist2Id: c2,
        reconciledChecklistId: getStr(reconciliationMap, 'reconciledChecklistId'),
        currentPage: (reconciliationMap.get('currentPage') as number) || 0,
        viewMode: (reconciliationMap.get('viewMode') as string) || 'questions',
        updatedAt: reconciliationMap.get('updatedAt') as number,
      };
    }
  }

  return study;
}

function buildMembersList(membersMap: Y.Map<unknown>): MemberEntry[] {
  const membersList: MemberEntry[] = [];
  for (const [userId, memberYMap] of membersMap.entries()) {
    const mYMap = memberYMap as { toJSON?: () => Record<string, unknown> };
    const memberData = mYMap.toJSON ? mYMap.toJSON() : (memberYMap as Record<string, unknown>);
    membersList.push({
      userId,
      role: memberData.role as string,
      joinedAt: memberData.joinedAt as number,
      name: memberData.name as string,
      email: memberData.email as string,
      givenName: memberData.givenName as string,
      familyName: memberData.familyName as string,
      image: (memberData.image as string) || null,
    });
  }
  return membersList;
}

function isYText(value: unknown): value is Y.Text {
  return (
    value !== null &&
    value !== undefined &&
    typeof (value as Y.Text).toString === 'function' &&
    typeof (value as Y.Text).insert === 'function'
  );
}

function yTextToStr(value: unknown): string {
  return isYText(value) ? value.toString() : ((value as string) ?? '');
}

export function extractAnswersFromYMap(
  answersMap: Y.Map<unknown>,
  checklistType: string,
): Record<string, unknown> {
  const answers: Record<string, unknown> = {};

  for (const [key, sectionYMap] of answersMap.entries()) {
    const section = sectionYMap as Y.Map<unknown>;

    if (checklistType === 'ROBINS_I' && section && typeof section.get === 'function') {
      if (key.startsWith('domain')) {
        const sectionData: Record<string, unknown> = {
          judgement: section.get('judgement') ?? null,
          answers: {} as Record<string, { answer: string | null; comment: string }>,
        };
        const direction = section.get('direction');
        if (direction !== undefined) sectionData.direction = direction;

        const answersNestedYMap = section.get('answers') as Y.Map<unknown> | undefined;
        if (answersNestedYMap && typeof answersNestedYMap.entries === 'function') {
          const answersObj = sectionData.answers as Record<
            string,
            { answer: string | null; comment: string }
          >;
          for (const [qKey, questionYMap] of answersNestedYMap.entries()) {
            const q = questionYMap as Y.Map<unknown>;
            if (q && typeof q.get === 'function') {
              answersObj[qKey] = {
                answer: (q.get('answer') as string) ?? null,
                comment: (q.get('comment') as string) ?? '',
              };
            } else {
              answersObj[qKey] = questionYMap as { answer: string | null; comment: string };
            }
          }
        }
        answers[key] = sectionData;
      } else if (key === 'overall') {
        const sectionData: Record<string, unknown> = {
          judgement: section.get('judgement') ?? null,
        };
        const direction = section.get('direction');
        if (direction !== undefined) sectionData.direction = direction;
        answers[key] = sectionData;
      } else if (key === 'sectionB') {
        const sectionData: Record<string, unknown> = {};
        for (const [subKey, subValue] of section.entries()) {
          const sv = subValue as Y.Map<unknown>;
          if (sv && typeof sv.get === 'function') {
            sectionData[subKey] = {
              answer: (sv.get('answer') as string) ?? null,
              comment: (sv.get('comment') as string) ?? '',
            };
          } else {
            sectionData[subKey] = subValue;
          }
        }
        answers[key] = sectionData;
      } else {
        const s = sectionYMap as { toJSON?: () => unknown };
        answers[key] = s.toJSON ? s.toJSON() : sectionYMap;
      }
    } else if (checklistType === 'ROB2' && section && typeof section.get === 'function') {
      if (key.startsWith('domain')) {
        const sectionData: Record<string, unknown> = {
          judgement: section.get('judgement') ?? null,
          answers: {} as Record<string, { answer: string | null; comment: string }>,
        };
        const direction = section.get('direction');
        if (direction !== undefined) sectionData.direction = direction;

        const answersNestedYMap = section.get('answers') as Y.Map<unknown> | undefined;
        if (answersNestedYMap && typeof answersNestedYMap.entries === 'function') {
          const answersObj = sectionData.answers as Record<
            string,
            { answer: string | null; comment: string }
          >;
          for (const [qKey, questionYMap] of answersNestedYMap.entries()) {
            const q = questionYMap as Y.Map<unknown>;
            if (q && typeof q.get === 'function') {
              answersObj[qKey] = {
                answer: (q.get('answer') as string) ?? null,
                comment: yTextToStr(q.get('comment')),
              };
            } else {
              answersObj[qKey] = questionYMap as { answer: string | null; comment: string };
            }
          }
        }
        answers[key] = sectionData;
      } else if (key === 'overall') {
        const sectionData: Record<string, unknown> = {
          judgement: section.get('judgement') ?? null,
        };
        const direction = section.get('direction');
        if (direction !== undefined) sectionData.direction = direction;
        answers[key] = sectionData;
      } else if (key === 'preliminary') {
        answers[key] = {
          studyDesign: section.get('studyDesign') ?? null,
          experimental: yTextToStr(section.get('experimental')),
          comparator: yTextToStr(section.get('comparator')),
          numericalResult: yTextToStr(section.get('numericalResult')),
          aim: section.get('aim') ?? null,
          deviationsToAddress: section.get('deviationsToAddress') ?? [],
          sources: section.get('sources') ?? {},
        };
      } else {
        const sectionData: Record<string, unknown> = {};
        for (const [fieldKey, fieldValue] of section.entries()) {
          sectionData[fieldKey] = isYText(fieldValue) ? fieldValue.toString() : fieldValue;
        }
        answers[key] = sectionData;
      }
    } else {
      const s = sectionYMap as { toJSON?: () => unknown };
      answers[key] = s.toJSON ? s.toJSON() : sectionYMap;
    }
  }

  return answers;
}
