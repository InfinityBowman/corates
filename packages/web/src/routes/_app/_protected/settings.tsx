/**
 * Settings layout route - nav rail beside the content on desktop, nav strip
 * above it on mobile.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SettingsNavRail, SettingsNavStrip } from '@/components/layout/SettingsNav';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected/settings')({
  component: SettingsLayout,
  errorComponent: RouteError,
});

function SettingsLayout() {
  return (
    <div className='bg-background flex min-h-0 flex-1'>
      <SettingsNavRail />
      <div className='flex min-w-0 flex-1 flex-col overflow-auto'>
        <SettingsNavStrip />
        <Outlet />
      </div>
    </div>
  );
}
