/**
 * One-time container migration for project docs.
 *
 * Client code used to create shared container Y.Maps (a study's annotations,
 * pdfs, reconciliations, and per-checklist annotation sub-maps, plus
 * meta.outcomes) lazily on first write. Two clients making their first write
 * concurrently each created their own container; Yjs keeps one and silently
 * discards everything inside the other. New docs pre-create the containers at
 * study/checklist creation; this migration backfills them for existing docs.
 *
 * It runs here rather than on clients because every update serializes through
 * this DO: a client-side backfill would itself race, two migrating clients
 * being exactly the collision it is meant to prevent.
 */

import * as Y from 'yjs';

const STUDY_CONTAINER_KEYS = ['checklists', 'annotations', 'pdfs', 'reconciliations'] as const;

function studyNeedsContainers(studyYMap: Y.Map<unknown>): boolean {
  for (const key of STUDY_CONTAINER_KEYS) {
    if (!(studyYMap.get(key) instanceof Y.Map)) return true;
  }
  const checklists = studyYMap.get('checklists') as Y.Map<unknown>;
  const annotations = studyYMap.get('annotations') as Y.Map<unknown>;
  for (const checklistId of checklists.keys()) {
    if (!annotations.has(checklistId)) return true;
  }
  return false;
}

function docNeedsContainers(doc: Y.Doc): boolean {
  if (!(doc.getMap('meta').get('outcomes') instanceof Y.Map)) return true;
  for (const study of doc.getMap('reviews').values()) {
    if (study instanceof Y.Map && studyNeedsContainers(study)) return true;
  }
  return false;
}

/**
 * Backfills missing containers in a single transaction. Idempotent; checks
 * before mutating so an already-migrated doc generates no update at all.
 * Returns whether anything was written.
 */
export function ensureDocContainers(doc: Y.Doc): boolean {
  if (!docNeedsContainers(doc)) return false;

  doc.transact(() => {
    const metaMap = doc.getMap('meta');
    if (!(metaMap.get('outcomes') instanceof Y.Map)) {
      metaMap.set('outcomes', new Y.Map());
    }

    for (const study of doc.getMap('reviews').values()) {
      if (!(study instanceof Y.Map)) continue;
      for (const key of STUDY_CONTAINER_KEYS) {
        if (!(study.get(key) instanceof Y.Map)) {
          study.set(key, new Y.Map());
        }
      }
      const checklists = study.get('checklists') as Y.Map<unknown>;
      const annotations = study.get('annotations') as Y.Map<unknown>;
      for (const checklistId of checklists.keys()) {
        if (!annotations.has(checklistId)) {
          annotations.set(checklistId, new Y.Map());
        }
      }
    }
  }, 'ensure-containers');

  return true;
}
