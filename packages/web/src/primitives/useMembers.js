/**
 * useMembers primitive
 * Manages org members state
 */

import { useQuery } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';
import { getMembers } from '@/api/billing.js';
import { useBetterAuth } from '@/api/better-auth-store.js';

/**
 * Hook to manage org members
 * @returns {Object} Members state and helper functions
 */
export function useMembers() {
  const { isLoggedIn } = useBetterAuth();

  // Use TanStack Query for members data
  const query = useQuery(() => ({
    queryKey: queryKeys.members.current,
    queryFn: getMembers,
    enabled: isLoggedIn(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 1, // Retry once on failure
  }));

  const members = () => query.data?.members || [];
  const memberCount = () => query.data?.count || 0;

  return {
    members,
    memberCount,
    loading: () => query.isLoading || query.isFetching,
    error: () => query.error,
    refetch: () => query.refetch(),
  };
}
