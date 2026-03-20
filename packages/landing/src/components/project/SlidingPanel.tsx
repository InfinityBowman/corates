/**
 * SlidingPanel - GPU-accelerated sliding panel using CSS transforms
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { XIcon } from 'lucide-react';

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[32rem]',
  xl: 'w-[40rem]',
  '2xl': 'w-[48rem]',
};

/* eslint-disable no-unused-vars */
interface SlidingPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  closeOnOutsideClick?: boolean;
  children: React.ReactNode;
}

export function SlidingPanel({
  open,
  onClose,
  title,
  size = 'xl',
  closeOnOutsideClick = true,
  children,
}: SlidingPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mount/animate lifecycle
  useEffect(() => {
    if (open) {
      setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- intentional mount-then-animate pattern
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      setVisible(false);
    }
  }, [open]);

  // Unmount after close animation
  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName === 'transform' && !open) {
        setMounted(false);
      }
    },
    [open],
  );

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Click outside - wait until visible to avoid catching the opening click
  useEffect(() => {
    if (!open || !visible || !closeOnOutsideClick) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, visible, closeOnOutsideClick, onClose]);

  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      className={`bg-card fixed inset-y-0 right-0 z-50 ${SIZE_CLASSES[size] || SIZE_CLASSES.xl} flex flex-col shadow-2xl`}
      style={{
        transform: visible ? 'translateX(0) translateZ(0)' : 'translateX(100%) translateZ(0)',
        transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }}
      onTransitionEnd={handleTransitionEnd}
      role='complementary'
      aria-label={title || 'Side panel'}
    >
      {/* Header */}
      <div className='border-border flex shrink-0 items-center justify-between border-b px-4 py-3'>
        {title && <h2 className='text-foreground truncate pr-4 text-lg font-semibold'>{title}</h2>}
        <button
          type='button'
          onClick={onClose}
          className='text-muted-foreground/70 hover:bg-secondary hover:text-secondary-foreground ml-auto rounded-md p-1.5 transition-colors'
          aria-label='Close panel'
        >
          <XIcon className='size-5' />
        </button>
      </div>

      {/* Content */}
      <div className='min-h-0 flex-1 overflow-hidden'>{children}</div>
    </div>
  );
}
