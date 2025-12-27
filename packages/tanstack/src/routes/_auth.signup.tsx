import { createFileRoute } from '@tanstack/solid-router'
import SignUp from '@components/auth/SignUp'

export const Route = createFileRoute('/_auth/signup')({
  component: SignUp,
})
