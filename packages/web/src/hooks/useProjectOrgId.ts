/**
 * useProjectOrgId - Get orgId for a project from store or query cache
 */

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectMeta } from '@/stores/projectAtoms';
import { queryKeys } from '@/lib/queryKeys';

export function useProjectOrgId(projectId: string | null | undefined): string | null {
  const queryClient = useQueryClient();
  const meta = useProjectMeta(projectId || '');

  return useMemo(() => {
    if (!projectId) return null;

    if (meta?.orgId) {
      return meta.orgId;
    }

    // Try project list query cache
    const projectsList = queryClient.getQueryData<Array<{ id: string; orgId?: string }>>(
      queryKeys.projects.all,
    );
    if (Array.isArray(projectsList)) {
      const found = projectsList.find(p => p.id === projectId);
      if (found?.orgId) return found.orgId;
    }

    return null;
  }, [projectId, meta, queryClient]);
}
