import { createFileRoute } from '@tanstack/react-router';
import { PlansSettings } from '@/components/settings/PlansSettings';

export const Route = createFileRoute('/_app/_protected/settings/plans')({
  component: PlansSettings,
});
