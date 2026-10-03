import { createFileRoute } from '@tanstack/react-router';
import { BillingSettings } from '@/components/settings/BillingSettings';

export const Route = createFileRoute('/_app/_protected/$workspace/settings/billing')({
  component: BillingSettings,
});
