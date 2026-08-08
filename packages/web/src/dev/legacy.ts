/**
 * E2e/dev seam for the legacy local-practice migration path: rewrite the
 * CURRENT local-practice rows into a pre-flat-key-migration Y.Doc in Dexie
 * and delete the row store, so the next load exercises the one-time
 * ydoc→rows converter (`loadLegacyLocalRows`) — the exact path a device
 * with old local data takes at cutover.
 *
 * The nested shapes mirror what production docs looked like before the
 * 2026-05 flat-key migration: per-question Y.Maps for AMSTAR2, section and
 * domain Y.Maps for ROB2, Y.Text for every prose field. Other checklist
 * types are written flat (already-flat docs are the common legacy case and
 * pass through the same converter).
 *
 * Dev-only, loaded behind VITE_DEV_PANEL via `@/dev/expose`.
 */

import * as Y from 'yjs';
import { DexieYProvider } from 'y-dexie';
import { db } from '@/primitives/db';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import { connectionPool } from '@/project/ConnectionPool';
import type {
  AnswerRow,
  ChecklistRow,
  OutcomeRow,
  ReconciliationRow,
  StudyRow,
} from '@corates/shared/sync';

/** Give y-dexie a beat to write the doc's updates before releasing it. */
const PERSIST_SETTLE_MS = 800;

function textOrEmpty(value: unknown): Y.Text {
  return new Y.Text(typeof value === 'string' ? value : '');
}

/** Sub-questions carry answers/critical but never a note (only q9/q11 do). */
const AMSTAR2_SUB_QUESTION = /^(q9|q11)[a-z]$/;

/** Old AMSTAR2 shape: `answers[q1] = Y.Map{answers, critical, note: Y.Text}`. */
function nestedAmstar2(flat: Record<string, unknown>): Y.Map<unknown> {
  const answersMap = new Y.Map<unknown>();
  const grouped: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(flat)) {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) continue;
    const prefix = key.slice(0, dotIndex);
    const field = key.slice(dotIndex + 1);
    (grouped[prefix] ??= {})[field] = value;
  }
  for (const [questionKey, fields] of Object.entries(grouped)) {
    const questionMap = new Y.Map<unknown>();
    if (fields.answers !== undefined) questionMap.set('answers', fields.answers);
    if (fields.critical !== undefined) questionMap.set('critical', fields.critical);
    // Faithful to real old docs: sub-questions never had a note field, and
    // writing one here injected rows the flat plane never produces.
    if (!AMSTAR2_SUB_QUESTION.test(questionKey)) {
      questionMap.set('note', textOrEmpty(fields.note));
    }
    answersMap.set(questionKey, questionMap);
  }
  return answersMap;
}

const ROB2_TEXT_FIELDS = new Set(['experimental', 'comparator', 'numericalResult']);

/** Old ROB2 shape: preliminary/domain/overall Y.Maps, Y.Text prose. */
function nestedRob2(flat: Record<string, unknown>): Y.Map<unknown> {
  const answersMap = new Y.Map<unknown>();

  const preliminary = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(flat)) {
    if (!key.startsWith('preliminary.')) continue;
    const field = key.slice('preliminary.'.length);
    preliminary.set(field, ROB2_TEXT_FIELDS.has(field) ? textOrEmpty(value) : value);
  }
  answersMap.set('preliminary', preliminary);

  const domainAnswers: Record<string, Record<string, Record<string, unknown>>> = {};
  const domainMeta: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (key.startsWith('preliminary.') || key.startsWith('overall.')) continue;
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) {
      const match = key.match(/^d(\d+[a-z]?)_/);
      if (match) {
        ((domainAnswers[`domain${match[1]}`] ??= {})[key] ??= {}).answer = value;
      }
    } else {
      const prefix = key.slice(0, dotIndex);
      const field = key.slice(dotIndex + 1);
      if (prefix.startsWith('domain')) {
        (domainMeta[prefix] ??= {})[field] = value;
      } else {
        const match = prefix.match(/^d(\d+[a-z]?)_/);
        if (match) {
          ((domainAnswers[`domain${match[1]}`] ??= {})[prefix] ??= {})[field] = value;
        }
      }
    }
  }
  const allDomains = new Set([...Object.keys(domainAnswers), ...Object.keys(domainMeta)]);
  for (const domain of allDomains) {
    const domainMap = new Y.Map<unknown>();
    const meta = domainMeta[domain] ?? {};
    if (meta.direction !== undefined) domainMap.set('direction', meta.direction);
    const nested = new Y.Map<unknown>();
    for (const [questionKey, question] of Object.entries(domainAnswers[domain] ?? {})) {
      const questionMap = new Y.Map<unknown>();
      if (question.answer !== undefined) questionMap.set('answer', question.answer);
      questionMap.set('comment', textOrEmpty(question.comment));
      nested.set(questionKey, questionMap);
    }
    domainMap.set('answers', nested);
    answersMap.set(domain, domainMap);
  }

  if (flat['overall.direction'] !== undefined) {
    const overall = new Y.Map<unknown>();
    overall.set('direction', flat['overall.direction']);
    answersMap.set('overall', overall);
  }
  return answersMap;
}

function flatPassthrough(flat: Record<string, unknown>): Y.Map<unknown> {
  const answersMap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(flat)) answersMap.set(key, value);
  return answersMap;
}

