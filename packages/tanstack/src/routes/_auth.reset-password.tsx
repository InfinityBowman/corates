import { createFileRoute } from '@tanstack/solid-router'
import ResetPassword from '@components/auth/ResetPassword'

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPassword,
})
