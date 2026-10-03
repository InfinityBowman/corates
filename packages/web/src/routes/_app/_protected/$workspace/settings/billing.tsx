import { createFileRoute } from '@tanstack/react-router';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { OwnerOnly } from '@/components/workspace/OwnerOnly';

export const Route = createFileRoute('/_app/_protected/$workspace/settings/billing')({
  component: () => (
    <OwnerOnly title='Billing'>
      <BillingSettings />
    </OwnerOnly>
  ),
});
