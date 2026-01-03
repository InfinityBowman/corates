import { createSignal, createEffect, createMemo } from 'solid-js';
import { useCapability, usePlugin } from '../../../core';
import { ViewportPlugin, type ScrollActivity } from '@embedpdf/plugin-viewport';

export const useViewportPlugin = () => usePlugin<ViewportPlugin>(ViewportPlugin.id);
export const useViewportCapability = () => useCapability<ViewportPlugin>(ViewportPlugin.id);

/**
 * Hook to get scroll activity for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export function useViewportScrollActivity(getDocumentId: () => string | null) {
  const capability = useViewportCapability();
  const [scrollActivity, setScrollActivity] = createSignal<ScrollActivity>({
    isScrolling: false,
    isSmoothScrolling: false,
  });

  // Reactive documentId
  const documentId = createMemo(() => getDocumentId());

  createEffect(() => {
    const provides = capability.provides;
    const docId = documentId();

    if (!provides || !docId) {
      setScrollActivity({
        isScrolling: false,
        isSmoothScrolling: false,
      });
      return;
    }

    // Subscribe to scroll activity events
    const unsubscribe = provides.onScrollActivity(event => {
      // Filter by documentId
      if (event.documentId === docId) {
        setScrollActivity(event.activity);
      }
    });

    return unsubscribe;
  });

  return {
    get current() {
      return scrollActivity();
    },
  };
}
