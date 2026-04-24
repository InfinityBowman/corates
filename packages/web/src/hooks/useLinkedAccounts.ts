/**
 * useLinkedAccounts - Manages linked authentication accounts
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { authClient, authFetch } from '@/api/auth-client';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

interface LinkedAccount {
  id: string;
  providerId: string;
  accountId: string;
  [key: string]: unknown;
}

async function fetchLinkedAccounts(): Promise<LinkedAccount[]> {
  const data = await authFetch(authClient.listAccounts());
  return (data || []) as LinkedAccount[];
}

export function useLinkedAccounts() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  const query = useQuery({
    queryKey: queryKeys.accounts.linked,
    queryFn: fetchLinkedAccounts,
    enabled: isLoggedIn,
    ...QUERY_STABLE,
  });

  return {
    accounts: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
