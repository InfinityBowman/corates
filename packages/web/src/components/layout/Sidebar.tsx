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
import { SIDEBAR_SLIDE, SIDEBAR_SLIDE_MS } from './sidebarMotion';
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

  // The desktop panel stays in the DOM so its width can animate, but the body
  // unmounts once the slide finishes to drop its queries while hidden.
  const [desktopBodyMounted, setDesktopBodyMounted] = useState(desktopVisible);
  useEffect(() => {
    if (desktopVisible) {
      setDesktopBodyMounted(true);
      return;
    }
    const timer = setTimeout(() => setDesktopBodyMounted(false), SIDEBAR_SLIDE_MS);
    return () => clearTimeout(timer);
  }, [desktopVisible]);

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
      {/* Desktop sidebar -- outer clips while the panel slides out from under it */}
      <div
        className={`hidden h-full shrink-0 overflow-hidden md:block ${
          isResizing ? '' : `transition-[width] ${SIDEBAR_SLIDE}`
        }`}
        style={{ width: desktopVisible ? `${width}px` : 0, maxWidth: '100vw' }}
        aria-hidden={!desktopVisible}
        inert={!desktopVisible ? true : undefined}
      >
        <div
          className={`border-border bg-sidebar relative h-full border-r ${
            isResizing ? 'select-none' : `transition-transform ${SIDEBAR_SLIDE}`
          }`}
          style={{
            width: `${width}px`,
            transform: desktopVisible ? undefined : `translateX(-${width}px)`,
          }}
        >
          {desktopBodyMounted &&
            renderBody(onHideDesktop, 'Hide sidebar', <PanelLeftCloseIcon className='size-4' />)}
          <div
            className='hover:bg-primary absolute top-0 right-0 hidden h-full w-1 cursor-col-resize bg-transparent transition-colors md:block'
            onMouseDown={handleResizeStart}
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize sidebar'
          />
        </div>
      </div>

      {/* Mobile overlay -- panel always mounted for the CSS slide transition */}
      {createPortal(
        <div className='md:hidden' aria-hidden={!mobileOpen} inert={!mobileOpen ? true : undefined}>
          <div
            className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${SIDEBAR_SLIDE} ${
              mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={onCloseMobile}
          />
          <div
            className={`bg-sidebar fixed inset-y-0 left-0 z-50 w-64 shadow-xl transition-transform ${SIDEBAR_SLIDE} ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
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
