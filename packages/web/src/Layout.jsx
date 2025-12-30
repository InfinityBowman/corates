import { createSignal, onMount } from 'solid-js';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/sidebar/Sidebar.jsx';
import { Toaster } from '@corates/ui';
import { ImpersonationBanner } from '@/components/admin/index.js';
import { isImpersonating } from '@/stores/adminStore.js';

const SIDEBAR_MODE_KEY = 'corates-sidebar-mode';
const LEGACY_SIDEBAR_KEY = 'corates-sidebar-open';

export default function MainLayout(props) {
  // Desktop sidebar mode: 'expanded' or 'collapsed' (rail)
  const [desktopSidebarMode, setDesktopSidebarMode] = createSignal('collapsed');
  // Mobile sidebar open state (overlay behavior)
  const [mobileSidebarOpen, setMobileSidebarOpen] = createSignal(false);

  onMount(() => {
    // Try new key first, fall back to legacy key for migration
    const storedMode = localStorage.getItem(SIDEBAR_MODE_KEY);
    if (storedMode === 'expanded' || storedMode === 'collapsed') {
      setDesktopSidebarMode(storedMode);
    } else {
      // Migrate from legacy boolean key
      const legacyValue = localStorage.getItem(LEGACY_SIDEBAR_KEY);
      if (legacyValue === 'true') {
        setDesktopSidebarMode('expanded');
        localStorage.setItem(SIDEBAR_MODE_KEY, 'expanded');
      } else {
        setDesktopSidebarMode('collapsed');
        localStorage.setItem(SIDEBAR_MODE_KEY, 'collapsed');
      }
      // Clean up legacy key
      localStorage.removeItem(LEGACY_SIDEBAR_KEY);
    }
  });

  const toggleDesktopSidebar = () => {
    const newMode = desktopSidebarMode() === 'expanded' ? 'collapsed' : 'expanded';
    setDesktopSidebarMode(newMode);
    localStorage.setItem(SIDEBAR_MODE_KEY, newMode);
  };

  const openMobileSidebar = () => setMobileSidebarOpen(true);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <div
      class={`flex h-screen flex-col overflow-hidden bg-blue-50 ${isImpersonating() ? 'pt-10' : ''}`}
    >
      <ImpersonationBanner />
      <Navbar openMobileSidebar={openMobileSidebar} />
      <div class='flex flex-1 overflow-hidden'>
        <Sidebar
          desktopMode={desktopSidebarMode()}
          mobileOpen={mobileSidebarOpen()}
          onToggleDesktop={toggleDesktopSidebar}
          onCloseMobile={closeMobileSidebar}
        />
        <main class='flex-1 overflow-auto text-gray-900'>{props.children}</main>
      </div>
      <Toaster />
    </div>
  );
}
