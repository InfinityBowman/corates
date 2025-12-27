/**
 * Member operations for projectActionsStore
 */

import { API_BASE } from '@config/api.js'
import projectStore from '../projectStore.js'

/**
 * Creates member operations
 * @param {Function} getActiveProjectId - Function to get current project ID
 * @param {Function} getCurrentUserId - Function to get current user ID
 * @returns {Object} Member operations
 */
export function createMemberActions(getActiveProjectId, getCurrentUserId) {
  /**
   * Remove a member from active project (low-level, no confirmation)
   * @param {string} memberId - Member ID to remove
   * @returns {Promise<{isSelf: boolean}>}
   */
  async function remove(memberId) {
    const projectId = getActiveProjectId()
    const currentUserId = getCurrentUserId()
    const isSelf = currentUserId === memberId

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/members/${memberId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      if (isSelf) {
        projectStore.removeProjectFromList(projectId)
      }

      return { isSelf }
    } catch (err) {
      console.error('Error removing member:', err)
      throw err
    }
  }

  return {
    remove,
  }
}
