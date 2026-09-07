/**
 * AppLayout - sidebar + content area for all app routes.
 *
 * The sidebar is the only chrome: account menu, Inbox, projects and local
 * appraisals all live there. Desktop can hide it (visibility and width are
 * persisted); mobile gets a slim bar that toggles the slide-in overlay.
 */

import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Outlet } from '@tanstack/react-router';
import { PanelLeftOpenIcon } from 'lucide-react';
import { useAdminStore } from '@/stores/adminStore';
import { useAuthStore, selectUser, selectIsAuthLoading } from '@/stores/authStore';
import { useMembershipSync } from '@/hooks/useMembershipSync';
import { connectionPool } from '@/project/ConnectionPool';
import { LOCAL_PROJECT_ID } from '@/project/localProject';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PaymentIssueBanner } from '@/components/billing/PaymentIssueBanner';
import { Sidebar } from './Sidebar';
import { MobileBar } from './MobileBar';

const SIDEBAR_VISIBLE_KEY = 'corates-sidebar-visible';
const SIDEBAR_WIDTH_KEY = 'corates-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;
// Lazy load admin components
const ImpersonationBanner = lazy(() =>
  import('./ImpersonationBanner').then(m => ({ default: m.ImpersonationBanner })),
);

export function AppLayout() {
  // Real-time membership sync via WebSocket
  useMembershipSync();

  // Acquire the local-practice session once for the app session. Kept
  // refcounted so it persists across route changes; never released.
  useEffect(() => {
    const entry = connectionPool.acquire(LOCAL_PROJECT_ID);
    if (entry && !entry.initialized) {
      connectionPool.initializeConnection(LOCAL_PROJECT_ID, entry, {
        isLocal: true,
        cancelled: () => false,
      });
    }
  }, []);

  const user = useAuthStore(selectUser);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);
  const isImpersonating = useAdminStore(s => s.isImpersonating);
  const checkAdminStatus = useAdminStore(s => s.checkAdminStatus);
  const checkImpersonationStatus = useAdminStore(s => s.checkImpersonationStatus);

  // The store resets on the full-page reload that impersonateUser/stopImpersonation
  // trigger, so re-derive impersonation state from the session on mount.
  useEffect(() => {
    checkAdminStatus();
    checkImpersonationStatus();
  }, [checkAdminStatus, checkImpersonationStatus]);

  // Cache the display name so the account menu can show it before the session resolves
  useEffect(() => {
    if (user) {
      localStorage.setItem('userName', user.name || '');
    } else if (!isAuthLoading) {
      localStorage.removeItem('userName');
    }
  }, [user, isAuthLoading]);

  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(
    () => localStorage.getItem(SIDEBAR_VISIBLE_KEY) !== 'false',
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  const setDesktopVisible = useCallback((visible: boolean) => {
    setDesktopSidebarVisible(visible);
    localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(visible));
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

      <MobileBar open={mobileSidebarOpen} onToggle={toggleMobileSidebar} />

      <div className='flex flex-1 overflow-hidden'>
        <Sidebar
          desktopVisible={desktopSidebarVisible}
          mobileOpen={mobileSidebarOpen}
          onHideDesktop={() => setDesktopVisible(false)}
          onCloseMobile={closeMobileSidebar}
          width={sidebarWidth}
          onWidthChange={handleWidthChange}
        />

        {/* Own column rather than an overlay: pages with sticky headers would cover it */}
        {!desktopSidebarVisible && (
          <div className='border-border bg-sidebar hidden w-10 shrink-0 flex-col items-center border-r pt-2 md:flex'>
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => setDesktopVisible(true)}
                  className='text-muted-foreground'
                  aria-label='Show sidebar'
                >
                  <PanelLeftOpenIcon className='size-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent side='right'>Show sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        <main className='text-foreground flex flex-1 flex-col overflow-auto'>
          <PaymentIssueBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
