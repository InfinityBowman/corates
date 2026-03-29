import { createFileRoute } from '@tanstack/react-router';
import { NotificationsSettings } from '@/components/settings/NotificationsSettings';

export const Route = createFileRoute('/_app/_protected/settings/notifications')({
  component: NotificationsSettings,
});
