/**
 * useMembers - Manages org members state
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { getMembers } from '@/server/functions/billing.functions';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

export function useMembers() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  const query = useQuery({
    queryKey: queryKeys.members.current,
    queryFn: () => getMembers(),
    enabled: isLoggedIn,
    ...QUERY_STABLE,
  });

  return {
    members: query.data?.members ?? [],
    memberCount: query.data?.count ?? 0,
    isLoading: query.isLoading || query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
