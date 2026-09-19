/**
 * Schema-version history for the project workspace. Each entry turns rows
 * stored under the previous version into rows valid under its own; the engine
 * replays the chain on a workspace's first wake after a deploy.
 */

import type { SchemaMigrationFn } from '@cf-sync/protocol';
import { getOutcomeKey } from '../checklists/index.js';
import { appraisalRowId, reconciliationRowId } from './ids.js';

/**
 * Version 2: `checklists.kind`, the `appraisals` plan table, and the
 * instrument in every outcome key.
 *
 * Under version 1 a null assignee was the only mark of a consensus checklist,
 * so kind derives from it. The plan is backfilled with one row per distinct
 * cell any checklist occupies, so existing work is planned work. Reviewer
 * checklists are deliberately not materialized for already-filled slots:
 * that would put every study's default answer rows into one migration commit,
 * and the To-Do fallback already covers a slot holder with no checklist.
 *
 * Version 1 keyed a reconciliation by outcome alone, so two instruments on
 * one outcome shared a row; those rows move to the instrument-qualified key.
 */
const toVersion2: SchemaMigrationFn = tx => {
  for (const { id, data } of tx.list('reconciliations')) {
    const outcomeKey = getOutcomeKey(data.outcomeId as string | null, data.type as string);
    const nextId = reconciliationRowId(data.studyId as string, outcomeKey);
    if (nextId === id) continue;
    tx.del('reconciliations', id);
    tx.put('reconciliations', nextId, { ...data, id: nextId, outcomeKey });
  }

  for (const { id, data } of tx.list('checklists')) {
    const kind = data.assignedTo == null ? 'consensus' : 'reviewer';
    tx.put('checklists', id, { ...data, kind });

    const studyId = data.studyId as string;
    const type = data.type as string;
    const outcomeId = (data.outcomeId as string | null | undefined) ?? null;
    const outcomeKey = getOutcomeKey(outcomeId, type);
    const appraisalId = appraisalRowId(studyId, outcomeKey);
    if (!tx.get('appraisals', appraisalId)) {
      tx.put('appraisals', appraisalId, {
        id: appraisalId,
        studyId,
        type,
        outcomeId,
        outcomeKey,
        createdAt: data.createdAt,
      });
    }
  }
};

export const syncMigrations: { readonly [toVersion: number]: SchemaMigrationFn | null } = {
  2: toVersion2,
};
