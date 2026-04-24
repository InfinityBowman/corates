/**
 * Reconciliation progress operations for useProject
 *
 * Supports outcome-based reconciliation: each outcome has its own reconciliation progress.
 * For AMSTAR2 (no outcomeId), uses type-prefixed key: "type:AMSTAR2"
 *
 * Note: finalAnswers are stored in a third checklist (reconciled checklist)
 * that both reviewers can edit. This leverages existing checklist infrastructure
 * for automatic Yjs sync. Reconciliation progress only stores metadata references.
 */

import * as Y from 'yjs';
import { getOutcomeKey } from '@corates/shared/checklists';

export interface ReconciliationProgressData {
  checklist1Id: string;
  checklist2Id: string;
  reconciledChecklistId?: string;
  currentPage?: number;
  viewMode?: string;
}

export interface ReconciliationProgress {
  checklist1Id: string;
  checklist2Id: string;
  outcomeId: string | null;
  type: string;
  reconciledChecklistId: string | null;
  currentPage: unknown;
  viewMode: unknown;
  updatedAt: unknown;
}

export interface ReconciliationProgressEntry extends ReconciliationProgress {
  outcomeKey: string;
}

export interface ReconciliationOperations {
  saveReconciliationProgress: (
    studyId: string,
    outcomeId: string | null,
    type: string,
    progressData: ReconciliationProgressData,
  ) => void;
  getReconciliationProgress: (
    studyId: string,
    outcomeId: string | null,
    type: string,
  ) => ReconciliationProgress | null;
  getAllReconciliationProgress: (studyId: string) => ReconciliationProgressEntry[];
  clearReconciliationProgress: (studyId: string, outcomeId: string | null, type: string) => void;
}

