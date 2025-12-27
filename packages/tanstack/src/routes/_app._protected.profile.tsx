import { createFileRoute } from '@tanstack/solid-router'
import ProfilePage from '@components/profile/ProfilePage'

export const Route = createFileRoute('/_app/_protected/profile')({
  component: ProfilePage,
})
