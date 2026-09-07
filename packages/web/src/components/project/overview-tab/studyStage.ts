/**
 * Where each study sits in the two-reviewer workflow, for the Overview
 * progress bar and stage tiles.
 */

import {
  CHECKLIST_STATUS,
  shouldShowInTab,
  getReadyReconciliationPairs,
} from '@corates/shared/checklists';
import type { StudyInfo } from '@/stores/projectStore';

export const STAGES = [
  {
    key: 'unassigned',
    label: 'Unassigned',
    hint: 'Needs reviewers',
    dotClass: 'bg-muted-foreground/40',
    tab: 'all-studies',
  },
  {
    key: 'review',
    label: 'In review',
    hint: 'Waiting on reviewers',
    dotClass: 'bg-info',
    tab: 'all-studies',
  },
  {
    key: 'ready',
    label: 'Ready to reconcile',
    hint: 'Both reviews complete',
    dotClass: 'bg-warning',
    tab: 'reconcile',
  },
  {
    key: 'reconciling',
    label: 'Reconciling',
    hint: 'Reconciliation in progress',
    dotClass: 'bg-warning',
    tab: 'reconcile',
  },
  {
    key: 'final',
    label: 'Finalized',
    hint: 'Included in results',
    dotClass: 'bg-success',
    tab: 'completed',
  },
] as const;

export type StageKey = (typeof STAGES)[number]['key'];

export function getStudyStage(study: StudyInfo): StageKey {
  if (!study.reviewer1 && !study.reviewer2) return 'unassigned';
  if (shouldShowInTab(study, 'completed', null)) return 'final';
  if ((study.checklists || []).some(c => c.status === CHECKLIST_STATUS.RECONCILING)) {
    return 'reconciling';
  }
  if (getReadyReconciliationPairs(study).length > 0) return 'ready';
  return 'review';
}

export function countStages(studies: StudyInfo[]): Record<StageKey, number> {
  const counts: Record<StageKey, number> = {
    unassigned: 0,
    review: 0,
    ready: 0,
    reconciling: 0,
    final: 0,
  };
  for (const study of studies) counts[getStudyStage(study)] += 1;
  return counts;
}
