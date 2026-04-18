/**
 * Member actions -- remove project members via RPC
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

    const res = await fetch(
      `${API_BASE}/api/orgs/${orgId}/projects/${projectId}/members/${memberId}`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      throw new Error(data.message || data.code || `Remove failed: ${res.status}`);
    }

    if (isSelf) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId) });
    }

    return { isSelf };
  },
};
