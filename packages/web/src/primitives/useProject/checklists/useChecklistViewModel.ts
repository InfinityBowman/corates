/**
 * Derives the view-model a checklist editor needs from the project Y.Doc:
 * the study/checklist records, the flat answer object UI components consume,
 * the checklist type, and the current score. Shared by both the collab view
 * (`ChecklistYjsWrapper`) and the local-practice view (`LocalChecklistView`).
 */

import { useMemo } from 'react';
import { useProjectStore, selectStudies } from '@/stores/projectStore';
import type { StudyInfo, ChecklistEntry } from '@/stores/projectStore';
import { getChecklistTypeFromState, scoreChecklistOfType } from '@/checklist-registry/index';
import { useChecklistAnswers } from './useChecklistAnswers';

export interface ChecklistViewModel {
  currentStudy: StudyInfo | null;
  currentChecklist: ChecklistEntry | null;
  checklistForUI: Record<string, unknown> | null;
  checklistType: string | null;
  currentScore: string | null;
}

export function useChecklistViewModel(
  projectId: string,
  studyId: string,
  checklistId: string,
): ChecklistViewModel {
  const studies = useProjectStore(s => selectStudies(s, projectId));

  const currentStudy = useMemo(
    () => studies.find(st => st.id === studyId) ?? null,
    [studies, studyId],
  );

  const currentChecklist = useMemo(
    () => (currentStudy?.checklists ?? []).find(c => c.id === checklistId) ?? null,
    [currentStudy, checklistId],
  );

  const answers = useChecklistAnswers(projectId, studyId, checklistId);

  const checklistForUI = useMemo(() => {
    if (!currentChecklist || !answers) return null;
    return {
      id: currentChecklist.id,
      name: currentStudy?.name ?? 'Checklist',
      reviewerName: '',
      createdAt: currentChecklist.createdAt as number | undefined,
      ...answers,
    };
  }, [currentChecklist, currentStudy?.name, answers]);

  const checklistType = useMemo(() => {
    if (currentChecklist?.type) return currentChecklist.type;
    if (checklistForUI) return getChecklistTypeFromState(checklistForUI);
    return null;
  }, [currentChecklist, checklistForUI]);

  const currentScore = useMemo(() => {
    if (!checklistForUI || !checklistType) return null;
    return scoreChecklistOfType(checklistType, checklistForUI);
  }, [checklistForUI, checklistType]);

  return { currentStudy, currentChecklist, checklistForUI, checklistType, currentScore };
}
