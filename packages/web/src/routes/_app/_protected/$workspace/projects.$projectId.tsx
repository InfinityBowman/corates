/**
 * Project layout route - renders the full project view with its sync
 * connection. The slug in a project URL is cosmetic (the project id alone
 * identifies the workspace), so a wrong slug, from an old link or a renamed
 * workspace, is replaced with the project's own.
 */

import { useEffect } from 'react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import { ProjectView } from '@/components/project/ProjectView';
import { RouteError } from '@/components/RouteError';
import { PageLoader } from '@/components/ui/spinner';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useRedirectIfCurrent } from '@/hooks/useRedirectIfCurrent';
import { clientLogger } from '@/lib/clientLogger';

export const Route = createFileRoute('/_app/_protected/$workspace/projects/$projectId')({
  component: ProjectLayout,
  errorComponent: RouteError,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const orgId = useProjectOrgId(projectId);
  const { workspaces } = useWorkspaces();
  const owningSlug = orgId ? workspaces.find(w => w.id === orgId)?.slug : undefined;
  const { pathname, searchStr } = useLocation();
  const redirect = useRedirectIfCurrent();
  // Read the slug from the path being rewritten, not the route params: mid
  // transition they can still hold the previous URL's slug.
  const urlSlug = pathname.split('/')[1];
  const wrongSlug = !!owningSlug && owningSlug !== urlSlug;

  useEffect(() => {
    if (!wrongSlug) return;
    clientLogger.info('client.workspace.slug_corrected');
    redirect(`${pathname.replace(/^\/[^/]+/, `/${owningSlug}`)}${searchStr}`);
  }, [wrongSlug, owningSlug, pathname, searchStr]); // eslint-disable-line react-hooks/exhaustive-deps

  if (wrongSlug) return <PageLoader label='Opening project...' />;
  return <ProjectView projectId={projectId} />;
}
