import { createSignal } from 'solid-js';
import SettingsSidebar from './SettingsSidebar.jsx';
import { SectionErrorBoundary } from '@components/ErrorBoundary.jsx';

// Share the same localStorage keys as main sidebar so state is unified
const SIDEBAR_MODE_KEY = 'corates-sidebar-mode';
const SIDEBAR_WIDTH_KEY = 'corates-sidebar-width';

const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;

/**
 * Read initial sidebar mode from localStorage synchronously to prevent animation flash.
 * This runs once at module load time.
 */
function getInitialSidebarMode() {
  try {
    const stored = localStorage.getItem(SIDEBAR_MODE_KEY);
    if (stored === 'expanded' || stored === 'collapsed') {
      return stored;
    }
  } catch {
    // localStorage not available (SSR or private browsing)
  }
  return 'collapsed';
}

/**
 * Read initial sidebar width from localStorage synchronously.
 */
function getInitialSidebarWidth() {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
        return parsed;
      }
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

/**
 * SettingsLayout - Layout wrapper for settings pages with sidebar navigation.
 * Shares expand/collapse state with main sidebar via the same localStorage key.
 */
export default function SettingsLayout(props) {
  // Initialize from localStorage synchronously to prevent animation flash
  const [desktopSidebarMode, setDesktopSidebarMode] = createSignal(getInitialSidebarMode());
  const [mobileSidebarOpen, setMobileSidebarOpen] = createSignal(false);
  const [sidebarWidth, setSidebarWidth] = createSignal(getInitialSidebarWidth());

  const handleWidthChange = newWidth => {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
    setSidebarWidth(clamped);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped));
  };

  const toggleDesktopSidebar = () => {
    const newMode = desktopSidebarMode() === 'expanded' ? 'collapsed' : 'expanded';
    setDesktopSidebarMode(newMode);
    // Save to shared key so main sidebar stays in sync
    localStorage.setItem(SIDEBAR_MODE_KEY, newMode);
  };

  // const toggleMobileSidebar = () => setMobileSidebarOpen(open => !open);
  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <div class='flex h-full overflow-hidden'>
      <SettingsSidebar
        desktopMode={desktopSidebarMode()}
        mobileOpen={mobileSidebarOpen()}
        onToggleDesktop={toggleDesktopSidebar}
        onCloseMobile={closeMobileSidebar}
        width={sidebarWidth()}
        onWidthChange={handleWidthChange}
      />
      <main class='flex-1 overflow-auto'>
        <SectionErrorBoundary name='Settings'>{props.children}</SectionErrorBoundary>
      </main>
    </div>
  );
}
