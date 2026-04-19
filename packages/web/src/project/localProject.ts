/**
 * Local-only "practice" project.
 *
 * Before: local appraisals lived in the `localChecklists` Dexie table as flat
 * JSON blobs, with a separate Zustand store and view.
 *
 * Now: they live in a single project-shaped Y.Doc (acquired via ConnectionPool
 * like any other project, minus the WebSocket provider). Each appraisal is a
 * study with one checklist inside. Study/checklist IDs preserve the old local
 * IDs so existing URLs (`/checklist/:id`) keep working.
 */

import * as Y from 'yjs';
import { createChecklistOfType, CHECKLIST_TYPES } from '@/checklist-registry';
import { CHECKLIST_STATUS } from '@/constants/checklist-status';
import { AMSTAR2Handler } from '@/primitives/useProject/checklists/handlers/amstar2';
import { ROBINSIHandler } from '@/primitives/useProject/checklists/handlers/robins-i';
import { ROB2Handler } from '@/primitives/useProject/checklists/handlers/rob2';
import type { ChecklistHandler } from '@/primitives/useProject/checklists/handlers/base';
import { db } from '@/primitives/db';

export const LOCAL_PROJECT_ID = 'local-practice';
// Set once in the Y.Doc's meta map after the first successful import from the
// legacy `localChecklists` Dexie table. The migration itself is idempotent
// (seedIfEmpty never overwrites), so re-runs are harmless — the flag is just
// an optimization to skip the Dexie read on subsequent loads.
const MIGRATION_FLAG = 'localMigrated';

const HANDLERS: Record<string, ChecklistHandler> = {
  [CHECKLIST_TYPES.AMSTAR2]: new AMSTAR2Handler(),
  [CHECKLIST_TYPES.ROBINS_I]: new ROBINSIHandler(),
  [CHECKLIST_TYPES.ROB2]: new ROB2Handler(),
};

