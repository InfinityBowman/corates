import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import type { ChecklistEntry, StudyInfo } from '@/stores/projectStore';
import type { ExportOptions } from './exportOptions';

export type ExportFilters = Pick<
  ExportOptions,
  'status' | 'outcomeId' | 'tool' | 'reviewerId' | 'consensusOnly'
>;

const cellKey = (cl: ChecklistEntry) => `${cl.type}:${cl.outcomeId ?? ''}`;

// Reviewer copies are never finalized themselves; their cell (study, tool, outcome)
// is finished once its consensus is
function finishedCells(checklists: ChecklistEntry[]): Set<string> {
  return new Set(
    checklists
      .filter(cl => cl.kind === 'consensus' && cl.status === CHECKLIST_STATUS.FINALIZED)
      .map(cellKey),
  );
}

// A single-reviewer study never gets a consensus checklist, so its reviewer
// copy is the only record and must survive "consensus only".
function dropReviewerCopies(checklists: ChecklistEntry[]): ChecklistEntry[] {
  const consensusCells = new Set(checklists.filter(cl => cl.kind === 'consensus').map(cellKey));
  return checklists.filter(cl => cl.kind === 'consensus' || !consensusCells.has(cellKey(cl)));
}

/**
 * Studies with at least one checklist matching the filters, each carrying
 * only the matching checklists so the exporters see exactly what was chosen.
 */
export function filterStudiesForExport(studies: StudyInfo[], filters: ExportFilters): StudyInfo[] {
  return studies.flatMap(study => {
    const finished = finishedCells(study.checklists);
    let checklists = study.checklists.filter(
      cl =>
        (filters.status === 'any' ||
          cl.status === CHECKLIST_STATUS.FINALIZED ||
          finished.has(cellKey(cl))) &&
        (!filters.outcomeId || cl.outcomeId === filters.outcomeId) &&
        (!filters.tool || cl.type === filters.tool) &&
        (!filters.reviewerId || cl.assignedTo === filters.reviewerId),
    );
    if (filters.consensusOnly && !filters.reviewerId) checklists = dropReviewerCopies(checklists);
    return checklists.length > 0 ? [{ ...study, checklists }] : [];
  });
}

/** null means every eligible study. */
export function pickStudies(eligible: StudyInfo[], studyIds: string[] | null): StudyInfo[] {
  if (!studyIds) return eligible;
  const ids = new Set(studyIds);
  return eligible.filter(study => ids.has(study.id));
}

export function countChecklists(studies: StudyInfo[]): number {
  return studies.reduce((n, study) => n + study.checklists.length, 0);
}
