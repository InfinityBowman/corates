/**
 * Reconciliation progress operations for useProject
 *
 * Supports outcome-based reconciliation: each outcome has its own reconciliation progress.
 * For AMSTAR2 (no outcomeId), uses type-prefixed key: "type:AMSTAR2"
 *
 * Note: finalAnswers are stored in a third checklist (reconciled checklist)
 * that both reviewers can edit. This leverages existing checklist infrastructure
 * for automatic Yjs sync. Reconciliation progress only stores metadata references.
 *
 * Storage format: progress fields are flat `${outcomeKey}.${field}` keys on the
 * study's `reconciliations` Y.Map, not a nested Y.Map per outcome. Two clients
 * saving progress for the same outcome concurrently would race to create the
 * nested map and Yjs would silently discard the loser's entries; flat keys
 * merge per-field. Reads still fall back to two older formats: the nested
 * per-outcome Y.Map, and the single `reconciliation` map that predates
 * outcome-based reconciliation.
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
  currentPage: number;
  viewMode: string;
  updatedAt: number;
}

export interface ReconciliationProgressEntry extends ReconciliationProgress {
  outcomeKey: string;
}

const RECONCILIATION_FIELDS = [
  'checklist1Id',
  'checklist2Id',
  'outcomeId',
  'type',
  'reconciledChecklistId',
  'currentPage',
  'viewMode',
  'updatedAt',
] as const;

function readFlatEntry(
  reconciliationsMap: Y.Map<unknown>,
  outcomeKey: string,
  typeFallback: string,
): ReconciliationProgress | null {
  const get = (field: string) => reconciliationsMap.get(`${outcomeKey}.${field}`);
  const checklist1Id = get('checklist1Id') as string | undefined;
  const checklist2Id = get('checklist2Id') as string | undefined;
  if (!checklist1Id || !checklist2Id) return null;
  return {
    checklist1Id,
    checklist2Id,
    outcomeId: (get('outcomeId') as string | null) || null,
    type: (get('type') as string) || typeFallback,
    reconciledChecklistId: (get('reconciledChecklistId') as string | null) || null,
    currentPage: (get('currentPage') as number) || 0,
    viewMode: (get('viewMode') as string) || 'questions',
    updatedAt: (get('updatedAt') as number) || 0,
  };
}

function readNestedEntry(nested: unknown, typeFallback: string): ReconciliationProgress | null {
  if (!(nested instanceof Y.Map)) return null;
  const checklist1Id = nested.get('checklist1Id') as string | undefined;
  const checklist2Id = nested.get('checklist2Id') as string | undefined;
  if (!checklist1Id || !checklist2Id) return null;
  return {
    checklist1Id,
    checklist2Id,
    outcomeId: (nested.get('outcomeId') as string | null) || null,
    type: (nested.get('type') as string) || typeFallback,
    reconciledChecklistId: (nested.get('reconciledChecklistId') as string | null) || null,
    currentPage: (nested.get('currentPage') as number) || 0,
    viewMode: (nested.get('viewMode') as string) || 'questions',
    updatedAt: (nested.get('updatedAt') as number) || 0,
  };
}

/**
 * Reads one outcome's progress, preferring whichever format was written more
 * recently so a client running older code (nested writes) is not shadowed by a
 * stale flat entry during deploy skew or offline catch-up.
 */
export function readReconciliationEntry(
  reconciliationsMap: Y.Map<unknown>,
  outcomeKey: string,
  typeFallback: string,
): ReconciliationProgress | null {
  const flat = readFlatEntry(reconciliationsMap, outcomeKey, typeFallback);
  const nested = readNestedEntry(reconciliationsMap.get(outcomeKey), typeFallback);
  if (flat && nested) return nested.updatedAt > flat.updatedAt ? nested : flat;
  return flat ?? nested;
}

/**
 * Writes a full progress entry as flat keys and drops any nested-format entry
 * for the same outcome. Callers must wrap this in a transaction.
 */
export function writeReconciliationEntry(
  reconciliationsMap: Y.Map<unknown>,
  outcomeKey: string,
  progress: ReconciliationProgress,
): void {
  reconciliationsMap.set(`${outcomeKey}.checklist1Id`, progress.checklist1Id);
  reconciliationsMap.set(`${outcomeKey}.checklist2Id`, progress.checklist2Id);
  reconciliationsMap.set(`${outcomeKey}.outcomeId`, progress.outcomeId);
  reconciliationsMap.set(`${outcomeKey}.type`, progress.type);
  if (progress.reconciledChecklistId) {
    reconciliationsMap.set(`${outcomeKey}.reconciledChecklistId`, progress.reconciledChecklistId);
  } else {
    reconciliationsMap.delete(`${outcomeKey}.reconciledChecklistId`);
  }
  reconciliationsMap.set(`${outcomeKey}.currentPage`, progress.currentPage);
  reconciliationsMap.set(`${outcomeKey}.viewMode`, progress.viewMode);
  reconciliationsMap.set(`${outcomeKey}.updatedAt`, progress.updatedAt);
  if (reconciliationsMap.get(outcomeKey) instanceof Y.Map) {
    reconciliationsMap.delete(outcomeKey);
  }
}

