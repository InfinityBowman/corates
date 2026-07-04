/**
 * Sidebar label that fades its right edge when the text is too long to fit,
 * then scrolls the full name into view on hover/focus instead of truncating.
 * The scroll distance and duration are derived from the measured overflow so
 * short labels never animate and long labels scroll at a steady pace.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MarqueeLabelProps {
  text: string;
  className?: string;
}

// Pixels per second the text travels while revealing the overflow on hover.
const SCROLL_SPEED = 60;
const MIN_DURATION = 350;
// Extra travel past the overflow so the last characters clear the edge fade
// (keep in sync with the mask width in .sidebar-marquee).
const FADE_CLEARANCE = 20;

export function MarqueeLabel({ text, className }: MarqueeLabelProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;

    const measure = () => {
      const diff = inner.scrollWidth - container.clientWidth;
      setOverflow(diff > 1 ? diff : 0);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [text]);

  const isOverflowing = overflow > 0;
  const shift = overflow + FADE_CLEARANCE;
  const duration = Math.max(MIN_DURATION, (shift / SCROLL_SPEED) * 1000);

  return (
    <span
      ref={containerRef}
      className={cn(
        'block min-w-0 overflow-hidden whitespace-nowrap',
        isOverflowing && 'sidebar-marquee',
        className,
      )}
      style={
        isOverflowing ?
          ({
            '--marquee-shift': `-${shift}px`,
            '--marquee-duration': `${Math.round(duration)}ms`,
          } as React.CSSProperties)
        : undefined
      }
    >
      <span ref={textRef} className='inline-block'>
        {text}
      </span>
    </span>
  );
}
