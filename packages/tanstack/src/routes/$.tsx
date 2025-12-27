import { createFileRoute } from '@tanstack/solid-router'
import NotFoundPage from '@components/NotFoundPage'

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
})
