/**
 * Project-level operations for projectActionsStore
 */

import { showToast } from '@/components/ui/toast';
import { API_BASE } from '@config/api.js';
import { queryClient } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';

/**
 * Creates project operations
 * @param {Function} getActiveConnection - Function to get current Y.js connection
 * @param {Function} getActiveProjectId - Function to get current project ID
 * @param {Function} getActiveOrgId - Function to get current org ID
 * @returns {Object} Project operations
 */
export function createProjectActions(getActiveConnection, getActiveProjectId, getActiveOrgId) {
  /**
   * Rename a project (uses active project)
   */
  async function rename(newName) {
    const ops = getActiveConnection();
    if (!ops?.renameProject) {
      showToast.error('Rename Failed', 'Not connected to project');
      return;
    }
    try {
      await ops.renameProject(newName);
    } catch (err) {
      console.error('Error renaming project:', err);
      showToast.error('Rename Failed', err.message || 'Failed to rename project');
    }
  }

  /**
   * Update project description (uses active project)
   */
  async function updateDescription(newDescription) {
    const ops = getActiveConnection();
    if (!ops?.updateDescription) {
      showToast.error('Update Failed', 'Not connected to project');
      return;
    }
    try {
      await ops.updateDescription(newDescription);
    } catch (err) {
      console.error('Error updating description:', err);
      showToast.error('Update Failed', err.message || 'Failed to update description');
    }
  }

  /**
   * Delete a project (low-level, no confirmation)
   * Note: This takes an explicit projectId since it may differ from active project
   * @param {string} targetProjectId - Project to delete
   * @param {string} [targetOrgId] - Org ID (optional, uses active org if not provided)
   */
  async function deleteById(targetProjectId, targetOrgId) {
    const orgId = targetOrgId || getActiveOrgId();

    try {
      const response = await fetch(`${API_BASE}/api/orgs/${orgId}/projects/${targetProjectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete project');
      }
      // Invalidate project list query to refetch without deleted project
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId) });
    } catch (err) {
      console.error('Error deleting project:', err);
      throw err;
    }
  }

  /**
   * Delete the active project
   */
  async function deleteProject() {
    const projectId = getActiveProjectId();
    const orgId = getActiveOrgId();
    return deleteById(projectId, orgId);
  }

  return {
    rename,
    updateDescription,
    delete: deleteProject,
    deleteById,
  };
}
