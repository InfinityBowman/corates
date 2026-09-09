/**
 * Settings layout route. The app sidebar swaps to the settings sections while
 * on these routes, so this only frames the page content.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected/settings')({
  component: SettingsLayout,
  errorComponent: RouteError,
});

function SettingsLayout() {
  return (
    <div className='bg-background flex flex-1 flex-col'>
      <Outlet />
    </div>
  );
}
