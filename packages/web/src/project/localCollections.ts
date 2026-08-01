/**
 * Local-only TanStack DB collections + the Y.Doc → rows bridge.
 *
 * Local practice has no engine workspace: its data is a Dexie-persisted Y.Doc.
 * To give it the same read surface as online projects (the workspace-data
 * hooks), the pool creates one local-only collection per table and mirrors the
 * doc into rows on every change — the reactor's job, re-expressed into
 * TanStack DB. Writes still go to the Y.Doc (legacy ops) and flow back through
 * this bridge, so local mode stays fully coherent.
 *
 * Also exports `emptyCollections`: a frozen, never-written set used as the
 * fallback when a project has no session (e.g. sidebar rows for unopened
 * projects), so hooks can query unconditionally.
 */

import * as Y from 'yjs';
import { createCollection, localOnlyCollectionOptions, type Collection } from '@tanstack/db';
import {
  answerRowId,
  type AnnotationRow,
  type AnswerRow,
  type ChecklistRow,
  type OutcomeRow,
  type PdfRow,
  type ReconciliationRow,
  type StudyRow,
} from '@corates/shared/sync';

/** The uniform per-project collection set the read hooks consume. */
export interface ProjectCollections {
  studies: Collection<StudyRow>;
  checklists: Collection<ChecklistRow>;
  answers: Collection<AnswerRow>;
  annotations: Collection<AnnotationRow>;
  outcomes: Collection<OutcomeRow>;
  pdfs: Collection<PdfRow>;
  reconciliations: Collection<ReconciliationRow>;
}

function localSet(idPrefix: string): ProjectCollections {
  const make = <T extends { id: string }>(table: string) =>
    createCollection(
      localOnlyCollectionOptions({
        id: `${idPrefix}-${table}`,
        getKey: (row: T) => row.id,
      }),
    ) as unknown as Collection<T>;
  return {
    studies: make<StudyRow>('studies'),
    checklists: make<ChecklistRow>('checklists'),
    answers: make<AnswerRow>('answers'),
    annotations: make<AnnotationRow>('annotations'),
    outcomes: make<OutcomeRow>('outcomes'),
    pdfs: make<PdfRow>('pdfs'),
    reconciliations: make<ReconciliationRow>('reconciliations'),
  };
}

export function createLocalCollections(projectId: string): ProjectCollections {
  return localSet(`local-${projectId}-${Date.now()}`);
}

export const emptyCollections: ProjectCollections = localSet('empty-fallback');

function plainValue(value: unknown): unknown {
  if (value instanceof Y.Text) return value.toString();
  if (value instanceof Y.AbstractType) {
    return (value as unknown as { toJSON: () => unknown }).toJSON();
  }
  return value;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * Mirror the local Y.Doc's `reviews` tree into the collections; returns an
 * unsubscribe. Rebuild-on-change is fine at local-practice scale.
 */
export function bridgeLocalDoc(ydoc: Y.Doc, collections: ProjectCollections): () => void {
  const reviews = ydoc.getMap('reviews');

  const rebuild = () => {
    const studies = new Map<string, StudyRow>();
    const checklists = new Map<string, ChecklistRow>();
    const answers = new Map<string, AnswerRow>();

    for (const [studyId, studyValue] of reviews.entries()) {
      const study = studyValue as Y.Map<unknown>;
      if (!(study instanceof Y.Map)) continue;
      studies.set(studyId, {
        id: studyId,
        name: asString(study.get('name')),
        description: asString(study.get('description')),
        createdAt: asNumber(study.get('createdAt')),
        updatedAt: asNumber(study.get('updatedAt')),
      } as StudyRow);

      const checklistsMap = study.get('checklists');
      if (!(checklistsMap instanceof Y.Map)) continue;
      for (const [checklistId, checklistValue] of checklistsMap.entries()) {
        const checklist = checklistValue as Y.Map<unknown>;
        if (!(checklist instanceof Y.Map)) continue;
        const type = asString(checklist.get('type'), 'AMSTAR2') as ChecklistRow['type'];
        checklists.set(checklistId, {
          id: checklistId,
          studyId,
          type,
          title: asString(checklist.get('title')),
          assignedTo: (checklist.get('assignedTo') as string | null) ?? null,
          status: (asString(checklist.get('status'), 'pending') as ChecklistRow['status']) ?? 'pending',
          outcomeId: (checklist.get('outcomeId') as string | null) ?? null,
          createdAt: asNumber(checklist.get('createdAt')),
          updatedAt: asNumber(checklist.get('updatedAt')),
        });

        const answersMap = checklist.get('answers');
        if (!(answersMap instanceof Y.Map)) continue;
        for (const [flatKey, rawValue] of answersMap.entries()) {
          const id = answerRowId(checklistId, flatKey);
          answers.set(id, {
            id,
            studyId,
            checklistId,
            key: flatKey,
            value: plainValue(rawValue) as AnswerRow['value'],
          });
        }
      }
    }

    applyRows(collections.studies, studies);
    applyRows(collections.checklists, checklists);
    applyRows(collections.answers, answers);
  };

  const onChange = () => rebuild();
  reviews.observeDeep(onChange);
  rebuild();
  return () => reviews.unobserveDeep(onChange);
}

function applyRows<T extends { id: string }>(collection: Collection<T>, next: Map<string, T>): void {
  for (const row of collection.toArray) {
    if (!next.has(row.id)) collection.delete(row.id);
  }
  for (const [id, row] of next) {
    const existing = collection.get(id);
    if (!existing) {
      collection.insert(row);
    } else if (JSON.stringify(existing) !== JSON.stringify(row)) {
      collection.delete(id);
      collection.insert(row);
    }
  }
}
