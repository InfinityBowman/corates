/**
 * Settings layout route - wraps all settings pages with SettingsSidebar
 * Uses the same sidebar state keys as the main layout for consistency.
 */

import { useState, useCallback } from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SettingsSidebar } from '@/components/layout/SettingsSidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

const SIDEBAR_MODE_KEY = 'corates-sidebar-mode';
const SIDEBAR_WIDTH_KEY = 'corates-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;

export const Route = createFileRoute('/_app/_protected/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  const [desktopMode, setDesktopMode] = useState<'expanded' | 'collapsed'>(() => {
    const stored = localStorage.getItem(SIDEBAR_MODE_KEY);
    return stored === 'expanded' ? 'expanded' : 'collapsed';
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH)
        return parsed;
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const handleWidthChange = useCallback((newWidth: number) => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
    setWidth(clamped);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
  }, []);

  const toggleDesktop = useCallback(() => {
    setDesktopMode(prev => {
      const next = prev === 'expanded' ? 'collapsed' : 'expanded';
      localStorage.setItem(SIDEBAR_MODE_KEY, next);
      return next;
    });
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className='flex h-full'>
        <SettingsSidebar
          desktopMode={desktopMode}
          mobileOpen={mobileOpen}
          onToggleDesktop={toggleDesktop}
          onCloseMobile={() => setMobileOpen(false)}
          width={width}
          onWidthChange={handleWidthChange}
        />
        <main className='flex-1 overflow-auto'>
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
