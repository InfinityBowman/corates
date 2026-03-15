/**
 * Project layout route - renders the full project view with Yjs connection
 */

import { createFileRoute } from '@tanstack/react-router';
import { ProjectView } from '@/components/project/ProjectView';

export const Route = createFileRoute('/_app/_protected/projects/$projectId')({
  component: ProjectLayout,
});

function ProjectLayout() {
  const { projectId } = Route.useParams();
  return <ProjectView projectId={projectId} />;
}