export function createReconciliationOperations(
  _projectId: string,
  getYDoc: () => Y.Doc | null,
  _isSynced: () => boolean,
): ReconciliationOperations {
  function saveReconciliationProgress(
    studyId: string,
    outcomeId: string | null,
    type: string,
    progressData: ReconciliationProgressData,
  ): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return;

    let reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<Y.Map<unknown>> | undefined;
    if (!reconciliationsMap) {
      reconciliationsMap = new Y.Map();
      studyYMap.set('reconciliations', reconciliationsMap);
    }

    const outcomeKey = getOutcomeKey(outcomeId, type);

    let outcomeProgressMap = reconciliationsMap.get(outcomeKey) as Y.Map<unknown> | undefined;
    if (!outcomeProgressMap) {
      outcomeProgressMap = new Y.Map();
      reconciliationsMap.set(outcomeKey, outcomeProgressMap);
    }

    outcomeProgressMap.set('checklist1Id', progressData.checklist1Id);
    outcomeProgressMap.set('checklist2Id', progressData.checklist2Id);
    outcomeProgressMap.set('outcomeId', outcomeId);
    outcomeProgressMap.set('type', type);
    if (progressData.reconciledChecklistId) {
      outcomeProgressMap.set('reconciledChecklistId', progressData.reconciledChecklistId);
    }
    if (progressData.currentPage !== undefined) {
      outcomeProgressMap.set('currentPage', progressData.currentPage);
    }
    if (progressData.viewMode !== undefined) {
      outcomeProgressMap.set('viewMode', progressData.viewMode);
    }
    outcomeProgressMap.set('updatedAt', Date.now());

    studyYMap.set('updatedAt', Date.now());
  }

  function getReconciliationProgress(
    studyId: string,
    outcomeId: string | null,
    type: string,
  ): ReconciliationProgress | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return null;

    const reconciliationsMap = studyYMap.get('reconciliations') as
      | Y.Map<Y.Map<unknown>>
      | undefined;
    if (reconciliationsMap) {
      const outcomeKey = getOutcomeKey(outcomeId, type);
      const outcomeProgressMap = reconciliationsMap.get(outcomeKey) as Y.Map<unknown> | undefined;
      if (outcomeProgressMap) {
        const checklist1Id = outcomeProgressMap.get('checklist1Id') as string | undefined;
        const checklist2Id = outcomeProgressMap.get('checklist2Id') as string | undefined;
        if (checklist1Id && checklist2Id) {
          return {
            checklist1Id,
            checklist2Id,
            outcomeId: (outcomeProgressMap.get('outcomeId') as string | null) || null,
            type: (outcomeProgressMap.get('type') as string) || type,
            reconciledChecklistId:
              (outcomeProgressMap.get('reconciledChecklistId') as string | null) || null,
            currentPage: outcomeProgressMap.get('currentPage'),
            viewMode: outcomeProgressMap.get('viewMode'),
            updatedAt: outcomeProgressMap.get('updatedAt'),
          };
        }
      }
    }

    // Fall back to legacy single-progress format for backward compatibility
    const legacyMap = studyYMap.get('reconciliation') as Y.Map<unknown> | undefined;
    if (legacyMap) {
      const checklist1Id = legacyMap.get('checklist1Id') as string | undefined;
      const checklist2Id = legacyMap.get('checklist2Id') as string | undefined;
      if (checklist1Id && checklist2Id) {
        return {
          checklist1Id,
          checklist2Id,
          outcomeId: null,
          type: type || 'AMSTAR2',
          reconciledChecklistId: (legacyMap.get('reconciledChecklistId') as string | null) || null,
          currentPage: legacyMap.get('currentPage'),
          viewMode: legacyMap.get('viewMode'),
          updatedAt: legacyMap.get('updatedAt'),
        };
      }
    }

    return null;
  }

  function getAllReconciliationProgress(studyId: string): ReconciliationProgressEntry[] {
    const ydoc = getYDoc();
    if (!ydoc) return [];

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return [];

    const results: ReconciliationProgressEntry[] = [];

    const reconciliationsMap = studyYMap.get('reconciliations') as
      | Y.Map<Y.Map<unknown>>
      | undefined;
    if (reconciliationsMap) {
      for (const [outcomeKey, progressMap] of reconciliationsMap.entries()) {
        const checklist1Id = progressMap.get('checklist1Id') as string | undefined;
        const checklist2Id = progressMap.get('checklist2Id') as string | undefined;
        if (checklist1Id && checklist2Id) {
          results.push({
            outcomeKey,
            outcomeId: (progressMap.get('outcomeId') as string | null) || null,
            type: (progressMap.get('type') as string) || 'AMSTAR2',
            checklist1Id,
            checklist2Id,
            reconciledChecklistId:
              (progressMap.get('reconciledChecklistId') as string | null) || null,
            currentPage: progressMap.get('currentPage'),
            viewMode: progressMap.get('viewMode'),
            updatedAt: progressMap.get('updatedAt'),
          });
        }
      }
    }

    // Include legacy format if exists and not already covered by new structure
    const legacyMap = studyYMap.get('reconciliation') as Y.Map<unknown> | undefined;
    if (legacyMap) {
      const checklist1Id = legacyMap.get('checklist1Id') as string | undefined;
      const checklist2Id = legacyMap.get('checklist2Id') as string | undefined;
      if (checklist1Id && checklist2Id) {
        const alreadyIncluded = results.some(
          r => r.checklist1Id === checklist1Id && r.checklist2Id === checklist2Id,
        );
        if (!alreadyIncluded) {
          results.push({
            outcomeKey: 'type:AMSTAR2',
            outcomeId: null,
            type: 'AMSTAR2',
            checklist1Id,
            checklist2Id,
            reconciledChecklistId:
              (legacyMap.get('reconciledChecklistId') as string | null) || null,
            currentPage: legacyMap.get('currentPage'),
            viewMode: legacyMap.get('viewMode'),
            updatedAt: legacyMap.get('updatedAt'),
          });
        }
      }
    }

    return results;
  }

  function clearReconciliationProgress(
    studyId: string,
    outcomeId: string | null,
    type: string,
  ): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
    if (!studyYMap) return;

    const reconciliationsMap = studyYMap.get('reconciliations') as
      | Y.Map<Y.Map<unknown>>
      | undefined;
    if (reconciliationsMap) {
      const outcomeKey = getOutcomeKey(outcomeId, type);
      reconciliationsMap.delete(outcomeKey);
    }

    if (!outcomeId || type === 'AMSTAR2') {
      studyYMap.delete('reconciliation');
    }

    studyYMap.set('updatedAt', Date.now());
  }

  return {
    saveReconciliationProgress,
    getReconciliationProgress,
    getAllReconciliationProgress,
    clearReconciliationProgress,
  };
}
