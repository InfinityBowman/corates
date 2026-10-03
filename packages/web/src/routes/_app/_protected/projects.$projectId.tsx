/**
 * Project layout route - renders the full project view with Yjs connection
 */

import { createFileRoute } from '@tanstack/react-router';
import { ProjectView } from '@/components/project/ProjectView';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected/projects/$projectId')({
  component: ProjectLayout,
  errorComponent: RouteError,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  return <ProjectView projectId={projectId} />;
}
