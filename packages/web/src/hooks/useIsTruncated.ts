/**
 * useIsTruncated - reports whether an element's text is clipped by CSS truncation,
 * so a caller can offer the full text only when it is actually cut off.
 *
 * @example
 * const [ref, isTruncated] = useIsTruncated(name);
 * <span ref={ref} className='block truncate'>{name}</span>
 */

import { useEffect, useState } from 'react';

export function useIsTruncated(text: string) {
  // A callback ref, not useRef: moving the node into a tooltip trigger remounts it, and the effect must re-observe.
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (!node) return;

    // Sub-pixel text rounds scrollWidth up by a pixel on its own.
    const measure = () => setIsTruncated(node.scrollWidth > node.clientWidth + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, text]);

  return [setNode, isTruncated] as const;
}
