import { createFileRoute } from '@tanstack/solid-router'
import ReconciliationWrapper from '@components/checklist/compare/ReconciliationWrapper'

export const Route = createFileRoute(
  '/_app/projects/$projectId/studies/$studyId/reconcile/$checklist1Id/$checklist2Id'
)({
  component: ReconciliationWrapper,
})
