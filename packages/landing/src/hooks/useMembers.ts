/**
 * useMembers - Manages org members state
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys.js';
import { getMembers } from '@/api/billing';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

export function useMembers() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);

  const query = useQuery({
    queryKey: queryKeys.members.current,
    queryFn: getMembers,
    enabled: isLoggedIn,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  return {
    members: query.data?.members ?? [],
    memberCount: query.data?.count ?? 0,
    loading: query.isLoading || query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
