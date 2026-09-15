import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import type { AppraisalCell } from '@corates/shared/checklists';

export type CellState = 'waiting' | 'not-started' | 'in-progress' | 'reconciling' | 'complete';

export const CELL_STATE_LABEL: Record<CellState, string> = {
  waiting: 'Waiting for reviewers',
  'not-started': 'Not started',
  'in-progress': 'In progress',
  reconciling: 'Reconciling',
  complete: 'Complete',
};

/** How far one appraisal cell has got, rolled up across its reviewers' checklists. */
export function cellState(cell: AppraisalCell, hasReviewers: boolean): CellState {
  if (cell.checklists.length === 0) return hasReviewers ? 'not-started' : 'waiting';
  const statuses = cell.checklists.map(c => c.status);
  if (statuses.includes(CHECKLIST_STATUS.FINALIZED)) return 'complete';
  if (statuses.includes(CHECKLIST_STATUS.RECONCILING)) return 'reconciling';
  if (statuses.every(s => s === CHECKLIST_STATUS.PENDING)) return 'not-started';
  return 'in-progress';
}
