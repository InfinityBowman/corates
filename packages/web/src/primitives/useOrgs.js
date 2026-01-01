/**
 * useOrgs - Fetches organizations for the current user (without URL dependency)
 *
 * Similar to useOrgContext but doesn't require orgSlug in URL params.
 */

import { useQuery } from '@tanstack/solid-query';
import { authClient } from '@api/auth-client.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { queryKeys } from '@lib/queryKeys.js';

/**
 * Fetch organizations for the current user
 */
async function fetchOrgs() {
  const { data, error } = await authClient.organization.list();
  if (error) {
    throw new Error(error.message || 'Failed to fetch organizations');
  }
  return data || [];
}

/**
 * Hook to fetch organizations list (no URL dependency)
 *
 * @returns {Object} Query state and orgs list
 */
export function useOrgs() {
  const { isLoggedIn, authLoading } = useBetterAuth();

  const orgsQuery = useQuery(() => ({
    queryKey: queryKeys.orgs.list,
    queryFn: fetchOrgs,
    enabled: isLoggedIn() && !authLoading(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  }));

  return {
    orgs: () => orgsQuery.data || [],
    isLoading: () => authLoading() || orgsQuery.isLoading,
    isError: () => orgsQuery.isError,
    error: () => orgsQuery.error,
    refetch: () => orgsQuery.refetch(),
  };
}

export default useOrgs;
