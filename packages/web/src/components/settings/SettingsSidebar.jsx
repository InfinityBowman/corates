import { Show, For, createSignal, createEffect, onCleanup } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { Portal } from 'solid-js/web';
import {
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  FiChevronsLeft,
  FiChevronsRight,
  FiX,
  FiCreditCard,
  FiZap,
  FiShield,
  FiBell,
  FiLink,
  FiUser,
  FiArrowLeft,
} from 'solid-icons/fi';

/**
 * Settings navigation items
 */
const SETTINGS_NAV_ITEMS = [
  { id: 'profile', label: 'Profile', icon: FiUser, path: '/settings/profile' },
  { id: 'integrations', label: 'Integrations', icon: FiLink, path: '/settings/integrations' },
  { id: 'billing', label: 'Billing', icon: FiCreditCard, path: '/settings/billing' },
  { id: 'plans', label: 'Plans', icon: FiZap, path: '/settings/plans' },
  { id: 'security', label: 'Security', icon: FiShield, path: '/settings/security' },
  { id: 'notifications', label: 'Notifications', icon: FiBell, path: '/settings/notifications' },
];

/**
 * SettingsSidebar component for settings page navigation.
 * Desktop: always visible as expanded (resizable) or collapsed rail (w-12).
 * Mobile: overlay that slides in when mobileOpen is true.
 *
 * @param {Object} props
 * @param {'expanded' | 'collapsed'} props.desktopMode - Desktop sidebar mode
 * @param {boolean} props.mobileOpen - Whether mobile overlay is open
 * @param {() => void} props.onToggleDesktop - Toggle desktop mode
 * @param {() => void} props.onCloseMobile - Close mobile overlay
 * @param {number} props.width - Sidebar width in pixels (when expanded)
 * @param {(width: number) => void} props.onWidthChange - Callback when width changes
 */
