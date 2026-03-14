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
import { getOutcomeKey } from '@/lib/checklist-domain.js';

/**
 * Creates reconciliation operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Reconciliation operations
 */
export function createReconciliationOperations(projectId, getYDoc, _isSynced) {
  /**
   * Save reconciliation progress for a specific outcome
   * Stores only metadata references - finalAnswers are in the reconciled checklist
   * @param {string} studyId - The study ID
   * @param {string|null} outcomeId - The outcome ID (null for AMSTAR2)
   * @param {string} type - The checklist type
   * @param {Object} progressData - Progress data { checklist1Id, checklist2Id, reconciledChecklistId }
   */
  function saveReconciliationProgress(studyId, outcomeId, type, progressData) {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    // Get or create the reconciliations container (nested map structure)
    let reconciliationsMap = studyYMap.get('reconciliations');
    if (!reconciliationsMap) {
      reconciliationsMap = new Y.Map();
      studyYMap.set('reconciliations', reconciliationsMap);
    }

    // Derive outcome key
    const outcomeKey = getOutcomeKey(outcomeId, type);

    // Get or create outcome-specific progress map
    let outcomeProgressMap = reconciliationsMap.get(outcomeKey);
    if (!outcomeProgressMap) {
      outcomeProgressMap = new Y.Map();
      reconciliationsMap.set(outcomeKey, outcomeProgressMap);
    }

    // Save the progress data (minimal - just references)
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

  /**
   * Get reconciliation progress for a specific outcome
   * @param {string} studyId - The study ID
   * @param {string|null} outcomeId - The outcome ID (null for AMSTAR2)
   * @param {string} type - The checklist type
   * @returns {Object|null} Progress data or null
   */
  function getReconciliationProgress(studyId, outcomeId, type) {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return null;

    // Try new outcome-scoped structure first
    const reconciliationsMap = studyYMap.get('reconciliations');
    if (reconciliationsMap) {
      const outcomeKey = getOutcomeKey(outcomeId, type);
      const outcomeProgressMap = reconciliationsMap.get(outcomeKey);
      if (outcomeProgressMap) {
        const checklist1Id = outcomeProgressMap.get('checklist1Id');
        const checklist2Id = outcomeProgressMap.get('checklist2Id');
        if (checklist1Id && checklist2Id) {
          return {
            checklist1Id,
            checklist2Id,
            outcomeId: outcomeProgressMap.get('outcomeId') || null,
            type: outcomeProgressMap.get('type') || type,
            reconciledChecklistId: outcomeProgressMap.get('reconciledChecklistId') || null,
            currentPage: outcomeProgressMap.get('currentPage'),
            viewMode: outcomeProgressMap.get('viewMode'),
            updatedAt: outcomeProgressMap.get('updatedAt'),
          };
        }
      }
    }

    // Fall back to legacy single-progress format for backward compatibility
    const legacyMap = studyYMap.get('reconciliation');
    if (legacyMap) {
      const checklist1Id = legacyMap.get('checklist1Id');
      const checklist2Id = legacyMap.get('checklist2Id');
      if (checklist1Id && checklist2Id) {
        return {
          checklist1Id,
          checklist2Id,
          outcomeId: null,
          type: type || 'AMSTAR2',
          reconciledChecklistId: legacyMap.get('reconciledChecklistId') || null,
          currentPage: legacyMap.get('currentPage'),
          viewMode: legacyMap.get('viewMode'),
          updatedAt: legacyMap.get('updatedAt'),
        };
      }
    }

    return null;
  }

  /**
   * Get all reconciliation progress entries for a study
   * Returns progress for all outcomes
   * @param {string} studyId - The study ID
   * @returns {Array<{outcomeKey: string, outcomeId: string|null, type: string, ...progress}>}
   */
  function getAllReconciliationProgress(studyId) {
    const ydoc = getYDoc();
    if (!ydoc) return [];

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return [];

    const results = [];

    // Get from new outcome-scoped structure
    const reconciliationsMap = studyYMap.get('reconciliations');
    if (reconciliationsMap) {
      for (const [outcomeKey, progressMap] of reconciliationsMap.entries()) {
        const checklist1Id = progressMap.get('checklist1Id');
        const checklist2Id = progressMap.get('checklist2Id');
        if (checklist1Id && checklist2Id) {
          results.push({
            outcomeKey,
            outcomeId: progressMap.get('outcomeId') || null,
            type: progressMap.get('type') || 'AMSTAR2',
            checklist1Id,
            checklist2Id,
            reconciledChecklistId: progressMap.get('reconciledChecklistId') || null,
            currentPage: progressMap.get('currentPage'),
            viewMode: progressMap.get('viewMode'),
            updatedAt: progressMap.get('updatedAt'),
          });
        }
      }
    }

    // Include legacy format if exists and not already covered by new structure
    const legacyMap = studyYMap.get('reconciliation');
    if (legacyMap) {
      const checklist1Id = legacyMap.get('checklist1Id');
      const checklist2Id = legacyMap.get('checklist2Id');
      if (checklist1Id && checklist2Id) {
        // Only add if we don't already have an entry with these checklist IDs
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
            reconciledChecklistId: legacyMap.get('reconciledChecklistId') || null,
            currentPage: legacyMap.get('currentPage'),
            viewMode: legacyMap.get('viewMode'),
            updatedAt: legacyMap.get('updatedAt'),
          });
        }
      }
    }

    return results;
  }

  /**
   * Clear reconciliation progress for a specific outcome
   * @param {string} studyId - The study ID
   * @param {string|null} outcomeId - The outcome ID (null for AMSTAR2)
   * @param {string} type - The checklist type
   */
  function clearReconciliationProgress(studyId, outcomeId, type) {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);
    if (!studyYMap) return;

    // Clear from new structure
    const reconciliationsMap = studyYMap.get('reconciliations');
    if (reconciliationsMap) {
      const outcomeKey = getOutcomeKey(outcomeId, type);
      reconciliationsMap.delete(outcomeKey);
    }

    // Also clear legacy format if clearing the default outcome
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
