import { createSignal, createEffect, createMemo, onCleanup } from 'solid-js';
import { useCapability, usePlugin } from '../../../core';
import { ZoomPlugin, type ZoomDocumentState, initialDocumentState } from '@embedpdf/plugin-zoom';

export const useZoomCapability = () => useCapability<ZoomPlugin>(ZoomPlugin.id);
export const useZoomPlugin = () => usePlugin<ZoomPlugin>(ZoomPlugin.id);

/**
 * Hook for zoom state for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export function useZoom(getDocumentId: () => string | null) {
  const capabilityState = useZoomCapability();
  const [state, setState] = createSignal<ZoomDocumentState>(initialDocumentState);

  // Reactive documentId
  const documentId = createMemo(() => getDocumentId());

  createEffect(() => {
    const provides = capabilityState.provides;
    const docId = documentId();

    if (!provides || !docId) {
      setState(initialDocumentState);
      return;
    }

    const scope = provides.forDocument(docId);

    // Get initial state
    setState(scope.getState());

    // Subscribe to state changes
    const unsubscribe = scope.onStateChange((newState: ZoomDocumentState) => {
      setState(newState);
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  // Create memo for provides to ensure reactivity
  const zoomScope = createMemo(() => {
    const provides = capabilityState.provides;
    const docId = documentId();
    return provides && docId ? provides.forDocument(docId) : null;
  });

  return {
    state,
    provides: zoomScope,
  };
}
