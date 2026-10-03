import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceMembersSettings } from '@/components/workspace/WorkspaceMembersSettings';

export const Route = createFileRoute('/_app/_protected/$workspace/settings/members')({
  component: WorkspaceMembersSettings,
});
