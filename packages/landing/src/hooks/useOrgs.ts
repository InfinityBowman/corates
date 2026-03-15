/**
 * useOrgs - Fetches organizations for the current user
 */

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/api/auth-client';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys.js';

export async function fetchOrgs() {
  const { data, error } = await authClient.organization.list();
  if (error) throw new Error(error.message || 'Failed to fetch organizations');
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
