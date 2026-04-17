/**
 * useMyProjectsList - Fetches all projects the current user is a member of
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { API_BASE } from '@/config/api';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';

// Shape returned by GET /api/users/me/projects (TanStack Start file route).
// Extra fields (studyCount, etc.) are added downstream at runtime.
interface ProjectBase {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export type Project = ProjectBase & {
  studyCount?: number;
  completedCount?: number;
  memberCount?: number;
  members?: unknown[];
};

async function fetchMyProjects(): Promise<ProjectBase[]> {
  const res = await fetch(`${API_BASE}/api/users/me/projects`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch projects: ${res.status}`);
  }
  return res.json() as Promise<ProjectBase[]>;
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
