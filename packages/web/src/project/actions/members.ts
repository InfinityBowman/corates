/**
 * Member actions -- remove project members via RPC
 */

import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { removeMember } from '@/server/functions/org-projects.functions';
import { connectionPool } from '../ConnectionPool';

export const memberActions = {
  async remove(memberId: string): Promise<{ isSelf: boolean }> {
    const projectId = connectionPool.getActiveProjectId();
    const orgId = connectionPool.getActiveOrgId();
    if (!projectId) throw new Error('No active project');
    if (!orgId) throw new Error('No active org');

    const user = selectUser(useAuthStore.getState());
    const isSelf = user?.id === memberId;

    await removeMember({ data: { orgId, projectId, userId: memberId } });

    if (isSelf) {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId) });
    }

    return { isSelf };
  },
};
