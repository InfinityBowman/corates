import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettings } from '@/components/settings/ProfileSettings';

export const Route = createFileRoute('/_app/_protected/settings/profile')({
  component: ProfileSettings,
});
