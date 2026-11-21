import { CHECKLIST_STATUS, isReconciledChecklist } from '@corates/shared/checklists';
import type { StudyInfo } from '@/stores/projectStore';

export interface MemberProgress {
  completed: number;
  total: number;
}

/**
 * Each reviewer's own appraisals on the studies they currently review. A
 * reviewer holds one checklist per planned cell, so a study with three
 * outcomes counts as three appraisals.
 */
export function countMemberProgress(studies: StudyInfo[]): Map<string, MemberProgress> {
  const map = new Map<string, MemberProgress>();
  for (const study of studies) {
    const reviewers = new Set([study.reviewer1, study.reviewer2]);
    for (const checklist of study.checklists || []) {
      const userId = checklist.assignedTo;
      if (!userId || !reviewers.has(userId) || isReconciledChecklist(checklist)) continue;
      const entry = map.get(userId) ?? { completed: 0, total: 0 };
      entry.total += 1;
      if (
        checklist.status === CHECKLIST_STATUS.FINALIZED ||
        checklist.status === CHECKLIST_STATUS.REVIEWER_COMPLETED
      ) {
        entry.completed += 1;
      }
      map.set(userId, entry);
    }
  }
  return map;
}
