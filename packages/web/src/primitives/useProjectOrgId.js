/**
 * useProjectOrgId - Get orgId for a project
 *
 * Tries to get orgId from:
 * 1. Project meta (if synced from Y.js)
 * 2. Project list query cache (if available)
 */

import { createMemo } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
import projectStore from '@/stores/projectStore.js';
import { queryKeys } from '@lib/queryKeys.js';

/**
 * Hook to get orgId for a project
 * @param {string} projectId - Project ID
 * @returns {() => string | null} Reactive orgId
 */
export function useProjectOrgId(projectId) {
  const queryClient = useQueryClient();

  const orgId = createMemo(() => {
    if (!projectId) return null;

    // Try to get from project meta (Y.js synced data)
    const project = projectStore.getProject(projectId);
    if (project?.meta?.orgId) {
      return project.meta.orgId;
    }

    // Try to get from project list query cache
    const projectsList = queryClient.getQueryData(queryKeys.projects.all);
    if (Array.isArray(projectsList)) {
      const found = projectsList.find(p => p.id === projectId);
      if (found?.orgId) {
        return found.orgId;
      }
    }

    return null;
  });

  return orgId;
}

export default useProjectOrgId;
