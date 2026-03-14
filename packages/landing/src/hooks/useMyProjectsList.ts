/**
 * useMyProjectsList - Fetches all projects the current user is a member of
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys.js';
import { apiFetch } from '@/lib/apiFetch.js';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';

async function fetchMyProjects() {
  return apiFetch.get('/api/users/me/projects', { toastMessage: false });
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