export interface LocalChecklistRow {
  id: string;
  name?: string;
  checklistType?: string;
  type?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

/**
 * Copies every row in the `localChecklists` Dexie table into the given Y.Doc.
 * Idempotent: gated by a flag stored inside the Y.Doc itself, so it runs once
 * per device per schema version regardless of whether localStorage is cleared.
 *
 * Safe to call from the Dexie `whenLoaded` callback — the Y.Doc's persisted
 * state has already been applied at that point, so the flag reflects previous
 * runs.
 *
 * Leaves the source rows in place for one release as rollback insurance.
 */
export function migrateLocalChecklistsToYDoc(ydoc: Y.Doc): Promise<void> {
  const meta = ydoc.getMap('meta');
  if (meta.get(MIGRATION_FLAG)) return Promise.resolve();

  return (async () => {
    const rows = (await db.localChecklists.toArray()) as unknown as LocalChecklistRow[];

    ydoc.transact(() => {
      const reviews = ydoc.getMap('reviews');
      for (const row of rows) {
        if (!row.id) continue;
        const existing = reviews.get(row.id) as Y.Map<unknown> | undefined;
        if (existing) {
          // A prior version already migrated this row. Seed text into the
          // existing structure; seedTextFields only writes where the Y.Text
          // is still empty, so any user edits made since are preserved.
          const answersYMap = resolveExistingAnswersMap(existing, row.id);
          const type =
            resolveExistingChecklistType(existing, row.id) ||
            (row.checklistType as string | undefined) ||
            (row.type as string | undefined) ||
            CHECKLIST_TYPES.AMSTAR2;
          if (answersYMap) seedTextFieldsIntoAnswersYMap(answersYMap, type, row);
        } else {
          const studyYMap = buildStudyForLocalRow(row);
          if (studyYMap) attachAndSeedStudy(reviews, studyYMap, row);
        }
      }
      meta.set(MIGRATION_FLAG, true);
    });
  })();
}

function resolveExistingAnswersMap(
  studyYMap: Y.Map<unknown>,
  checklistId: string,
): Y.Map<unknown> | null {
  const checklistsMap = studyYMap.get('checklists');
  if (!(checklistsMap instanceof Y.Map)) return null;
  const checklistYMap = checklistsMap.get(checklistId);
  if (!(checklistYMap instanceof Y.Map)) return null;
  const answersYMap = checklistYMap.get('answers');
  return answersYMap instanceof Y.Map ? answersYMap : null;
}

function resolveExistingChecklistType(
  studyYMap: Y.Map<unknown>,
  checklistId: string,
): string | null {
  const checklistsMap = studyYMap.get('checklists');
  if (!(checklistsMap instanceof Y.Map)) return null;
  const checklistYMap = checklistsMap.get(checklistId);
  if (!(checklistYMap instanceof Y.Map)) return null;
  return (checklistYMap.get('type') as string) || null;
}

/**
 * Create a new local appraisal inside the local project Y.Doc. Study and
 * checklist share a single id so the existing `/checklist/:id` URL can serve
 * as both studyId and checklistId.
 */
export function createLocalAppraisal(
  ydoc: Y.Doc,
  opts: { name: string; type: string },
): string | null {
  const id = crypto.randomUUID();
  const now = Date.now();
  const template = createChecklistOfType(opts.type, {
    id,
    name: opts.name,
    createdAt: now,
  }) as Record<string, unknown>;
  const row: LocalChecklistRow = {
    ...template,
    id,
    name: opts.name,
    checklistType: opts.type,
    createdAt: now,
    updatedAt: now,
  };
  const studyYMap = buildStudyForLocalRow(row);
  if (!studyYMap) return null;
  ydoc.transact(() => {
    attachAndSeedStudy(ydoc.getMap('reviews'), studyYMap, row);
  });
  return id;
}

export function buildStudyForLocalRow(row: LocalChecklistRow): Y.Map<unknown> | null {
  const type = (row.checklistType || row.type || CHECKLIST_TYPES.AMSTAR2) as string;
  const handler = HANDLERS[type];
  if (!handler) {
    console.warn('[localProject] skipping row with unknown checklist type', row.id, type);
    return null;
  }

  const now = Date.now();
  const createdAt = typeof row.createdAt === 'number' ? row.createdAt : now;
  const updatedAt = typeof row.updatedAt === 'number' ? row.updatedAt : createdAt;
  const name = (row.name as string) || 'Untitled Checklist';

  const studyYMap = new Y.Map<unknown>();
  studyYMap.set('name', name);
  studyYMap.set('description', '');
  studyYMap.set('createdAt', createdAt);
  studyYMap.set('updatedAt', updatedAt);

  const checklistsMap = new Y.Map<unknown>();
  const checklistYMap = new Y.Map<unknown>();
  checklistYMap.set('type', type);
  checklistYMap.set('title', name);
  checklistYMap.set('assignedTo', null);
  checklistYMap.set('status', CHECKLIST_STATUS.PENDING);
  checklistYMap.set('createdAt', createdAt);
  checklistYMap.set('updatedAt', updatedAt);

  // Old rows stored template fields (q1, sectionA, domain1, ...) flat on the
  // row. The handler's extractor picks out just the answer keys.
  const answersData = handler.extractAnswersFromTemplate(row as Record<string, unknown>);
  const answersYMap = handler.createAnswersYMap(answersData);
  checklistYMap.set('answers', answersYMap);

  // Same id at both levels preserves the old /checklist/:id URL.
  checklistsMap.set(row.id, checklistYMap);
  studyYMap.set('checklists', checklistsMap);
  // Note: text seeding happens AFTER the study is attached to a Y.Doc — see
  // `attachAndSeedStudy`. Y.Text can't be mutated while unattached.
  return studyYMap;
}

/**
 * Attach a freshly-built study to the `reviews` map and then seed Y.Text
 * content from the source row. Y.Text mutation requires the map to be
 * attached to a Y.Doc, so callers must use this helper (or replicate its
 * order) instead of seeding before attachment.
 */
export function attachAndSeedStudy(
  reviews: Y.Map<unknown>,
  studyYMap: Y.Map<unknown>,
  row: LocalChecklistRow,
): void {
  reviews.set(row.id, studyYMap);
  const answersYMap = resolveExistingAnswersMap(studyYMap, row.id);
  if (!answersYMap) return;
  const type =
    (row.checklistType as string | undefined) ||
    (row.type as string | undefined) ||
    CHECKLIST_TYPES.AMSTAR2;
  seedTextFieldsIntoAnswersYMap(answersYMap, type, row as Record<string, unknown>);
}

/**
 * Copy string text fields from the legacy flat row into fresh or partially-
 * seeded Y.Text instances inside the given answers map. Only writes into a
 * Y.Text whose current length is 0, so it's safe to call repeatedly and
 * doesn't clobber user edits made after a prior (buggy) migration.
 */
export function seedTextFieldsIntoAnswersYMap(
  answersYMap: Y.Map<unknown>,
  type: string,
  source: Record<string, unknown>,
): void {
  if (type === CHECKLIST_TYPES.AMSTAR2) seedAmstar2(answersYMap, source);
  else if (type === CHECKLIST_TYPES.ROBINS_I) seedRobinsI(answersYMap, source);
  else if (type === CHECKLIST_TYPES.ROB2) seedRob2(answersYMap, source);
}

function seedIfEmpty(map: Y.Map<unknown>, key: string, value: unknown): void {
  if (typeof value !== 'string' || value.length === 0) return;
  const existing = map.get(key);
  if (existing instanceof Y.Text && existing.length === 0) {
    existing.insert(0, value);
  }
}

function seedAmstar2(answersYMap: Y.Map<unknown>, source: Record<string, unknown>): void {
  const notes = source.notes as Record<string, unknown> | undefined;
  if (!notes) return;
  for (const [qKey, questionYMap] of answersYMap.entries()) {
    if (!(questionYMap instanceof Y.Map)) continue;
    seedIfEmpty(questionYMap, 'note', notes[qKey]);
  }
}

function seedRobinsI(answersYMap: Y.Map<unknown>, source: Record<string, unknown>): void {
  const planning = answersYMap.get('planning');
  if (planning instanceof Y.Map) {
    const src = source.planning as Record<string, unknown> | undefined;
    seedIfEmpty(planning, 'confoundingFactors', src?.confoundingFactors);
  }

  const sectionA = answersYMap.get('sectionA');
  if (sectionA instanceof Y.Map) {
    const src = source.sectionA as Record<string, unknown> | undefined;
    seedIfEmpty(sectionA, 'numericalResult', src?.numericalResult);
    seedIfEmpty(sectionA, 'furtherDetails', src?.furtherDetails);
    seedIfEmpty(sectionA, 'outcome', src?.outcome);
  }

  const sectionB = answersYMap.get('sectionB');
  if (sectionB instanceof Y.Map) {
    const src = source.sectionB as Record<string, Record<string, unknown>> | undefined;
    if (src) {
      for (const [subKey, subYMap] of sectionB.entries()) {
        if (!(subYMap instanceof Y.Map)) continue;
        seedIfEmpty(subYMap, 'comment', src[subKey]?.comment);
      }
    }
  }

  const sectionC = answersYMap.get('sectionC');
  if (sectionC instanceof Y.Map) {
    const src = source.sectionC as Record<string, unknown> | undefined;
    seedIfEmpty(sectionC, 'participants', src?.participants);
    seedIfEmpty(sectionC, 'interventionStrategy', src?.interventionStrategy);
    seedIfEmpty(sectionC, 'comparatorStrategy', src?.comparatorStrategy);
  }

  const sectionD = answersYMap.get('sectionD');
  if (sectionD instanceof Y.Map) {
    const src = source.sectionD as Record<string, unknown> | undefined;
    seedIfEmpty(sectionD, 'otherSpecify', src?.otherSpecify);
  }

  for (const [key, sectionYMap] of answersYMap.entries()) {
    if (!key.startsWith('domain')) continue;
    if (!(sectionYMap instanceof Y.Map)) continue;
    const srcDomain = source[key] as Record<string, unknown> | undefined;
    const srcAnswers = srcDomain?.answers as Record<string, Record<string, unknown>> | undefined;
    if (!srcAnswers) continue;
    const answersNested = sectionYMap.get('answers');
    if (!(answersNested instanceof Y.Map)) continue;
    for (const [qKey, qYMap] of answersNested.entries()) {
      if (!(qYMap instanceof Y.Map)) continue;
      seedIfEmpty(qYMap, 'comment', srcAnswers[qKey]?.comment);
    }
  }
}

function seedRob2(answersYMap: Y.Map<unknown>, source: Record<string, unknown>): void {
  const prelim = answersYMap.get('preliminary');
  if (prelim instanceof Y.Map) {
    const src = source.preliminary as Record<string, unknown> | undefined;
    seedIfEmpty(prelim, 'experimental', src?.experimental);
    seedIfEmpty(prelim, 'comparator', src?.comparator);
    seedIfEmpty(prelim, 'numericalResult', src?.numericalResult);
  }

  for (const [key, sectionYMap] of answersYMap.entries()) {
    if (!key.startsWith('domain')) continue;
    if (!(sectionYMap instanceof Y.Map)) continue;
    const srcDomain = source[key] as Record<string, unknown> | undefined;
    const srcAnswers = srcDomain?.answers as Record<string, Record<string, unknown>> | undefined;
    if (!srcAnswers) continue;
    const answersNested = sectionYMap.get('answers');
    if (!(answersNested instanceof Y.Map)) continue;
    for (const [qKey, qYMap] of answersNested.entries()) {
      if (!(qYMap instanceof Y.Map)) continue;
      seedIfEmpty(qYMap, 'comment', srcAnswers[qKey]?.comment);
    }
  }
}
