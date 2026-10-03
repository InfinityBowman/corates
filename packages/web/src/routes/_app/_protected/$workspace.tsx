/**
 * Workspace layout - project pages and workspace settings live under the
 * workspace slug (/<slug>/projects/..., /<slug>/settings/...). Home stays at
 * /dashboard. The slug resolves against the user's own workspace list, so an
 * unknown slug and a workspace they are not in look the same.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { PageLoader } from '@/components/ui/spinner';
import { RouteError } from '@/components/RouteError';
import { WorkspaceNotFound } from '@/components/workspace/WorkspaceNotFound';
import { useWorkspaces } from '@/hooks/useWorkspaces';

export const Route = createFileRoute('/_app/_protected/$workspace')({
  component: WorkspaceLayout,
  errorComponent: RouteError,
});

function WorkspaceLayout() {
  const { workspace: slug } = Route.useParams();
  const { workspaces, isLoading } = useWorkspaces();
  const workspace = workspaces.find(w => w.slug === slug);

  if (isLoading) return <PageLoader label='Loading workspace...' />;
  if (!workspace) return <WorkspaceNotFound />;
  return <Outlet />;
}
