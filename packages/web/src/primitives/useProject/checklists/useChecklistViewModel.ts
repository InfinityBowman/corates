/**
 * Derives the view-model a checklist editor needs from the project store:
 * the study/checklist records and the checklist type. Shared by both the
 * collab view (`ChecklistYjsWrapper`) and the local-practice view
 * (`LocalChecklistView`). Scoring is handled separately via `useChecklistScore`.
 */

import { useMemo } from 'react';
import type { StudyInfo, ChecklistEntry } from '@/stores/projectStore';
import { useStudy } from '@/stores/projectAtoms';

export interface ChecklistViewModel {
  currentStudy: StudyInfo | null;
  currentChecklist: ChecklistEntry | null;
  checklistType: string | null;
}

export function useChecklistViewModel(
  projectId: string,
  studyId: string,
  checklistId: string,
): ChecklistViewModel {
  const currentStudy = useStudy(projectId, studyId) ?? null;

  const currentChecklist = useMemo(
    () => (currentStudy?.checklists ?? []).find(c => c.id === checklistId) ?? null,
    [currentStudy, checklistId],
  );

  const checklistType = currentChecklist?.type ?? null;

  return { currentStudy, currentChecklist, checklistType };
}
