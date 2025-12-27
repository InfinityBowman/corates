import { createFileRoute } from '@tanstack/solid-router'
import CheckEmail from '@components/auth/CheckEmail'

export const Route = createFileRoute('/_auth/check-email')({
  component: CheckEmail,
})
