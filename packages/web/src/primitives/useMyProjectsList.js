/**
 * useMyProjectsList - Fetches all projects the current user is a member of
 *
 * Uses the user-scoped API endpoint: GET /api/users/me/projects
 */

import { useQuery } from '@tanstack/solid-query';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import { handleFetchError } from '@/lib/error-utils.js';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * Fetch all projects for the current authenticated user
 * @returns {Promise<Array>} Array of projects with orgId
 */
async function fetchMyProjects() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/users/me/projects`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }),
    { showToast: false },
  );

  return response.json();
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

export default useMyProjectsList;
