/**
 * Project-level actions -- rename, delete
 *
 * Project name is D1-authoritative (the server fn + React Query);
 * there is no workspace-side meta write anymore.
 */

import { showToast } from '@/lib/toast';
import { captureException } from '@/config/sentry';
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
      captureException(err, { component: 'projectActions', action: 'rename' });
      showToast.error('Rename Failed', (err as Error).message || 'Failed to rename project');
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
