import { createFileRoute } from '@tanstack/solid-router'
import CompleteProfile from '@components/auth/CompleteProfile'

export const Route = createFileRoute('/_auth/complete-profile')({
  component: CompleteProfile,
})
