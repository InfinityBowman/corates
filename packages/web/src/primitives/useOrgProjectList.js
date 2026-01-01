/**
 * useOrgProjectList - Fetches projects for an organization
 *
 * Uses the org-scoped API endpoint: GET /api/orgs/:orgId/projects
 */

import { useQuery } from '@tanstack/solid-query';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import { handleFetchError } from '@/lib/error-utils.js';

/**
 * Fetch projects for an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array>} Array of projects
 */
async function fetchOrgProjects(orgId) {
  if (!orgId) {
    return [];
  }

  const response = await handleFetchError(
    fetch(`${API_BASE}/api/orgs/${orgId}/projects`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }),
    { showToast: false },
  );

  return response.json();
}

/**
 * Hook to fetch and manage project list for an organization
 *
 * @param {() => string | null | undefined} orgId - Reactive org ID signal/function
 * @param {Object} options - Query options
 * @param {boolean | (() => boolean)} options.enabled - Whether the query should be enabled
 * @returns {Object} Query state and helpers
 */
export function useOrgProjectList(orgId, options = {}) {
  const query = useQuery(() => {
    const currentOrgId = typeof orgId === 'function' ? orgId() : orgId;
    const enabledOption =
      typeof options.enabled === 'function' ? options.enabled() : options.enabled;

    return {
      queryKey: queryKeys.projects.byOrg(currentOrgId),
      queryFn: () => fetchOrgProjects(currentOrgId),
      enabled: enabledOption !== false && !!currentOrgId,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
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

export default useOrgProjectList;
