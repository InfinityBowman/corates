/**
 * useMyProjectsList - Fetches all projects the current user is a member of
 *
 * Uses the user-scoped API endpoint: GET /api/users/me/projects
 */

import { useQuery } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';
import { apiFetch } from '@/lib/apiFetch.js';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * Fetch all projects for the current authenticated user
 * @returns {Promise<Array>} Array of projects with orgId
 */
async function fetchMyProjects() {
  return apiFetch.get('/api/users/me/projects', { toastMessage: false });
}

/**
 * Hook to fetch and manage project list for the current user
 *
 * @param {Object} options - Query options
 * @param {boolean | (() => boolean)} options.enabled - Whether the query should be enabled
 * @returns {Object} Query state and helpers
 */
export function useMyProjectsList(options = {}) {
  const { isLoggedIn, authLoading } = useBetterAuth();

  const query = useQuery(() => {
    const enabledOption =
      typeof options.enabled === 'function' ? options.enabled() : options.enabled;

    return {
      queryKey: queryKeys.projects.all,
      queryFn: fetchMyProjects,
      enabled: enabledOption !== false && isLoggedIn() && !authLoading(),
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnMount: 'always', // Always refetch on mount to catch membership changes that occurred while app was closed
    };
  });

  return {
    projects: () => query.data || [],
    isLoading: () => query.isLoading || query.isFetching,
    isInitialLoading: () => query.isLoading && !query.data,
    isError: () => query.isError,
    error: () => query.error,
    refetch: () => query.refetch(),
    query,
  };
}

export default useMyProjectsList;
