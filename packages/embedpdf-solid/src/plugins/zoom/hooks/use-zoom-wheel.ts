import { createEffect, onCleanup } from 'solid-js';
import { useZoomCapability } from './use-zoom';
import { useViewportElement } from '../../viewport';

export interface ZoomWheelOptions {
  /** Zoom step per wheel delta (default: 0.1) */
  step?: number;
  /** Enable wheel zoom (default: true) */
  enableWheel?: boolean;
}

/**
 * Hook to enable Ctrl/Cmd+wheel zoom on the viewport
 * Must be used inside a Viewport component to access viewport element context
 * @param getDocumentId Function that returns the document ID
 * @param options Configuration options
 */
export function useZoomWheel(getDocumentId: () => string | null, options: ZoomWheelOptions = {}) {
  const { step = 0.1, enableWheel = true } = options;
  const zoomCapability = useZoomCapability();
  let viewportElement: ReturnType<typeof useViewportElement> | null = null;

  try {
    viewportElement = useViewportElement();
  } catch {
    // Not inside Viewport - wheel zoom won't work
    return;
  }

  createEffect(() => {
    if (!enableWheel || typeof window === 'undefined') return;

    // Check if zoom capability is ready first
    if (zoomCapability.isLoading) {
      return;
    }

    const zoomProvides = zoomCapability.provides;
    const container = viewportElement?.current;
    const docId = getDocumentId();

    // Wait for all dependencies to be ready
    if (!zoomProvides || !container || !docId) {
      return;
    }

    // Ensure container is in the DOM
    if (!container.isConnected) {
      return;
    }

    const zoomScope = zoomProvides.forDocument(docId);

    // Throttle wheel events to avoid excessive zoom updates
    let wheelZoomTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastZoomTime = 0;
    const ZOOM_THROTTLE_MS = 16; // ~60fps

    const handleWheel = (e: WheelEvent) => {
      // Only handle wheel zoom when Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      if (!e.ctrlKey && !e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastZoomTime < ZOOM_THROTTLE_MS) {
        return;
      }
      lastZoomTime = now;

      // Get viewport bounding rect for coordinate calculation
      const containerRect = container.getBoundingClientRect();

      // Calculate viewport-relative coordinates (vx, vy)
      // vx and vy are relative to the viewport's client area
      const vx = e.clientX - containerRect.left;
      const vy = e.clientY - containerRect.top;

      // Calculate zoom delta from wheel delta
      // Negative deltaY (scroll up) means zoom in, positive (scroll down) means zoom out
      // Scale: 0.01 per pixel gives reasonable zoom speed
      const zoomDelta = -e.deltaY * 0.01 * step;

      try {
        zoomScope.requestZoomBy(zoomDelta, { vx, vy });
      } catch (error) {
        console.error('Zoom wheel error:', error);
      }
    };

    // Attach to the container element
    container.addEventListener('wheel', handleWheel, { passive: false });

    onCleanup(() => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelZoomTimeout) {
        clearTimeout(wheelZoomTimeout);
        wheelZoomTimeout = null;
      }
    });
  });
}
