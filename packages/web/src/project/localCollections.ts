/**
 * Local-only TanStack DB collections for local practice, plus the one-time
 * conversion of the legacy Dexie Y.Doc into rows.
 *
 * Local practice has no engine workspace: its rows live in these collections
 * (seeded from the Dexie `localProjects` store, persisted back by the pool)
 * and are mutated by the shared mutator functions applied directly.
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

export interface LocalRows {
  studies: unknown[];
  checklists: unknown[];
  answers: unknown[];
  /** Absent in rows persisted before local reconciliation was supported. */
  outcomes?: unknown[];
  reconciliations?: unknown[];
}

/** One-time conversion of a legacy local-practice Y.Doc into plain rows. */
export function rowsFromLocalDoc(ydoc: Y.Doc): LocalRows {
  const reviews = ydoc.getMap('reviews');
  {
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

    return {
      studies: [...studies.values()],
      checklists: [...checklists.values()],
      answers: [...answers.values()],
    };
  }
}

/** Seed freshly created collections from persisted rows. */
export function seedLocalCollections(collections: ProjectCollections, rows: LocalRows): void {
  for (const row of rows.studies) collections.studies.insert(row as StudyRow);
  for (const row of rows.checklists) collections.checklists.insert(row as ChecklistRow);
  for (const row of rows.answers) collections.answers.insert(row as AnswerRow);
  for (const row of rows.outcomes ?? []) collections.outcomes.insert(row as OutcomeRow);
  for (const row of rows.reconciliations ?? [])
    collections.reconciliations.insert(row as ReconciliationRow);
}

/** The current rows, for persistence. */
export function snapshotLocalCollections(collections: ProjectCollections): LocalRows {
  return {
    studies: [...collections.studies.toArray],
    checklists: [...collections.checklists.toArray],
    answers: [...collections.answers.toArray],
    outcomes: [...collections.outcomes.toArray],
    reconciliations: [...collections.reconciliations.toArray],
  };
}
