import { createFileRoute } from '@tanstack/solid-router'
import SignIn from '@components/auth/SignIn'

export const Route = createFileRoute('/_auth/signin')({
  component: SignIn,
})