/**
 * Deletes one outcome's progress in both formats. Callers must wrap this in a
 * transaction.
 */
export function deleteReconciliationEntry(
  reconciliationsMap: Y.Map<unknown>,
  outcomeKey: string,
): void {
  for (const field of RECONCILIATION_FIELDS) {
    reconciliationsMap.delete(`${outcomeKey}.${field}`);
  }
  reconciliationsMap.delete(outcomeKey);
}

/** Collects every outcomeKey present in either format. */
function collectOutcomeKeys(reconciliationsMap: Y.Map<unknown>): Set<string> {
  const keys = new Set<string>();
  for (const key of reconciliationsMap.keys()) {
    const dot = key.lastIndexOf('.');
    if (dot > 0 && (RECONCILIATION_FIELDS as readonly string[]).includes(key.slice(dot + 1))) {
      keys.add(key.slice(0, dot));
    } else if (reconciliationsMap.get(key) instanceof Y.Map) {
      keys.add(key);
    }
  }
  return keys;
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
): ReconciliationOperations {
  function getStudyYMap(studyId: string): Y.Map<unknown> | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;
    const studiesMap = ydoc.getMap('reviews');
    return (studiesMap.get(studyId) as Y.Map<unknown> | undefined) ?? null;
  }

  function saveReconciliationProgress(
    studyId: string,
    outcomeId: string | null,
    type: string,
    progressData: ReconciliationProgressData,
  ): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studyYMap = getStudyYMap(studyId);
    if (!studyYMap) return;

    const outcomeKey = getOutcomeKey(outcomeId, type);
    const now = Date.now();

    ydoc.transact(() => {
      // Fallback for docs that predate container pre-creation and have not
      // synced with the server (which ensures the container) yet.
      let reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<unknown> | undefined;
      if (!reconciliationsMap) {
        reconciliationsMap = new Y.Map();
        studyYMap.set('reconciliations', reconciliationsMap);
      }

      const existing = readReconciliationEntry(reconciliationsMap, outcomeKey, type);
      writeReconciliationEntry(reconciliationsMap, outcomeKey, {
        checklist1Id: progressData.checklist1Id,
        checklist2Id: progressData.checklist2Id,
        outcomeId,
        type,
        reconciledChecklistId:
          progressData.reconciledChecklistId ?? existing?.reconciledChecklistId ?? null,
        currentPage: progressData.currentPage ?? existing?.currentPage ?? 0,
        viewMode: progressData.viewMode ?? existing?.viewMode ?? 'questions',
        updatedAt: now,
      });

      studyYMap.set('updatedAt', now);
    });
  }

  function getReconciliationProgress(
    studyId: string,
    outcomeId: string | null,
    type: string,
  ): ReconciliationProgress | null {
    const studyYMap = getStudyYMap(studyId);
    if (!studyYMap) return null;

    const reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<unknown> | undefined;
    if (reconciliationsMap) {
      const outcomeKey = getOutcomeKey(outcomeId, type);
      const entry = readReconciliationEntry(reconciliationsMap, outcomeKey, type);
      if (entry) return entry;
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
          currentPage: (legacyMap.get('currentPage') as number) || 0,
          viewMode: (legacyMap.get('viewMode') as string) || 'questions',
          updatedAt: (legacyMap.get('updatedAt') as number) || 0,
        };
      }
    }

    return null;
  }

  function getAllReconciliationProgress(studyId: string): ReconciliationProgressEntry[] {
    const studyYMap = getStudyYMap(studyId);
    if (!studyYMap) return [];

    const results: ReconciliationProgressEntry[] = [];

    const reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<unknown> | undefined;
    if (reconciliationsMap) {
      for (const outcomeKey of collectOutcomeKeys(reconciliationsMap)) {
        const entry = readReconciliationEntry(reconciliationsMap, outcomeKey, 'AMSTAR2');
        if (entry) {
          results.push({ outcomeKey, ...entry });
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
            currentPage: (legacyMap.get('currentPage') as number) || 0,
            viewMode: (legacyMap.get('viewMode') as string) || 'questions',
            updatedAt: (legacyMap.get('updatedAt') as number) || 0,
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

    const studyYMap = getStudyYMap(studyId);
    if (!studyYMap) return;

    ydoc.transact(() => {
      const reconciliationsMap = studyYMap.get('reconciliations') as Y.Map<unknown> | undefined;
      if (reconciliationsMap) {
        deleteReconciliationEntry(reconciliationsMap, getOutcomeKey(outcomeId, type));
      }

      if (!outcomeId || type === 'AMSTAR2') {
        studyYMap.delete('reconciliation');
      }

      studyYMap.set('updatedAt', Date.now());
    });
  }

  return {
    saveReconciliationProgress,
    getReconciliationProgress,
    getAllReconciliationProgress,
    clearReconciliationProgress,
  };
}
