/**
 * AppLayout - Main application layout with navbar + sidebar + content area
 *
 * Manages sidebar state (desktop mode, mobile overlay, width) with localStorage persistence.
 * Hides sidebar on /admin and /settings routes (they have their own sidebars).
 */

import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Outlet, useLocation } from '@tanstack/react-router';
import { useAdminStore } from '@/stores/adminStore';
import { useMembershipSync } from '@/hooks/useMembershipSync';
import { connectionPool } from '@/project/ConnectionPool';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import { AppNavbar } from './AppNavbar';
import { Sidebar } from './Sidebar';

const SIDEBAR_MODE_KEY = 'corates-sidebar-mode';
const SIDEBAR_WIDTH_KEY = 'corates-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;

// Lazy load admin components
const ImpersonationBanner = lazy(() =>
  import('./ImpersonationBanner').then(m => ({ default: m.ImpersonationBanner })),
);

export function AppLayout() {
  // Real-time membership sync via WebSocket
  useMembershipSync();

  // Acquire the local-practice Y.Doc once for the app session. Kept refcounted
  // so the Y.Doc persists across route changes; never released.
  useEffect(() => {
    const existing = connectionPool.getEntry(LOCAL_PROJECT_ID);
    if (existing?.initialized) return;
    const entry = connectionPool.acquire(LOCAL_PROJECT_ID);
    if (entry && !entry.initialized) {
      connectionPool.initializeConnection(LOCAL_PROJECT_ID, entry, {
        isLocal: true,
        cancelled: () => false,
      });
    }
  }, []);

  const location = useLocation();
  const isImpersonating = useAdminStore(s => s.isImpersonating);

  // Routes that should NOT show the main sidebar
  const shouldHideSidebar =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/settings');

  // Desktop sidebar mode with localStorage persistence
  const [desktopSidebarMode, setDesktopSidebarMode] = useState<'expanded' | 'collapsed'>(() => {
    const stored = localStorage.getItem(SIDEBAR_MODE_KEY);
    return stored === 'expanded' ? 'expanded' : 'collapsed';
  });

  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sidebar width with localStorage persistence
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        return parsed;
      }
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  const handleWidthChange = useCallback((newWidth: number) => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
    setSidebarWidth(clamped);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
  }, []);

  const toggleDesktopSidebar = useCallback(() => {
    setDesktopSidebarMode(prev => {
      const next = prev === 'expanded' ? 'collapsed' : 'expanded';
      localStorage.setItem(SIDEBAR_MODE_KEY, next);
      return next;
    });
  }, []);

  const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen(prev => !prev), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  return (
    <div
      className={`bg-background flex h-screen flex-col overflow-hidden ${isImpersonating ? 'pt-10' : ''}`}
    >
      {isImpersonating && (
        <Suspense>
          <ImpersonationBanner />
        </Suspense>
      )}

      <AppNavbar
        mobileSidebarOpen={shouldHideSidebar ? undefined : mobileSidebarOpen}
        toggleMobileSidebar={shouldHideSidebar ? undefined : toggleMobileSidebar}
      />

      <div className='flex flex-1 overflow-hidden'>
        {!shouldHideSidebar && (
          <Sidebar
            desktopMode={desktopSidebarMode}
            mobileOpen={mobileSidebarOpen}
            onToggleDesktop={toggleDesktopSidebar}
            onCloseMobile={closeMobileSidebar}
            width={sidebarWidth}
            onWidthChange={handleWidthChange}
          />
        )}

        <main className='text-foreground flex-1 overflow-auto'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
