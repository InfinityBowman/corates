/**
 * Project-level operations for projectActionsStore
 */

import { showToast } from '@corates/ui'
import { API_BASE } from '@config/api.js'
import projectStore from '../projectStore.js'

/**
 * Creates project operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @param {Function} getActiveProjectId - Function to get current project ID
 * @returns {Object} Project operations
 */
export function createProjectActions(getActiveConnection, getActiveProjectId) {
  /**
   * Rename a project (uses active project)
   */
  async function rename(newName) {
    const ops = getActiveConnection()
    if (!ops?.renameProject) {
      showToast.error('Rename Failed', 'Not connected to project')
      return
    }
    try {
      await ops.renameProject(newName)
    } catch (err) {
      console.error('Error renaming project:', err)
      showToast.error(
        'Rename Failed',
        err.message || 'Failed to rename project',
      )
    }
  }

  /**
   * Update project description (uses active project)
   */
  async function updateDescription(newDescription) {
    const ops = getActiveConnection()
    if (!ops?.updateDescription) {
      showToast.error('Update Failed', 'Not connected to project')
      return
    }
    try {
      await ops.updateDescription(newDescription)
    } catch (err) {
      console.error('Error updating description:', err)
      showToast.error(
        'Update Failed',
        err.message || 'Failed to update description',
      )
    }
  }

  /**
   * Delete a project (low-level, no confirmation)
   * Note: This takes an explicit projectId since it may differ from active project
   * @param {string} targetProjectId - Project to delete
   * @param {boolean} shouldNavigate - Whether to navigate to dashboard after
   */
  async function deleteById(targetProjectId) {
    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${targetProjectId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete project')
      }
      projectStore.removeProjectFromList(targetProjectId)
    } catch (err) {
      console.error('Error deleting project:', err)
      throw err
    }
  }

  /**
   * Delete the active project
   */
  async function deleteProject(shouldNavigate = true) {
    const projectId = getActiveProjectId()
    return deleteById(projectId, shouldNavigate)
  }

  return {
    rename,
    updateDescription,
    delete: deleteProject,
    deleteById,
  }
}
