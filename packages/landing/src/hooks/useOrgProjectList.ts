/**
 * useOrgProjectList - Fetches projects for an organization
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys.js';
import { apiFetch } from '@/lib/apiFetch.js';

async function fetchOrgProjects(orgId: string) {
  if (!orgId) return [];
  return apiFetch.get(`/api/orgs/${orgId}/projects`, { toastMessage: false });
}

export function useOrgProjectList(orgId: string | null | undefined, options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: queryKeys.projects.byOrg(orgId),
    queryFn: () => fetchOrgProjects(orgId!),
    enabled: options.enabled !== false && !!orgId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading || query.isFetching,
    isInitialLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    query,
  };
}
