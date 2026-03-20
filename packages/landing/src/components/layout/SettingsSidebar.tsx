/**
 * SettingsSidebar - Navigation sidebar for settings pages
 * Structurally mirrors the main Sidebar but with 6 static nav items instead of a project tree.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { createPortal } from 'react-dom';
import {
  UserIcon,
  LinkIcon,
  CreditCardIcon,
  ZapIcon,
  ShieldIcon,
  BellIcon,
  ArrowLeftIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  XIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const SETTINGS_NAV_ITEMS: Array<{ id: string; label: string; icon: LucideIcon; path: string }> = [
  { id: 'profile', label: 'Profile', icon: UserIcon, path: '/settings/profile' },
  { id: 'integrations', label: 'Integrations', icon: LinkIcon, path: '/settings/integrations' },
  { id: 'billing', label: 'Billing', icon: CreditCardIcon, path: '/settings/billing' },
  { id: 'plans', label: 'Plans', icon: ZapIcon, path: '/settings/plans' },
  { id: 'security', label: 'Security', icon: ShieldIcon, path: '/settings/security' },
  { id: 'notifications', label: 'Notifications', icon: BellIcon, path: '/settings/notifications' },
];

/* eslint-disable no-unused-vars */
interface SettingsSidebarProps {
  desktopMode: 'expanded' | 'collapsed';
  mobileOpen: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}
/* eslint-enable no-unused-vars */

export function SettingsSidebar({
  desktopMode,
  mobileOpen,
  onToggleDesktop,
  onCloseMobile,
  width,
  onWidthChange,
}: SettingsSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isResizing, setIsResizing] = useState(false);
  const isExpanded = desktopMode === 'expanded';
  const currentPath = location.pathname;

  // Resize drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = width;
      const handleMouseMove = (moveEvent: MouseEvent) =>
        onWidthChange(startWidth + (moveEvent.clientX - startX));
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
    },
    [width, onWidthChange],
  );

  // Close mobile on escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Close mobile on route change
  useEffect(() => {
    if (mobileOpen) onCloseMobile();
  }, [currentPath, mobileOpen, onCloseMobile]);

  function renderNavContent() {
    return (
      <div className='sidebar-scrollbar flex-1 overflow-x-hidden overflow-y-auto'>
        {/* Back to app */}
        <div className='p-2'>
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className='text-muted-foreground hover:bg-secondary hover:text-secondary-foreground flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors'
          >
            <ArrowLeftIcon className='size-4 shrink-0' />
            <span className='truncate'>Back to App</span>
          </button>
        </div>

        <div className='px-3 pt-4 pb-2'>
          <h3 className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
            Settings
          </h3>
        </div>

        <div className='flex flex-col gap-0.5 px-2'>
          {SETTINGS_NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive =
              currentPath === item.path || (item.id === 'profile' && currentPath === '/settings');
            return (
              <button
                key={item.id}
                onClick={() => navigate({ to: item.path as string })}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ?
                    'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'
                }`}
              >
                <Icon className='size-4 shrink-0' />
                <span className='truncate'>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={`sidebar-container border-border bg-card relative hidden h-full shrink-0 border-r md:block ${
          isResizing ? '' : 'transition-all duration-200 ease-in-out'
        } ${isExpanded ? '' : 'md:w-12'}`}
        style={{ maxWidth: '100vw', width: isExpanded ? `${width}px` : undefined }}
      >
        <div className='flex h-full flex-col'>
          {/* Header -- cross-fade between states */}
          <div className='border-border relative shrink-0 border-b'>
            <div
              className={`flex items-center justify-center p-2 transition-opacity duration-200 ${isExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
              aria-hidden={isExpanded}
            >
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleDesktop}
                    className='text-muted-foreground hover:bg-secondary hover:text-secondary-foreground hidden size-8 items-center justify-center rounded-md transition-colors md:flex'
                    aria-label='Expand sidebar'
                  >
                    <ChevronsRightIcon className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='right'>Expand sidebar</TooltipContent>
              </Tooltip>
            </div>
            <div
              className={`absolute inset-0 flex items-center p-2 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              aria-hidden={!isExpanded}
            >
              <span className='text-secondary-foreground flex-1 truncate px-2 text-sm font-semibold'>
                Settings
              </span>
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleDesktop}
                    className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground hidden size-8 items-center justify-center rounded-md transition-colors md:flex'
                    aria-label='Collapse sidebar'
                  >
                    <ChevronsLeftIcon className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='right'>Collapse sidebar</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Content area -- both layers always rendered, cross-fade */}
          <div className='relative flex-1 overflow-hidden'>
            {/* Collapsed rail icons (bottom layer) */}
            <div
              className={`absolute inset-y-0 left-0 hidden w-12 flex-col items-center gap-1 overflow-y-auto py-2 transition-opacity duration-200 md:flex ${isExpanded ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
              aria-hidden={isExpanded}
              inert={isExpanded ? true : undefined}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate({ to: '/dashboard' })}
                    className='text-muted-foreground hover:bg-secondary hover:text-secondary-foreground flex size-8 items-center justify-center rounded-md transition-colors'
                    aria-label='Back to App'
                  >
                    <ArrowLeftIcon className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='right'>Back to App</TooltipContent>
              </Tooltip>
              {SETTINGS_NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate({ to: item.path as string })}
                        className={`flex size-8 items-center justify-center rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground'}`}
                        aria-label={item.label}
                      >
                        <Icon className='size-4' />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side='right'>{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Expanded content (top layer) */}
            <div
              className={`absolute inset-0 transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              aria-hidden={!isExpanded}
              inert={!isExpanded ? true : undefined}
            >
              {renderNavContent()}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div
            className='hover:bg-primary absolute top-0 right-0 hidden h-full w-1 cursor-col-resize bg-transparent transition-colors md:block'
            onMouseDown={handleResizeStart}
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize sidebar'
          />
        )}
      </div>

      {/* Mobile overlay -- always mounted, CSS-only transitions */}
      {createPortal(
        <div className='md:hidden' aria-hidden={!mobileOpen} inert={!mobileOpen ? true : undefined}>
          <div
            className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
              mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={onCloseMobile}
          />
          <div
            className={`bg-card fixed inset-y-0 left-0 z-50 w-64 pt-9 shadow-xl transition-transform duration-200 ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
          >
            <div className='flex h-full flex-col'>
              <div className='border-border bg-card flex shrink-0 items-center border-b p-2'>
                <span className='text-secondary-foreground flex-1 truncate px-2 text-sm font-semibold'>
                  Settings
                </span>
                <button
                  onClick={onCloseMobile}
                  className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground flex size-7 items-center justify-center rounded-md transition-colors'
                  aria-label='Close sidebar'
                >
                  <XIcon className='size-4' />
                </button>
              </div>
              {renderNavContent()}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
