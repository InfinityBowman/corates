/**
 * useMyProjectsList - Fetches all projects the current user is a member of
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { getMyProjects } from '@/server/functions/users.functions';
import type { UserProject } from '@/server/functions/users.server';

export type Project = UserProject & {
  studyCount?: number;
  completedCount?: number;
  memberCount?: number;
  members?: unknown[];
};

export function useMyProjectsList(options: { enabled?: boolean } = {}) {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);

  const query = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: () => getMyProjects(),
    enabled: options.enabled !== false && isLoggedIn && !isAuthLoading,
    ...QUERY_STABLE,
    refetchOnMount: 'always' as const,
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
