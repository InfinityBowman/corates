/**
 * Project checklist route - /projects/:projectId/studies/:studyId/checklists/:checklistId
 * Renders the checklist editor within the project context (Yjs-backed)
 */

import { createFileRoute } from '@tanstack/react-router';
import { ChecklistYjsWrapper } from '@/components/checklist/ChecklistYjsWrapper';

export const Route = createFileRoute(
  '/_app/_protected/projects/$projectId/studies/$studyId/checklists/$checklistId',
)({
  component: ProjectChecklistPage,
});

function ProjectChecklistPage() {
  const { projectId, studyId, checklistId } = Route.useParams();
  return (
    <ChecklistYjsWrapper
      projectId={projectId}
      studyId={studyId}
      checklistId={checklistId}
    />
  );
}
