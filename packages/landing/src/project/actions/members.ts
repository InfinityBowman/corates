/**
 * Member actions -- HTTP-only, no Y.js operations
 */

import { API_BASE } from '@/config/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { connectionPool } from '../ConnectionPool';

export const memberActions = {
  async remove(memberId: string): Promise<{ isSelf: boolean }> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    if (!projectId) throw new Error('No active project');
    if (!orgId) throw new Error('No active org');

    const user = selectUser(useAuthStore.getState());
    const isSelf = user?.id === memberId;

    const response = await fetch(
      `${API_BASE}/api/orgs/${orgId}/projects/${projectId}/members/${memberId}`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to remove member');
    }

    if (isSelf) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId) });
    }

    return { isSelf };
  },
};
