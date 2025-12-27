import { createFileRoute, Outlet } from '@tanstack/solid-router'
import AuthLayout from '@components/auth/AuthLayout.jsx'

export const Route = createFileRoute('/_auth')({
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
})
