import { createFileRoute, Outlet } from '@tanstack/solid-router'
import ProtectedGuard from '@components/auth/ProtectedGuard.jsx'

export const Route = createFileRoute('/_protected')({
  component: () => (
    <ProtectedGuard>
      <Outlet />
    </ProtectedGuard>
  ),
})
