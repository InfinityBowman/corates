import { createFileRoute } from '@tanstack/solid-router'
import { AdminDashboard } from '@components/admin'

export const Route = createFileRoute('/_app/_protected/admin')({
  component: AdminDashboard,
})
