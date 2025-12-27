import { createFileRoute } from '@tanstack/solid-router'
import ProjectView from '@components/project/ProjectView'

export const Route = createFileRoute('/_app/projects/$projectId')({
  component: ProjectView,
})
