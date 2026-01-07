/**
 * useLinkedAccounts primitive
 * Manages linked authentication accounts with TanStack Query for caching
 */

import { useQuery } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';
import { authClient } from '@api/auth-client.js';
import { useBetterAuth } from '@/api/better-auth-store.js';

/**
 * Fetch linked accounts from Better Auth
 */
async function fetchLinkedAccounts() {
  const { data, error } = await authClient.listAccounts();
  if (error) throw error;
  return data || [];
}

/**
 * Hook to manage linked accounts with caching
 * @returns {Object} Linked accounts state and helper functions
 */
export function useLinkedAccounts() {
  const { isLoggedIn } = useBetterAuth();

  const query = useQuery(() => ({
    queryKey: queryKeys.accounts.linked,
    queryFn: fetchLinkedAccounts,
    enabled: isLoggedIn(),
    staleTime: 1000 * 60 * 5, // 5 minutes - accounts rarely change
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache longer
    retry: 1,
  }));

  return {
    accounts: () => query.data || [],
    isLoading: () => query.isLoading,
    isFetching: () => query.isFetching,
    error: () => query.error,
    refetch: () => query.refetch(),
  };
}
