/**
 * Reconciliation route - /projects/:projectId/studies/:studyId/reconcile/:checklist1Id/:checklist2Id
 * Renders the reconciliation workflow within the project context (Yjs-backed)
 */

import { createFileRoute } from '@tanstack/react-router';
import { ReconciliationWrapper } from '@/components/project/reconcile-tab/ReconciliationWrapper';

export const Route = createFileRoute(
  '/_app/_protected/projects/$projectId/studies/$studyId/reconcile/$checklist1Id/$checklist2Id',
)({
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const { projectId, studyId, checklist1Id, checklist2Id } = Route.useParams();
  return (
    <ReconciliationWrapper
      projectId={projectId}
      studyId={studyId}
      checklist1Id={checklist1Id}
      checklist2Id={checklist2Id}
    />
  );
}
