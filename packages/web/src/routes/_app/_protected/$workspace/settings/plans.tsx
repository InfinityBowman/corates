import { createFileRoute } from '@tanstack/react-router';
import { PlansSettings } from '@/components/settings/PlansSettings';
import { OwnerOnly } from '@/components/workspace/OwnerOnly';

export const Route = createFileRoute('/_app/_protected/$workspace/settings/plans')({
  component: () => (
    <OwnerOnly title='Plans'>
      <PlansSettings />
    </OwnerOnly>
  ),
});
