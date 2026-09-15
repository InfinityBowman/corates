/**
 * Appraisal actions -- add and remove the (study, tool, outcome) cells a study
 * is appraised on. Adding a cell gives every reviewer on the study a checklist
 * for it; removing one takes those checklists with it.
 */

import { hasRecordedAnswers, type ChecklistType } from '@corates/shared/sync';
import { clientLogger } from '@/lib/clientLogger';
import { connectionPool } from '../ConnectionPool';

export interface AppraisalCellRef {
  studyId: string;
  type: string;
  outcomeId: string | null;
}

function requireClient() {
  const client = connectionPool.getActiveClient();
  if (!client) throw new Error('No active project connection');
  return client;
}

function toCells(cells: AppraisalCellRef[]) {
  return cells.map(cell => ({ ...cell, type: cell.type as ChecklistType }));
}

export const appraisalActions = {
  create(cells: AppraisalCellRef[]): void {
    if (cells.length === 0) return;
    const client = requireClient();
    void client.mutate.appraisal.create({ cells: toCells(cells), now: Date.now() });
    clientLogger.info('client.appraisal.created', { count: cells.length });
  },

  /** `force` is required when any cell has answers (see `hasAnswers`). */
  delete(cells: AppraisalCellRef[], force = false): void {
    if (cells.length === 0) return;
    const client = requireClient();
    void client.mutate.appraisal.delete({ cells: toCells(cells), force, now: Date.now() });
    clientLogger.info('client.appraisal.deleted', { count: cells.length, force });
  },

  /**
   * Whether any checklist in the cell holds recorded answers. Mirrors the
   * `appraisal.delete` guard so the UI can confirm before sending `force`.
   */
  hasAnswers(cell: AppraisalCellRef): boolean {
    const projectId = connectionPool.getActiveProjectId();
    const collections = projectId ? connectionPool.getCollections(projectId) : null;
    if (!collections) throw new Error('No active project connection');
    const checklists = collections.checklists.toArray.filter(
      c => c.studyId === cell.studyId && c.type === cell.type && c.outcomeId === cell.outcomeId,
    );
    return checklists.some(checklist =>
      hasRecordedAnswers(
        checklist,
        collections.answers.toArray.filter(row => row.checklistId === checklist.id),
      ),
    );
  },
};
