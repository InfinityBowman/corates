/**
 * Project setup route - /projects/:projectId/setup
 * First-run setup for a new project, owner-only.
 */

import { createFileRoute } from '@tanstack/react-router';
import { ProjectSetupView } from '@/components/project/setup/ProjectSetupView';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected/projects/$projectId/setup')({
  component: ProjectSetupPage,
  errorComponent: RouteError,
});

function ProjectSetupPage() {
  const { projectId } = Route.useParams();
  return <ProjectSetupView projectId={projectId} />;
}
