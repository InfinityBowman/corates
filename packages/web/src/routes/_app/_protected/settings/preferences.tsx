import { createFileRoute } from '@tanstack/react-router';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';

export const Route = createFileRoute('/_app/_protected/settings/preferences')({
  component: PreferencesSettings,
});
