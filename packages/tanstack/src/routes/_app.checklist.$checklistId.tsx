import { createFileRoute } from '@tanstack/solid-router'
import LocalChecklistView from '@components/checklist/LocalChecklistView'

export const Route = createFileRoute('/_app/checklist/$checklistId')({
  component: LocalChecklistView,
})
