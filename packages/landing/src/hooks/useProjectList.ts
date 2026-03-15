/**
 * useProjectList - Fetches and manages project list with TanStack Query
 * Includes reconciliation of cached projects with server state
 */

import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '@/config/api';
import { queryKeys } from '@/lib/queryKeys';
import { useProjectStore } from '@/stores/projectStore';

const failedCleanupQueue = new Set<string>();

let cleanupProjectLocalData: ((_id: string) => Promise<void>) | null = null;
async function getCleanupFunction() {
  if (!cleanupProjectLocalData) {
    const module = await import('@/primitives/useProject/index.js');
    cleanupProjectLocalData = module.cleanupProjectLocalData;
  }
  return cleanupProjectLocalData;
}

async function attemptCleanup(projectId: string, cleanupFn: (_id: string) => Promise<void>) {
  try {
    await cleanupFn(projectId);
    failedCleanupQueue.delete(projectId);
  } catch (err) {
    console.error('Failed to clean up stale project:', projectId, err);
    failedCleanupQueue.add(projectId);
  }
}

async function fetchProjects(userId: string) {
  if (!userId) return [];

  const response = await fetch(`${API_BASE}/api/users/${userId}/projects`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) throw new Error('Failed to fetch projects');

  const projects = await response.json();

  // Reconcile: clean up local data for projects no longer in the server list
  const serverProjectIds = new Set(projects.map((p: { id: string }) => p.id));
  const cachedProjectIds = Object.keys(useProjectStore.getState().projects);

  const cleanupFn = await getCleanupFunction();

  for (const failedId of failedCleanupQueue) {
    if (!serverProjectIds.has(failedId) && cleanupFn) {
      attemptCleanup(failedId, cleanupFn);
    } else {
      failedCleanupQueue.delete(failedId);
    }
  }

  for (const cachedId of cachedProjectIds) {
    if (!serverProjectIds.has(cachedId) && cleanupFn && !failedCleanupQueue.has(cachedId)) {
      attemptCleanup(cachedId, cleanupFn);
    }
  }

  return projects;
}

export function useProjectList(
  userId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: queryKeys.projects.list(userId),
    queryFn: () => fetchProjects(userId!),
    enabled: options.enabled !== false && !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: 'always' as const,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading || query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    query,
  };
}
