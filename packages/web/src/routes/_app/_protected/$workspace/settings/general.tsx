import { createFileRoute } from '@tanstack/react-router';
import { WorkspaceGeneralSettings } from '@/components/workspace/WorkspaceGeneralSettings';

export const Route = createFileRoute('/_app/_protected/$workspace/settings/general')({
  component: WorkspaceGeneralSettings,
});
