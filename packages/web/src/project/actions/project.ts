/**
 * Project-level actions -- rename, delete, update description
 */

import { API_BASE } from '@/config/api';
import { showToast } from '@/components/ui/toast';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { connectionPool } from '../ConnectionPool';

export const projectActions = {
  async rename(newName: string): Promise<void> {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    try {
      await ops.study.renameProject(newName);
    } catch (err) {
      console.error('Error renaming project:', err);
      showToast.error('Rename Failed', (err as Error).message || 'Failed to rename project');
    }
  },

  async updateDescription(newDescription: string): Promise<void> {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    try {
      await ops.study.updateDescription(newDescription);
    } catch (err) {
      console.error('Error updating description:', err);
      showToast.error('Update Failed', (err as Error).message || 'Failed to update description');
    }
  },

  async deleteById(targetProjectId: string, targetOrgId?: string): Promise<void> {
    const orgId = targetOrgId || connectionPool.getActiveOrgId();
    if (!orgId) throw new Error('No active org');

    const res = await fetch(
      `${API_BASE}/api/orgs/${orgId}/projects/${targetProjectId}`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      throw new Error(data.message || data.code || `Delete failed: ${res.status}`);
    }

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
