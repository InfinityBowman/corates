/**
 * useWorkspaces - the workspaces the current user belongs to, owned first.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { getMyWorkspaces } from '@/server/functions/workspaces.functions';

export type Workspace = Awaited<ReturnType<typeof getMyWorkspaces>>[number];

export function useWorkspaces() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);

  const query = useQuery({
    queryKey: queryKeys.workspaces.list,
    queryFn: () => getMyWorkspaces(),
    enabled: isLoggedIn && !isAuthLoading,
    ...QUERY_STABLE,
  });

  return {
    workspaces: query.data ?? [],
    isLoading: isAuthLoading || query.isLoading,
    error: query.error,
  };
}

/**
 * The workspace the user is working in.
 * TODO(agent): PR 3 of #688 reads this from the URL slug. Until then it is the
 * workspace the user owns, which is where their own projects and billing live.
 */
export function useCurrentWorkspace() {
  const { workspaces, isLoading } = useWorkspaces();
  return {
    workspace: workspaces.find(w => w.role === 'owner') ?? workspaces[0] ?? null,
    isLoading,
  };
}
