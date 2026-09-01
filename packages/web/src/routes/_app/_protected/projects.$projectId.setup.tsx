/**
 * Project setup route - full-viewport first-run wizard for new projects.
 */

import { createFileRoute } from '@tanstack/react-router';
import { ProjectSetupView } from '@/components/project/setup/ProjectSetupView';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected/projects/$projectId/setup')({
  component: ProjectSetupRoute,
  errorComponent: RouteError,
});

function ProjectSetupRoute() {
  const { projectId } = Route.useParams();
  return <ProjectSetupView projectId={projectId} />;
}
