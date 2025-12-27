import { createFileRoute } from '@tanstack/solid-router'
import StorageManagement from '@components/admin/StorageManagement'

export const Route = createFileRoute('/_app/_protected/admin/storage')({
  component: StorageManagement,
})
