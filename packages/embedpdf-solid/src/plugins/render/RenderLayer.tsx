import {
  createSignal,
  createEffect,
  onCleanup,
  createMemo,
  Show,
  type Component,
  type JSX,
} from 'solid-js';
import { ignore, PdfErrorCode } from '@embedpdf/models';
import { useDocumentState } from '../../core';
import { useRenderCapability } from './hooks/use-render';

export interface RenderLayerProps {
  /**
   * The ID of the document to render from
   */
  documentId: string;
  /**
   * The page index to render (0-based)
   */
  pageIndex: number;
  /**
   * Optional scale override. If not provided, uses document's current scale.
   */
  scale?: number;
  /**
   * Optional device pixel ratio override. If not provided, uses window.devicePixelRatio.
   */
  dpr?: number;
  class?: string;
  style?: string | JSX.CSSProperties;
}

export const RenderLayer: Component<RenderLayerProps> = props => {
  // Use memo to track pageIndex changes reactively
  const pageIndex = createMemo(() => props.pageIndex);
  const renderCapabilityState = useRenderCapability();
  const documentStateRef = useDocumentState(() => props.documentId);
  const [imageUrl, setImageUrl] = createSignal<string | null>(null);
  let urlRef: string | null = null;

  // Cleanup on component unmount
  onCleanup(() => {
    if (urlRef) {
      URL.revokeObjectURL(urlRef);
      urlRef = null;
    }
  });

  // Track page refreshes from core
  const refreshVersion = createMemo(
    () => documentStateRef.current?.pageRefreshVersions?.[pageIndex()] ?? 0,
  );

  // Resolve actual scale / dpr (overrides win, otherwise follow document state)
  const actualScale = createMemo(() =>
    props.scale !== undefined ? props.scale : (documentStateRef.current?.scale ?? 1),
  );

  const actualDpr = createMemo(() =>
    props.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1),
  );

  // Effect: reruns when dependencies change
  createEffect(() => {
    const provides = renderCapabilityState.provides;
    const docId = props.documentId;
    const scale = actualScale();
    const dpr = actualDpr();
    // Track refreshVersion to trigger re-renders
    void refreshVersion();
    const page = pageIndex();

    if (!provides || !docId) {
      // Cleanup if no capability/doc
      if (urlRef) {
        URL.revokeObjectURL(urlRef);
        urlRef = null;
      }
      setImageUrl(null);
      return;
    }

    const scoped = provides.forDocument(docId);

    const task = scoped.renderPage({
      pageIndex: page,
      options: {
        scaleFactor: scale,
        dpr,
      },
    });

    task.wait(blob => {
      const url = URL.createObjectURL(blob);

      // Revoke previous URL if it existed
      if (urlRef) {
        URL.revokeObjectURL(urlRef);
      }

      urlRef = url;
      setImageUrl(url);
    }, ignore);

    onCleanup(() => {
      // Only abort the task if it hasn't completed yet
      // Don't clear imageUrl - let the new render replace it to avoid flashing
      if (!urlRef) {
        task.abort({
          code: PdfErrorCode.Cancelled,
          message: 'canceled render task',
        });
      }
      // Note: We intentionally don't revoke urlRef here or clear imageUrl
      // The new effect run will handle cleanup when setting the new URL
      // This prevents flashing between page renders
    });
  });

  function handleImageLoad() {
    // Once image is loaded, we can drop the objectURL reference
    if (urlRef) {
      URL.revokeObjectURL(urlRef);
      urlRef = null;
    }
  }

  return (
    <Show when={imageUrl()}>
      {url => (
        <img
          src={url()}
          onLoad={handleImageLoad}
          style={{
            width: '100%',
            height: '100%',
            ...(typeof props.style === 'string' ? {} : props.style),
          }}
          class={props.class}
          alt=''
        />
      )}
    </Show>
  );
};
