/**
 * Workspace settings layout. Account settings live outside the slug at
 * /settings/account, since they belong to the person, not the workspace.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected/$workspace/settings')({
  component: WorkspaceSettingsLayout,
  errorComponent: RouteError,
});

function WorkspaceSettingsLayout() {
  return (
    <div className='bg-background flex flex-1 flex-col'>
      <Outlet />
    </div>
  );
}
