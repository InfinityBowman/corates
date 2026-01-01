/**
 * useProjectList hook - Fetches and manages project list with TanStack Query
 * Includes IndexedDB persistence for offline support
 */

import { useQuery } from '@tanstack/solid-query';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import projectStore from '@/stores/projectStore.js';

// Track failed cleanup attempts for retry on subsequent fetches
const failedCleanupQueue = new Set();

let cleanupProjectLocalData = null;
async function getCleanupFunction() {
  if (!cleanupProjectLocalData) {
    const module = await import('@/primitives/useProject/index.js');
    cleanupProjectLocalData = module.cleanupProjectLocalData;
  }
  return cleanupProjectLocalData;
}

/**
 * Attempt to clean up a stale project, tracking failures for retry
 * @param {string} projectId - Project ID to clean up
 * @param {Function} cleanupFn - Cleanup function
 */
async function attemptCleanup(projectId, cleanupFn) {
  try {
    await cleanupFn(projectId);
    // Remove from failed queue on success (in case it was a retry)
    failedCleanupQueue.delete(projectId);
  } catch (err) {
    console.error('Failed to clean up stale project:', projectId, err);
    // Track for retry on next fetch
    failedCleanupQueue.add(projectId);
  }
}

/**
 * Fetch projects from API
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of projects
 */
async function fetchProjects(userId) {
  if (!userId) {
    return [];
  }

  const response = await fetch(`${API_BASE}/api/users/${userId}/projects`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }

  const projects = await response.json();

  // Reconcile: clean up local data for projects no longer in the server list
  // This handles cases where user was removed or project was deleted while offline
  const serverProjectIds = new Set(projects.map(p => p.id));
  const cachedProjectIds = Object.keys(projectStore.store.projects);

  const cleanupFn = await getCleanupFunction();

  // Retry previously failed cleanups first
  for (const failedId of failedCleanupQueue) {
    if (!serverProjectIds.has(failedId) && cleanupFn) {
      attemptCleanup(failedId, cleanupFn);
    } else {
      // Project is now in server list or cleanup not available, remove from queue
      failedCleanupQueue.delete(failedId);
    }
  }

  // Clean up newly stale projects
  for (const cachedId of cachedProjectIds) {
    if (!serverProjectIds.has(cachedId) && cleanupFn && !failedCleanupQueue.has(cachedId)) {
      attemptCleanup(cachedId, cleanupFn);
    }
  }

  return projects;
}

/**
 * Hook to fetch and manage project list with TanStack Query
 * @param {() => string | null | undefined} userId - Reactive user ID signal/function
 * @param {Object} options - Query options
 * @param {boolean | (() => boolean)} options.enabled - Whether the query should be enabled (default: true if userId exists)
 * @returns {Object} Query state and helpers
 */
export function useProjectList(userId, options = {}) {
  const query = useQuery(() => {
    const currentUserId = typeof userId === 'function' ? userId() : userId;
    // Support both static boolean and getter function for enabled option
    const enabledOption =
      typeof options.enabled === 'function' ? options.enabled() : options.enabled;
    return {
      queryKey: queryKeys.projects.list(currentUserId),
      queryFn: () => fetchProjects(currentUserId),
      enabled: enabledOption !== false && !!currentUserId,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnMount: 'always', // Always refetch on mount to catch membership changes that occurred while app was closed
    };
  });

  return {
    projects: () => query.data || [],
    isLoading: () => query.isLoading || query.isFetching,
    isError: () => query.isError,
    error: () => query.error,
    refetch: () => query.refetch(),
    query,
  };
}
