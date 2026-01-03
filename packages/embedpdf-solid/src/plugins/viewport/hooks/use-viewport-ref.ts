import { createSignal, createEffect, onCleanup } from 'solid-js';
import { useViewportPlugin } from './use-viewport';
// GateChangeEvent not needed here

/**
 * Hook to get a ref for the viewport container element with automatic setup/teardown
 * @param getDocumentId Function that returns the document ID
 */
export function useViewportRef(getDocumentId: () => string | null) {
  const pluginState = useViewportPlugin();
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(null);

  createEffect(() => {
    const plugin = pluginState.plugin;
    const container = containerRef();
    const docId = getDocumentId();

    if (!plugin || !container || !docId) return;

    // Register this viewport for the document
    try {
      plugin.registerViewport(docId);
    } catch (error) {
      console.error(`Failed to register viewport for document ${docId}:`, error);
      return;
    }

    // On scroll
    const onScroll = () => {
      plugin.setViewportScrollMetrics(docId, {
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
      });
    };
    container.addEventListener('scroll', onScroll);

    // On resize
    const resizeObserver = new ResizeObserver(() => {
      plugin.setViewportResizeMetrics(docId, {
        width: container.offsetWidth,
        height: container.offsetHeight,
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
        scrollTop: container.scrollTop,
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        scrollHeight: container.scrollHeight,
        clientLeft: container.clientLeft,
        clientTop: container.clientTop,
      });
    });
    resizeObserver.observe(container);

    // Subscribe to scroll requests for this document
    const unsubscribeScrollRequest = plugin.onScrollRequest(
      docId,
      ({ x, y, behavior = 'auto' }) => {
        requestAnimationFrame(() => {
          container.scrollTo({ left: x, top: y, behavior });
        });
      },
    );

    onCleanup(() => {
      plugin.unregisterViewport(docId);
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      unsubscribeScrollRequest();
    });
  });

  return { containerRef, setContainerRef };
}
