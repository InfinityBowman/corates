import { createFileRoute } from '@tanstack/solid-router'
import BillingPage from '@components/billing/BillingPage'

export const Route = createFileRoute('/_app/_protected/settings/billing')({
  component: BillingPage,
})
