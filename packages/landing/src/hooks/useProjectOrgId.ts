/**
 * useProjectOrgId - Get orgId for a project from store or query cache
 */

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectStore } from '@/stores/projectStore';
import { queryKeys } from '@/lib/queryKeys.js';

export function useProjectOrgId(projectId: string | null | undefined): string | null {
  const queryClient = useQueryClient();
  const project = useProjectStore(state => projectId ? state.projects[projectId] : undefined);

  return useMemo(() => {
    if (!projectId) return null;

    // Try project meta (Y.js synced data)
    if (project?.meta?.orgId) {
      return project.meta.orgId as string;
    }

    // Try project list query cache
    const projectsList = queryClient.getQueryData<Array<{ id: string; orgId?: string }>>(queryKeys.projects.all);
    if (Array.isArray(projectsList)) {
      const found = projectsList.find(p => p.id === projectId);
      if (found?.orgId) return found.orgId;
    }

    return null;
  }, [projectId, project, queryClient]);
}
