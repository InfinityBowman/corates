/**
 * Outcome actions for projectActionsStore
 * Handles creating, updating, and deleting project-level outcomes
 */

import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * Create outcome actions
 * @param {Function} getActiveConnection - Function to get active project connection
 * @returns {Object} Outcome action methods
 */
export function createOutcomeActions(getActiveConnection) {
  /**
   * Get current user ID from auth store
   */
  function getCurrentUserId() {
    const auth = useBetterAuth();
    return auth.user()?.id || null;
  }

  return {
    /**
     * Create a new outcome
     * @param {string} name - Outcome name
     * @returns {string|null} The outcome ID or null if failed
     */
    create(name) {
      const conn = getActiveConnection();
      if (!conn?.createOutcome) {
        console.error('[outcome.create] No connection or createOutcome not available');
        return null;
      }

      const userId = getCurrentUserId();
      if (!userId) {
        console.error('[outcome.create] No user logged in');
        return null;
      }

      return conn.createOutcome(name, userId);
    },

    /**
     * Update an outcome's name
     * @param {string} outcomeId - The outcome ID
     * @param {string} name - New name
     * @returns {boolean} True if updated
     */
    update(outcomeId, name) {
      const conn = getActiveConnection();
      if (!conn?.updateOutcome) {
        console.error('[outcome.update] No connection or updateOutcome not available');
        return false;
      }

      return conn.updateOutcome(outcomeId, name);
    },

    /**
     * Delete an outcome
     * @param {string} outcomeId - The outcome ID
     * @returns {{success: boolean, error?: string}} Result
     */
    delete(outcomeId) {
      const conn = getActiveConnection();
      if (!conn?.deleteOutcome) {
        console.error('[outcome.delete] No connection or deleteOutcome not available');
        return { success: false, error: 'No connection' };
      }

      return conn.deleteOutcome(outcomeId);
    },

    /**
     * Check if an outcome is in use
     * @param {string} outcomeId - The outcome ID
     * @returns {boolean} True if in use
     */
    isInUse(outcomeId) {
      const conn = getActiveConnection();
      if (!conn?.isOutcomeInUse) {
        return false;
      }

      return conn.isOutcomeInUse(outcomeId);
    },
  };
}
