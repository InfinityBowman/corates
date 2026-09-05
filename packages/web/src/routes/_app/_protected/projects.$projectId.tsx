/**
 * Project layout route - renders the full project view with Yjs connection,
 * or the setup child route on its own when that matches.
 */

import { createFileRoute, Outlet, useMatch } from '@tanstack/react-router';
import { ProjectView } from '@/components/project/ProjectView';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected/projects/$projectId')({
  component: ProjectLayout,
  errorComponent: RouteError,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  const setupMatch = useMatch({
    from: '/_app/_protected/projects/$projectId/setup',
    shouldThrow: false,
  });

  if (setupMatch) {
    return <Outlet />;
  }

  return <ProjectView projectId={projectId} />;
}
