/**
 * Reconciliation operations for projectActionsStore
 */

/**
 * Creates reconciliation operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @returns {Object} Reconciliation operations
 */
export function createReconciliationActions(getActiveConnection) {
  /**
   * Save reconciliation progress
   */
  function saveProgress(studyId, checklist1Id, checklist2Id, data) {
    const ops = getActiveConnection();
    return ops?.saveReconciliationProgress?.(studyId, checklist1Id, checklist2Id, data);
  }

  /**
   * Get reconciliation progress
   */
  function getProgress(studyId, checklist1Id, checklist2Id) {
    const ops = getActiveConnection();
    return ops?.getReconciliationProgress?.(studyId, checklist1Id, checklist2Id);
  }

  /**
   * Apply reconciliation to both checklists
   */
  function applyToChecklists(studyId, checklist1Id, checklist2Id, data) {
    const ops = getActiveConnection();
    return ops?.applyReconciliationToChecklists?.(studyId, checklist1Id, checklist2Id, data);
  }

  return {
    saveProgress,
    getProgress,
    applyToChecklists,
  };
}