function nestedAnswersFor(type: string, flat: Record<string, unknown>): Y.Map<unknown> {
  if (type === 'AMSTAR2') return nestedAmstar2(flat);
  if (type === 'ROB2') return nestedRob2(flat);
  return flatPassthrough(flat);
}

/**
 * Convert today's local-practice rows into a legacy nested Y.Doc and remove
 * the row store — the next load runs the one-time converter.
 */
export async function rewriteLocalRowsToLegacyDoc(): Promise<void> {
  await connectionPool.flushLocalPersist();
  const stored = await db.localProjects.get(LOCAL_PROJECT_ID);
  if (!stored) throw new Error('rewriteLocalRowsToLegacyDoc: no local-practice rows');
  const studies = stored.rows.studies as StudyRow[];
  const checklists = stored.rows.checklists as ChecklistRow[];
  const answers = stored.rows.answers as AnswerRow[];
  const outcomes = (stored.rows.outcomes ?? []) as OutcomeRow[];
  const reconciliations = (stored.rows.reconciliations ?? []) as ReconciliationRow[];

  let row = await db.projects.get(LOCAL_PROJECT_ID);
  if (!row) {
    // y-dexie only accepts a Y.Doc column on add(), never put()/update().
    await db.projects.add({
      id: LOCAL_PROJECT_ID,
      orgId: 'local',
      updatedAt: Date.now(),
      ydoc: new Y.Doc(),
    });
    row = await db.projects.get(LOCAL_PROJECT_ID);
  }
  const ydoc = row!.ydoc;
  const provider = DexieYProvider.load(ydoc);
  try {
    await provider.whenLoaded;
    ydoc.transact(() => {
      const reviews = ydoc.getMap('reviews');
      for (const key of [...reviews.keys()]) reviews.delete(key);
      for (const study of studies) {
        const studyMap = new Y.Map<unknown>();
        studyMap.set('name', study.name);
        studyMap.set('description', study.description ?? '');
        studyMap.set('createdAt', study.createdAt);
        studyMap.set('updatedAt', study.updatedAt);
        const checklistsMap = new Y.Map<unknown>();
        for (const checklist of checklists.filter(c => c.studyId === study.id)) {
          const checklistMap = new Y.Map<unknown>();
          checklistMap.set('type', checklist.type);
          checklistMap.set('title', checklist.title);
          checklistMap.set('assignedTo', checklist.assignedTo);
          checklistMap.set('status', checklist.status);
          checklistMap.set('outcomeId', checklist.outcomeId ?? null);
          checklistMap.set('createdAt', checklist.createdAt);
          checklistMap.set('updatedAt', checklist.updatedAt);
          const flat: Record<string, unknown> = {};
          for (const answer of answers.filter(a => a.checklistId === checklist.id)) {
            flat[answer.key] = answer.value;
          }
          checklistMap.set('answers', nestedAnswersFor(checklist.type, flat));
          checklistsMap.set(checklist.id, checklistMap);
        }
        studyMap.set('checklists', checklistsMap);

        const studyReconciliations = reconciliations.filter(r => r.studyId === study.id);
        if (studyReconciliations.length > 0) {
          const reconciliationsMap = new Y.Map<unknown>();
          for (const progress of studyReconciliations) {
            const progressMap = new Y.Map<unknown>();
            progressMap.set('checklist1Id', progress.checklist1Id);
            progressMap.set('checklist2Id', progress.checklist2Id);
            if (progress.reconciledChecklistId) {
              progressMap.set('reconciledChecklistId', progress.reconciledChecklistId);
            }
            progressMap.set('type', progress.type);
            progressMap.set('outcomeId', progress.outcomeId ?? null);
            if (progress.currentPage != null) progressMap.set('currentPage', progress.currentPage);
            if (progress.viewMode) progressMap.set('viewMode', progress.viewMode);
            progressMap.set('updatedAt', progress.updatedAt);
            reconciliationsMap.set(progress.outcomeKey, progressMap);
          }
          studyMap.set('reconciliations', reconciliationsMap);
        }

        reviews.set(study.id, studyMap);
      }

      const meta = ydoc.getMap('meta');
      if (outcomes.length > 0) {
        const outcomesMap = new Y.Map<unknown>();
        for (const outcome of outcomes) {
          const outcomeMap = new Y.Map<unknown>();
          outcomeMap.set('name', outcome.name);
          outcomeMap.set('createdAt', outcome.createdAt);
          outcomeMap.set('createdBy', outcome.createdBy);
          outcomesMap.set(outcome.id, outcomeMap);
        }
        meta.set('outcomes', outcomesMap);
      }
      // Skip the (even older) localChecklists seeding pass on reload.
      meta.set('localMigrated', true);
    });
    await new Promise(resolve => setTimeout(resolve, PERSIST_SETTLE_MS));
  } finally {
    DexieYProvider.release(ydoc);
  }
  // Drop the live entry first: pagehide's flushLocalPersist would otherwise
  // re-persist the row store from the still-mounted collections before the
  // reload, and the converter this seam exists to exercise would never run.
  connectionPool.discardLocalEntry(LOCAL_PROJECT_ID);
  await db.localProjects.delete(LOCAL_PROJECT_ID);
}
