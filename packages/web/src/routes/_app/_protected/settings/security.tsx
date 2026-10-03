import { createFileRoute } from '@tanstack/react-router';
import { SecuritySettings } from '@/components/settings/SecuritySettings';

export const Route = createFileRoute('/_app/_protected/settings/security')({
  component: SecuritySettings,
});
