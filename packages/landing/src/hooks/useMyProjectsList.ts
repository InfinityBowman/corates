/**
 * useMyProjectsList - Fetches all projects the current user is a member of
 */

import { useQuery } from '@tanstack/react-query';
import { parseResponse, type InferResponseType } from 'hono/client';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/rpc';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';

// Base type from backend Zod schema. The extra fields (studyCount, etc.) are
// returned at runtime but not declared in the schema -- backend should add them.
type ProjectBase = InferResponseType<typeof api.api.users.me.projects.$get, 200>[number];
export type Project = ProjectBase & {
  studyCount?: number;
  completedCount?: number;
  memberCount?: number;
  members?: unknown[];
};

async function fetchMyProjects() {
  return parseResponse(api.api.users.me.projects.$get());
}

export function useMyProjectsList(options: { enabled?: boolean } = {}) {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);

  const query = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: fetchMyProjects,
    enabled: options.enabled !== false && isLoggedIn && !isAuthLoading,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
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
