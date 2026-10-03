import { createFileRoute } from '@tanstack/react-router';
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings';

export const Route = createFileRoute('/_app/_protected/settings/account/integrations')({
  component: IntegrationsSettings,
});
