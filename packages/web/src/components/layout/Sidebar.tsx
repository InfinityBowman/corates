/**
 * Sidebar - Desktop (resizable, can be hidden) + Mobile (slide-in overlay)
 *
 * Both render the same body: the app sidebar normally, or the settings or
 * admin sidebar while on those routes.
 */

import { useState, useEffect, useCallback, useEffectEvent } from 'react';
import { useLocation } from '@tanstack/react-router';
import { createPortal } from 'react-dom';
import { PanelLeftCloseIcon, XIcon } from 'lucide-react';
import { AdminSidebar } from './sidebar/AdminSidebar';
import { AppSidebar } from './sidebar/AppSidebar';
import { SettingsSidebar } from './sidebar/SettingsSidebar';

interface SidebarProps {
  desktopVisible: boolean;
  mobileOpen: boolean;
  onHideDesktop: () => void;
  onCloseMobile: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export function Sidebar({
  desktopVisible,
  mobileOpen,
  onHideDesktop,
  onCloseMobile,
  width,
  onWidthChange,
}: SidebarProps) {
  const { pathname } = useLocation();
  const [isResizing, setIsResizing] = useState(false);
  const isSettings = pathname.startsWith('/settings');
  const isAdmin = pathname.startsWith('/admin');

  // Close mobile on escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Close mobile on route change. Reads mobileOpen through an event so the
  // effect depends on the pathname alone; with mobileOpen as a dep, opening
  // the sidebar re-ran the effect and closed it immediately.
  const closeMobileOnNavigate = useEffectEvent(() => {
    if (mobileOpen) onCloseMobile();
  });
  useEffect(() => {
    closeMobileOnNavigate();
  }, [pathname]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        onWidthChange(startWidth + (moveEvent.clientX - startX));
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
    },
    [width, onWidthChange],
  );

  function renderBody(onClose: () => void, closeLabel: string, closeIcon: React.ReactNode) {
    if (isSettings) {
      return <SettingsSidebar onClose={onClose} closeLabel={closeLabel} closeIcon={closeIcon} />;
    }
    if (isAdmin) {
      return <AdminSidebar onClose={onClose} closeLabel={closeLabel} closeIcon={closeIcon} />;
    }
    return <AppSidebar onClose={onClose} closeLabel={closeLabel} closeIcon={closeIcon} />;
  }

  return (
    <>
      {/* Desktop sidebar */}
      {desktopVisible && (
        <div
          className={`border-border bg-sidebar relative hidden h-full shrink-0 border-r md:block ${
            isResizing ? 'select-none' : ''
          }`}
          style={{ width: `${width}px`, maxWidth: '100vw' }}
        >
          {renderBody(onHideDesktop, 'Hide sidebar', <PanelLeftCloseIcon className='size-4' />)}
          <div
            className='hover:bg-primary absolute top-0 right-0 hidden h-full w-1 cursor-col-resize bg-transparent transition-colors md:block'
            onMouseDown={handleResizeStart}
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize sidebar'
          />
        </div>
      )}

      {/* Mobile overlay -- panel always mounted for the CSS slide transition */}
      {createPortal(
        <div className='md:hidden' aria-hidden={!mobileOpen} inert={!mobileOpen ? true : undefined}>
          <div
            className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
              mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={onCloseMobile}
          />
          <div
            className={`bg-sidebar fixed inset-y-0 left-0 z-50 w-64 shadow-xl transition-transform duration-200 ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
          >
            {/* Body mounts only while open so the app renders one sidebar at a time */}
            {mobileOpen && renderBody(onCloseMobile, 'Close sidebar', <XIcon className='size-4' />)}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
