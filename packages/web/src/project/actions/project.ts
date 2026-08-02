/**
 * Project-level actions -- rename, delete, update description
 *
 * Project name/description are D1-authoritative (the server fn + React Query);
 * there is no workspace-side meta write anymore.
 */

import { showToast } from '@/lib/toast';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { deleteProject, updateProject } from '@/server/functions/org-projects.functions';
import { connectionPool } from '../ConnectionPool';

export const projectActions = {
  async rename(newName: string): Promise<void> {
    try {
      const trimmed = (newName || '').trim();
      if (!trimmed) throw new Error('Project name is required');

      const projectId = connectionPool.getActiveProjectId();
      const orgId = connectionPool.getActiveOrgId();
      if (!projectId || !orgId) throw new Error('No active project connection');

      await updateProject({ data: { orgId, projectId, name: trimmed } });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    } catch (err) {
      console.error('Error renaming project:', err);
      showToast.error('Rename Failed', (err as Error).message || 'Failed to rename project');
    }
  },

  async updateDescription(newDescription: string): Promise<void> {
    try {
      const trimmed = (newDescription || '').trim();

      const projectId = connectionPool.getActiveProjectId();
      const orgId = connectionPool.getActiveOrgId();
      if (!projectId || !orgId) throw new Error('No active project connection');

      // Send '' as-is: the server maps it to null (clear). Turning it into
      // undefined made clearing a description a silent no-op that reverted
      // on reload.
      await updateProject({ data: { orgId, projectId, description: trimmed } });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    } catch (err) {
      console.error('Error updating description:', err);
      showToast.error('Update Failed', (err as Error).message || 'Failed to update description');
    }
  },

  async deleteById(targetProjectId: string, targetOrgId?: string): Promise<void> {
    const orgId = targetOrgId || connectionPool.getActiveOrgId();
    if (!orgId) throw new Error('No active org');

    await deleteProject({ data: { orgId, projectId: targetProjectId } });

    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId) });
  },

  async delete(): Promise<void> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    if (!projectId || !orgId) throw new Error('No active project/org');
    return projectActions.deleteById(projectId, orgId);
  },
};
