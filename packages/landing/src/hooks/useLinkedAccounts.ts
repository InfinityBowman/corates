/**
 * useLinkedAccounts - Manages linked authentication accounts
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { authClient } from '@/api/auth-client';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

async function fetchLinkedAccounts() {
  const { data, error } = await authClient.listAccounts();
  if (error) throw error;
  return data || [];
}

export function useLinkedAccounts() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  const query = useQuery({
    queryKey: queryKeys.accounts.linked,
    queryFn: fetchLinkedAccounts,
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
