import { createFileRoute } from '@tanstack/solid-router'
import CreateLocalChecklist from '@components/checklist/CreateLocalChecklist'

export const Route = createFileRoute('/_app/checklist')({
  component: CreateLocalChecklist,
})
