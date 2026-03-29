/**
 * Outcome operations for useProject
 * Manages project-level outcomes stored in Yjs meta map
 */

import * as Y from 'yjs';

export interface Outcome {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  [key: string]: unknown;
}

export interface DeleteOutcomeResult {
  success: boolean;
  error?: string;
}

export interface OutcomeOperations {
  getOutcomes: () => Outcome[];
  getOutcome: (outcomeId: string) => Outcome | null;
  createOutcome: (name: string, createdBy: string) => string | null;
  updateOutcome: (outcomeId: string, name: string) => boolean;
  deleteOutcome: (outcomeId: string) => DeleteOutcomeResult;
  isOutcomeInUse: (outcomeId: string) => boolean;
}

export function createOutcomeOperations(
  _projectId: string,
  getYDoc: () => Y.Doc | null,
  _isSynced: () => boolean,
): OutcomeOperations {
  function getOutcomes(): Outcome[] {
    const ydoc = getYDoc();
    if (!ydoc) return [];

    const metaMap = ydoc.getMap('meta');
    const outcomesMap = metaMap.get('outcomes') as Y.Map<unknown> | undefined;

    if (!outcomesMap || typeof outcomesMap.entries !== 'function') {
      return [];
    }

    const outcomes: Outcome[] = [];
    for (const [outcomeId, outcomeYMap] of (outcomesMap as Y.Map<Y.Map<unknown>>).entries()) {
      const outcomeData = outcomeYMap.toJSON ? outcomeYMap.toJSON() : outcomeYMap;
      outcomes.push({
        id: outcomeId,
        ...(outcomeData as Record<string, unknown>),
      } as Outcome);
    }

    return outcomes.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  function getOutcome(outcomeId: string): Outcome | null {
    const ydoc = getYDoc();
    if (!ydoc || !outcomeId) return null;

    const metaMap = ydoc.getMap('meta');
    const outcomesMap = metaMap.get('outcomes') as Y.Map<unknown> | undefined;

    if (!outcomesMap) return null;

    const outcomeYMap = outcomesMap.get(outcomeId) as Y.Map<unknown> | undefined;
    if (!outcomeYMap) return null;

    const outcomeData =
      (outcomeYMap as Y.Map<unknown> & { toJSON?: () => Record<string, unknown> }).toJSON ?
        (outcomeYMap as Y.Map<unknown> & { toJSON: () => Record<string, unknown> }).toJSON()
      : outcomeYMap;
    return {
      id: outcomeId,
      ...(outcomeData as Record<string, unknown>),
    } as Outcome;
  }

  function createOutcome(name: string, createdBy: string): string | null {
    try {
      const ydoc = getYDoc();
      if (!ydoc) {
        console.error('[createOutcome] No YDoc available');
        return null;
      }

      if (!name || !name.trim()) {
        console.error('[createOutcome] Outcome name is required');
        return null;
      }

      const outcomeId = crypto.randomUUID();
      const now = Date.now();

      const metaMap = ydoc.getMap('meta');
      let outcomesMap = metaMap.get('outcomes') as Y.Map<Y.Map<unknown>> | undefined;

      if (!outcomesMap) {
        outcomesMap = new Y.Map();
        metaMap.set('outcomes', outcomesMap);
      }

      const outcomeYMap = new Y.Map();
      outcomeYMap.set('name', name.trim());
      outcomeYMap.set('createdAt', now);
      outcomeYMap.set('createdBy', createdBy);

      outcomesMap.set(outcomeId, outcomeYMap);
      metaMap.set('updatedAt', now);

      return outcomeId;
    } catch (err) {
      console.error('[createOutcome] Error creating outcome:', err);
      return null;
    }
  }

  function updateOutcome(outcomeId: string, name: string): boolean {
    try {
      const ydoc = getYDoc();
      if (!ydoc) return false;

      if (!name || !name.trim()) {
        console.error('[updateOutcome] Outcome name is required');
        return false;
      }

      const metaMap = ydoc.getMap('meta');
      const outcomesMap = metaMap.get('outcomes') as Y.Map<unknown> | undefined;

      if (!outcomesMap) return false;

      const outcomeYMap = outcomesMap.get(outcomeId) as Y.Map<unknown> | undefined;
      if (!outcomeYMap) return false;

      (outcomeYMap as Y.Map<unknown>).set('name', name.trim());
      metaMap.set('updatedAt', Date.now());

      return true;
    } catch (err) {
      console.error('[updateOutcome] Error updating outcome:', err);
      return false;
    }
  }

  function deleteOutcome(outcomeId: string): DeleteOutcomeResult {
    try {
      const ydoc = getYDoc();
      if (!ydoc) return { success: false, error: 'No connection' };

      const studiesMap = ydoc.getMap('reviews');
      for (const [, studyYMap] of (studiesMap as Y.Map<Y.Map<unknown>>).entries()) {
        const checklistsMap = studyYMap.get('checklists') as Y.Map<Y.Map<unknown>> | undefined;
        if (!checklistsMap) continue;

        for (const [, checklistYMap] of checklistsMap.entries()) {
          const checklistOutcomeId = checklistYMap.get('outcomeId');
          if (checklistOutcomeId === outcomeId) {
            return {
              success: false,
              error: 'Cannot delete outcome that is in use by checklists',
            };
          }
        }
      }

      const metaMap = ydoc.getMap('meta');
      const outcomesMap = metaMap.get('outcomes') as Y.Map<unknown> | undefined;

      if (!outcomesMap) return { success: false, error: 'No outcomes found' };

      if (!outcomesMap.has(outcomeId)) {
        return { success: false, error: 'Outcome not found' };
      }

      outcomesMap.delete(outcomeId);
      metaMap.set('updatedAt', Date.now());

      return { success: true };
    } catch (err) {
      console.error('[deleteOutcome] Error deleting outcome:', err);
      return { success: false, error: (err as Error).message };
    }
  }

  function isOutcomeInUse(outcomeId: string): boolean {
    const ydoc = getYDoc();
    if (!ydoc) return false;

    const studiesMap = ydoc.getMap('reviews');
    for (const [, studyYMap] of (studiesMap as Y.Map<Y.Map<unknown>>).entries()) {
      const checklistsMap = studyYMap.get('checklists') as Y.Map<Y.Map<unknown>> | undefined;
      if (!checklistsMap) continue;

      for (const [, checklistYMap] of checklistsMap.entries()) {
        if (checklistYMap.get('outcomeId') === outcomeId) {
          return true;
        }
      }
    }

    return false;
  }

  return {
    getOutcomes,
    getOutcome,
    createOutcome,
    updateOutcome,
    deleteOutcome,
    isOutcomeInUse,
  };
}
