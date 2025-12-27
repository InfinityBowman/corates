import { createFileRoute } from '@tanstack/solid-router'
import SettingsPage from '@components/profile/SettingsPage'

export const Route = createFileRoute('/_app/_protected/settings')({
  component: SettingsPage,
})
