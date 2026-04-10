/**
 * useOrgs - Fetches organizations for the current user
 */

import { useQuery } from '@tanstack/react-query';
import { authClient, authFetch } from '@/api/auth-client';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys';

async function fetchOrgs() {
  const data = await authFetch(authClient.organization.list());
  return data || [];
}

export function useOrgs() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list,
    queryFn: fetchOrgs,
    enabled: isLoggedIn && !isAuthLoading,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  return {
    orgs: orgsQuery.data ?? [],
    isLoading: isAuthLoading || orgsQuery.isLoading,
    isError: orgsQuery.isError,
    error: orgsQuery.error,
    refetch: orgsQuery.refetch,
  };
}
