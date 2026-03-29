/**
 * Common checklist operations shared across all checklist types
 */

import * as Y from 'yjs';

export interface ChecklistYMapResult {
  checklistYMap: Y.Map<unknown>;
  checklistType: string;
}

export interface CommonOperations {
  updateChecklist: (studyId: string, checklistId: string, updates: Record<string, unknown>) => void;
  deleteChecklist: (studyId: string, checklistId: string) => void;
  getChecklistAnswersMap: (studyId: string, checklistId: string) => Y.Map<unknown> | null;
  getChecklistYMap: (studyId: string, checklistId: string) => ChecklistYMapResult | null;
}

export function createCommonOperations(getYDoc: () => Y.Doc | null): CommonOperations {
  function updateChecklist(
    studyId: string,
    checklistId: string,
    updates: Record<string, unknown>,
  ): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
    if (!checklistsMap) return;

    const checklistYMap = checklistsMap.get(checklistId) as Y.Map<unknown> | undefined;
    if (!checklistYMap) return;

    if (updates.title !== undefined) checklistYMap.set('title', updates.title);
    if (updates.assignedTo !== undefined) checklistYMap.set('assignedTo', updates.assignedTo);
    if (updates.status !== undefined) checklistYMap.set('status', updates.status);
    checklistYMap.set('updatedAt', Date.now());
  }

  function deleteChecklist(studyId: string, checklistId: string): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return;

    const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
    if (!checklistsMap) return;

    checklistsMap.delete(checklistId);
    studyYMap.set('updatedAt', Date.now());
  }

  function getChecklistAnswersMap(studyId: string, checklistId: string): Y.Map<unknown> | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId) as Y.Map<unknown> | undefined;
    if (!checklistYMap) return null;

    return (checklistYMap.get('answers') as Y.Map<unknown>) || null;
  }

  function getChecklistYMap(studyId: string, checklistId: string): ChecklistYMapResult | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return null;

    const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
    if (!checklistsMap) return null;

    const checklistYMap = checklistsMap.get(checklistId) as Y.Map<unknown> | undefined;
    if (!checklistYMap) return null;

    const checklistType = checklistYMap.get('type') as string;
    return { checklistYMap, checklistType };
  }

  return {
    updateChecklist,
    deleteChecklist,
    getChecklistAnswersMap,
    getChecklistYMap,
  };
}
