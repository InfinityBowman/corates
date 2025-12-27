import { createFileRoute } from '@tanstack/solid-router'
import ChecklistYjsWrapper from '@components/checklist/ChecklistYjsWrapper'

export const Route = createFileRoute(
  '/_app/projects/$projectId/studies/$studyId/checklists/$checklistId'
)({
  component: ChecklistYjsWrapper,
})
