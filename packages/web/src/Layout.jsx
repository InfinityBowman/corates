import { createSignal, onMount, createMemo, Show, lazy } from 'solid-js';
import { useLocation } from '@solidjs/router';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import { Toaster } from '@corates/ui';
import { isImpersonating } from '@/stores/adminStore.js';

// Lazy load admin components to avoid bundling admin code for non-admins
const ImpersonationBanner = lazy(() => import('@/components/admin/ImpersonationBanner.jsx'));
import { useMembershipSync } from '@/primitives/useMembershipSync.js';

// Dev panel - lazily loaded only in dev mode
const DevPanel = lazy(() => import('@/components/dev/DevPanel.jsx'));
const DEV_PANEL_ENABLED = import.meta.env.VITE_DEV_PANEL === 'true';

const SIDEBAR_MODE_KEY = 'corates-sidebar-mode';
const SIDEBAR_WIDTH_KEY = 'corates-sidebar-width';

const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;

/**
 * Layout - Single layout that handles both sidebar and no-sidebar routes
 * Keeps Navbar mounted across route changes to prevent flashing
 */
export default function Layout(props) {
  // Set up real-time membership sync
  useMembershipSync();

  const location = useLocation();

  // Routes that should NOT show the sidebar
  const shouldHideSidebar = createMemo(() => {
    const path = location.pathname;
    return path.startsWith('/admin') || path.startsWith('/settings') || path === '/profile';
  });

  // Desktop sidebar mode: 'expanded' or 'collapsed' (rail)
  const [desktopSidebarMode, setDesktopSidebarMode] = createSignal('collapsed');
  // Mobile sidebar open state (overlay behavior)
  const [mobileSidebarOpen, setMobileSidebarOpen] = createSignal(false);
  // Sidebar width (only applies when expanded)
  const [sidebarWidth, setSidebarWidth] = createSignal(DEFAULT_SIDEBAR_WIDTH);

  onMount(() => {
    // Load sidebar width
    const storedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (storedWidth) {
      const parsed = parseInt(storedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(parsed);
      }
    }

    // Load sidebar mode
    const storedMode = localStorage.getItem(SIDEBAR_MODE_KEY);
    if (storedMode === 'expanded' || storedMode === 'collapsed') {
      setDesktopSidebarMode(storedMode);
    }
  });

  const handleWidthChange = newWidth => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
    setSidebarWidth(clamped);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
  };

  const toggleDesktopSidebar = () => {
    const newMode = desktopSidebarMode() === 'expanded' ? 'collapsed' : 'expanded';
    setDesktopSidebarMode(newMode);
    localStorage.setItem(SIDEBAR_MODE_KEY, newMode);
  };

  const toggleMobileSidebar = () => setMobileSidebarOpen(open => !open);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <div
      class={`flex h-screen flex-col overflow-hidden bg-blue-50 ${isImpersonating() ? 'pt-10' : ''}`}
    >
      <ImpersonationBanner />
      <Navbar
        mobileSidebarOpen={shouldHideSidebar() ? undefined : mobileSidebarOpen()}
        toggleMobileSidebar={shouldHideSidebar() ? undefined : toggleMobileSidebar}
      />
      <div class='flex flex-1 overflow-hidden'>
        <Show when={!shouldHideSidebar()}>
          <Sidebar
            desktopMode={desktopSidebarMode()}
            mobileOpen={mobileSidebarOpen()}
            onToggleDesktop={toggleDesktopSidebar}
            onCloseMobile={closeMobileSidebar}
            width={sidebarWidth()}
            onWidthChange={handleWidthChange}
          />
        </Show>
        <main class='flex-1 overflow-auto text-gray-900'>{props.children}</main>
      </div>
      <Toaster />
      {/* Dev Panel - global, context-aware */}
      <Show when={DEV_PANEL_ENABLED}>
        <DevPanel />
      </Show>
    </div>
  );
}
