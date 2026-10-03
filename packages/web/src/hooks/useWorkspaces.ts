/**
 * useWorkspaces - the workspaces the current user belongs to, owned first.
 * useOwnedWorkspace - the one the user owns. Workspaces stay out of the way:
 * Home lists every project, and "your workspace" (new projects, plan,
 * workspace settings) always means the one you own.
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

/** The workspace the user owns: where their new projects go and their plan lives. */
export function useOwnedWorkspace() {
  const { workspaces, isLoading } = useWorkspaces();
  return { workspace: workspaces.find(w => w.role === 'owner') ?? null, isLoading };
}
