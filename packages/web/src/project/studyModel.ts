/**
 * The derived `StudyInfo[]` model for a project, built once per collection set
 * and shared by every `useAllStudies` caller. A live query per hook instance
 * would materialise its own copy of the answers table (see issue #751).
 */

import { deriveFinalized, type PdfRow } from '@corates/shared/sync';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import type { AppraisalEntry, ChecklistEntry, PdfEntry, StudyInfo } from '@/stores/projectStore';
import type { ProjectCollections } from './localCollections';

function toPdfEntry(row: PdfRow): PdfEntry {
  return {
    id: row.id,
    fileName: row.fileName,
    key: row.key,
    size: row.size,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt,
    tag: row.tag,
    title: row.title ?? null,
    firstAuthor: row.firstAuthor ?? null,
    publicationYear: row.publicationYear ?? null,
    journal: row.journal ?? null,
    doi: row.doi ?? null,
  };
}

/**
 * All studies with nested checklists and pdfs. Finalized checklists carry
 * their score + chart-facing consolidated answers, derived from answer rows.
 */
export function buildStudies(collections: ProjectCollections): StudyInfo[] {
  const finalizedIds = new Set<string>();
  for (const row of collections.checklists.values()) {
    if (row.status === CHECKLIST_STATUS.FINALIZED) finalizedIds.add(row.id);
  }

  const answersByChecklist = new Map<string, Record<string, unknown>>();
  for (const row of collections.answers.values()) {
    if (!finalizedIds.has(row.checklistId)) continue;
    let map = answersByChecklist.get(row.checklistId);
    if (!map) {
      map = {};
      answersByChecklist.set(row.checklistId, map);
    }
    map[row.key] = row.value;
  }

  const checklistsByStudy = new Map<string, ChecklistEntry[]>();
  for (const row of collections.checklists.values()) {
    let entry: ChecklistEntry = {
      id: row.id,
      type: row.type,
      kind: row.kind,
      title: row.title ?? null,
      assignedTo: row.assignedTo,
      outcomeId: row.outcomeId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      score: null,
      answers: null,
      consolidatedAnswers: null,
    };
    if (finalizedIds.has(row.id)) {
      const derived = deriveFinalized(row.type, answersByChecklist.get(row.id) ?? {});
      entry = {
        ...entry,
        score: derived.score,
        consolidatedAnswers: derived.consolidatedAnswers,
      };
    }
    const list = checklistsByStudy.get(row.studyId) ?? [];
    list.push(entry);
    checklistsByStudy.set(row.studyId, list);
  }
  for (const list of checklistsByStudy.values()) {
    list.sort((a, b) => a.createdAt - b.createdAt);
  }

  const appraisalsByStudy = new Map<string, AppraisalEntry[]>();
  for (const row of collections.appraisals.values()) {
    const list = appraisalsByStudy.get(row.studyId) ?? [];
    list.push({ type: row.type, outcomeId: row.outcomeId });
    appraisalsByStudy.set(row.studyId, list);
  }

  const pdfsByStudy = new Map<string, PdfEntry[]>();
  for (const row of collections.pdfs.values()) {
    const list = pdfsByStudy.get(row.studyId) ?? [];
    list.push(toPdfEntry(row));
    pdfsByStudy.set(row.studyId, list);
  }

  const result: StudyInfo[] = Array.from(collections.studies.values(), study => ({
    id: study.id,
    name: study.name ?? '',
    description: study.description ?? '',
    originalTitle: study.originalTitle ?? null,
    firstAuthor: study.firstAuthor ?? null,
    publicationYear: study.publicationYear ?? null,
    authors: study.authors ?? null,
    journal: study.journal ?? null,
    doi: study.doi ?? null,
    abstract: study.abstract ?? null,
    importSource: study.importSource ?? null,
    pdfUrl: study.pdfUrl ?? null,
    pdfSource: study.pdfSource ?? null,
    pdfAccessible: Boolean(study.pdfAccessible),
    pmid: study.pmid ?? null,
    url: study.url ?? null,
    volume: study.volume ?? null,
    issue: study.issue ?? null,
    pages: study.pages ?? null,
    type: study.type ?? null,
    reviewer1: study.reviewer1 ?? null,
    reviewer2: study.reviewer2 ?? null,
    createdAt: study.createdAt,
    updatedAt: study.updatedAt,
    checklists: checklistsByStudy.get(study.id) ?? [],
    appraisals: appraisalsByStudy.get(study.id) ?? [],
    pdfs: pdfsByStudy.get(study.id) ?? [],
  }));
  result.sort((a, b) => a.createdAt - b.createdAt);
  return result;
}

export interface StudyModelStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => StudyInfo[];
}

function createStudyModelStore(collections: ProjectCollections): StudyModelStore {
  const sources = [
    collections.studies,
    collections.checklists,
    collections.appraisals,
    collections.answers,
    collections.pdfs,
  ];
  const listeners = new Set<() => void>();
  let unsubscribeSources: (() => void)[] = [];
  let snapshot: StudyInfo[] | null = null;
  let notifyScheduled = false;

  // One mutation commits to several collections in a row; notify once so the
  // model rebuilds once per mutation rather than once per touched collection.
  const invalidate = () => {
    snapshot = null;
    if (notifyScheduled) return;
    notifyScheduled = true;
    queueMicrotask(() => {
      notifyScheduled = false;
      for (const listener of listeners) listener();
    });
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      if (listeners.size === 1) {
        unsubscribeSources = sources.map(source => {
          const subscription = source.subscribeChanges(invalidate, { includeInitialState: false });
          return () => subscription.unsubscribe();
        });
        // Rows may have changed while nothing was listening.
        snapshot = null;
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size > 0) return;
        for (const unsubscribe of unsubscribeSources) unsubscribe();
        unsubscribeSources = [];
        snapshot = null;
      };
    },
    getSnapshot() {
      snapshot ??= buildStudies(collections);
      return snapshot;
    },
  };
}

const stores = new WeakMap<ProjectCollections, StudyModelStore>();

export function studyModelStore(collections: ProjectCollections): StudyModelStore {
  let store = stores.get(collections);
  if (!store) {
    store = createStudyModelStore(collections);
    stores.set(collections, store);
  }
  return store;
}
