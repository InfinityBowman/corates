import { createFileRoute } from '@tanstack/solid-router'
import Dashboard from '@components/Dashboard'

export const Route = createFileRoute('/_app/dashboard')({
  component: Dashboard,
})