export default function SettingsSidebar(props) {
  const navigate = useNavigate();
  const location = useLocation();

  // Resize state
  const [isResizing, setIsResizing] = createSignal(false);

  // Mobile overlay mount/animate state
  const [mobileMounted, setMobileMounted] = createSignal(false);
  const [mobileVisible, setMobileVisible] = createSignal(false);

  const isExpanded = () => props.desktopMode === 'expanded';
  const showExpandedContent = () => isExpanded() || mobileMounted();

  // Check if a path is current (supports partial matching for nested routes)
  const isCurrentPath = path => {
    const currentPath = location.pathname;
    if (path === '/settings') {
      return currentPath === '/settings';
    }
    return currentPath.startsWith(path);
  };

  // Handle resize drag
  const handleResizeStart = e => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = props.width;

    const handleMouseMove = moveEvent => {
      const delta = moveEvent.clientX - startX;
      props.onWidthChange?.(startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Close mobile sidebar on escape key
  createEffect(() => {
    if (!props.mobileOpen) return;
    const handleKeyDown = e => {
      if (e.key === 'Escape') props.onCloseMobile?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  // Close mobile sidebar when route changes
  let lastPathname = location.pathname;
  createEffect(() => {
    const currentPathname = location.pathname;
    if (props.mobileOpen && currentPathname !== lastPathname) {
      props.onCloseMobile?.();
    }
    lastPathname = currentPathname;
  });

  // Sync mobile overlay mount/visible state
  createEffect(() => {
    if (props.mobileOpen) {
      setMobileMounted(true);
      requestAnimationFrame(() => setMobileVisible(true));
      return;
    }

    setMobileVisible(false);
    const timer = setTimeout(() => setMobileMounted(false), 200);
    onCleanup(() => clearTimeout(timer));
  });

  // Render navigation items
  const renderNavItems = () => (
    <div class='space-y-1 px-2'>
      <For each={SETTINGS_NAV_ITEMS}>
        {item => {
          const Icon = item.icon;
          return (
            <button
              onClick={() => navigate(item.path)}
              class={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isCurrentPath(item.path) ?
                  'bg-primary-subtle text-primary'
                : 'text-secondary-foreground hover:bg-muted'
              }`}
            >
              <Icon class='h-4 w-4 shrink-0' />
              <span class='truncate'>{item.label}</span>
            </button>
          );
        }}
      </For>
    </div>
  );

  // Render collapsed rail icons
  const renderCollapsedIcons = () => (
    <div class='hidden flex-1 flex-col items-center gap-1 overflow-y-auto py-2 md:flex'>
      <For each={SETTINGS_NAV_ITEMS}>
        {item => {
          const Icon = item.icon;
          return (
            <Tooltip positioning={{ placement: 'right' }}>
              <TooltipTrigger>
                <button
                  onClick={() => navigate(item.path)}
                  class={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    isCurrentPath(item.path) ?
                      'bg-primary-subtle text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-secondary-foreground'
                  }`}
                  aria-label={item.label}
                >
                  <Icon class='h-4 w-4' />
                </button>
              </TooltipTrigger>
              <TooltipPositioner>
                <TooltipContent>{item.label}</TooltipContent>
              </TooltipPositioner>
            </Tooltip>
          );
        }}
      </For>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div
        class={`sidebar-container border-border bg-card relative hidden h-full shrink-0 border-r md:block ${isResizing() ? '' : 'transition-all duration-200 ease-in-out'} ${isExpanded() ? '' : 'md:w-12'}`}
        style={{ 'max-width': '100vw', '--sidebar-expanded-width': `${props.width}px` }}
        data-expanded={isExpanded() ? 'true' : 'false'}
      >
        <div class='flex h-full flex-col'>
          {/* Sidebar Header */}
          <div class='border-border-subtle flex shrink-0 items-center border-b p-2'>
            {/* Collapsed: expand button */}
            <Show when={!isExpanded()}>
              <Tooltip positioning={{ placement: 'right' }}>
                <TooltipTrigger>
                  <button
                    onClick={() => props.onToggleDesktop?.()}
                    class='text-muted-foreground hover:bg-muted hover:text-secondary-foreground hidden h-8 w-8 items-center justify-center rounded-md transition-colors md:flex'
                    aria-label='Expand sidebar'
                  >
                    <FiChevronsRight class='h-4 w-4' />
                  </button>
                </TooltipTrigger>
                <TooltipPositioner>
                  <TooltipContent>Expand sidebar</TooltipContent>
                </TooltipPositioner>
              </Tooltip>
            </Show>

            {/* Expanded: title and back link */}
            <Show when={showExpandedContent()}>
              <button
                onClick={() => navigate('/dashboard')}
                class='text-secondary-foreground hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold transition-colors'
              >
                <FiArrowLeft class='h-4 w-4' />
                <span>Back</span>
              </button>
            </Show>

            {/* Expanded: collapse button */}
            <Show when={isExpanded()}>
              <div class='flex-1' />
              <Tooltip positioning={{ placement: 'right' }}>
                <TooltipTrigger>
                  <button
                    onClick={() => props.onToggleDesktop?.()}
                    class='text-muted-foreground hover:bg-muted hover:text-foreground hidden h-7 w-7 items-center justify-center rounded-md transition-colors md:flex'
                    aria-label='Collapse sidebar'
                  >
                    <FiChevronsLeft class='h-4 w-4' />
                  </button>
                </TooltipTrigger>
                <TooltipPositioner>
                  <TooltipContent>Collapse sidebar</TooltipContent>
                </TooltipPositioner>
              </Tooltip>
            </Show>

            {/* Mobile close button */}
            <button
              onClick={() => props.onCloseMobile?.()}
              class='text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors md:hidden'
              aria-label='Close sidebar'
            >
              <FiX class='h-4 w-4' />
            </button>
          </div>

          {/* Expanded content */}
          <Show when={showExpandedContent()}>
            <div class='sidebar-scrollbar flex-1 overflow-x-hidden overflow-y-auto pt-3'>
              {renderNavItems()}
              <div class='h-8' />
            </div>
          </Show>

          {/* Collapsed rail content */}
          <Show when={!isExpanded()}>{renderCollapsedIcons()}</Show>
        </div>

        {/* Resize handle */}
        <Show when={isExpanded()}>
          <div
            class='hover:bg-primary absolute top-0 right-0 hidden h-full w-1 cursor-col-resize bg-transparent transition-colors md:block'
            onMouseDown={handleResizeStart}
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize sidebar'
          />
        </Show>
      </div>

      {/* Mobile overlay */}
      <Show when={mobileMounted()}>
        <Portal>
          {/* Backdrop */}
          <div
            class={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 md:hidden ${
              mobileVisible() ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => props.onCloseMobile?.()}
          />

          {/* Panel */}
          <div
            class='sidebar-container bg-card fixed inset-y-0 left-0 z-50 w-64 shadow-xl md:hidden'
            style={{
              transform: mobileVisible() ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
              'padding-top': '36px',
            }}
          >
            <div class='flex h-full flex-col'>
              {/* Header */}
              <div class='border-border-subtle bg-card flex shrink-0 items-center border-b p-2'>
                <button
                  onClick={() => navigate('/dashboard')}
                  class='text-secondary-foreground hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold transition-colors'
                >
                  <FiArrowLeft class='h-4 w-4' />
                  <span>Settings</span>
                </button>
                <div class='flex-1' />
                <button
                  onClick={() => props.onCloseMobile?.()}
                  class='text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors'
                  aria-label='Close sidebar'
                >
                  <FiX class='h-4 w-4' />
                </button>
              </div>

              {/* Navigation */}
              <div class='sidebar-scrollbar flex-1 overflow-x-hidden overflow-y-auto pt-3'>
                {renderNavItems()}
                <div class='h-8' />
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}
