/**
 * useWorkspaces - the workspaces the current user belongs to, owned first.
 * useCurrentWorkspace - the one in the URL inside a project or workspace
 * settings, and otherwise the one the user owns. Workspaces stay out of the
 * way: Home lists every project, and "your workspace" means the one you own.
 */

import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { getMyWorkspaces } from '@/server/functions/workspaces.functions';

export type Workspace = Awaited<ReturnType<typeof getMyWorkspaces>>[number];

/** The workspace the user owns, else the first they belong to. */
export function pickDefaultWorkspace(workspaces: Workspace[]): Workspace | null {
  return workspaces.find(w => w.role === 'owner') ?? workspaces[0] ?? null;
}

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

export function useCurrentWorkspace() {
  const { workspaces, isLoading } = useWorkspaces();
  const { workspace: slug } = useParams({ strict: false }) as { workspace?: string };
  const workspace =
    slug !== undefined ?
      (workspaces.find(w => w.slug === slug) ?? null)
    : pickDefaultWorkspace(workspaces);
  return { workspace, isLoading };
}

/** The workspace the user owns: where their new projects go and their plan lives. */
export function useOwnedWorkspace() {
  const { workspaces, isLoading } = useWorkspaces();
  return { workspace: workspaces.find(w => w.role === 'owner') ?? null, isLoading };
}
