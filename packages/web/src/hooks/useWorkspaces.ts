/**
 * useWorkspaces - the workspaces the current user belongs to, owned first.
 * useCurrentWorkspace - the one in the URL, or the last used outside a
 * workspace URL (account settings, the /dashboard redirect).
 */

import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys';
import { QUERY_STABLE } from '@/lib/queryPresets';
import { getMyWorkspaces } from '@/server/functions/workspaces.functions';

export type Workspace = Awaited<ReturnType<typeof getMyWorkspaces>>[number];

const LAST_WORKSPACE_KEY = 'corates-last-workspace';

export function rememberWorkspace(slug: string) {
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, slug);
  } catch {
    // Private mode or blocked storage: the owned-workspace fallback still works.
  }
}

/** Last used if still a member, then the one they own, then the first. */
export function pickDefaultWorkspace(workspaces: Workspace[]): Workspace | null {
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_WORKSPACE_KEY);
  } catch {
    last = null;
  }
  return (
    workspaces.find(w => w.slug === last) ??
    workspaces.find(w => w.role === 'owner') ??
    workspaces[0] ??
    null
  );
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
