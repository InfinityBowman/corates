/**
 * Project layout route - renders project view or child routes (setup, checklists).
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
