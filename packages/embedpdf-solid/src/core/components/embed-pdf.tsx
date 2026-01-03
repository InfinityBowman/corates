import {
  createSignal,
  onMount,
  onCleanup,
  createMemo,
  Show,
  type Component,
  type JSX,
} from 'solid-js';
import {
  PluginRegistry,
  type PluginBatchRegistrations,
  type CoreState,
  type DocumentState,
} from '@embedpdf/core';
import { type Logger, type PdfEngine } from '@embedpdf/models';
import { PDFContext, type PDFContextState } from '../context';
import { AutoMount } from './auto-mount';

export interface EmbedPDFProps {
  /**
   * The PDF engine to use for the PDF viewer.
   */
  engine: PdfEngine;
  /**
   * The logger to use for the PDF viewer.
   */
  logger?: Logger;
  /**
   * The callback to call when the PDF viewer is initialized.
   */
  onInitialized?: (_registry: PluginRegistry) => Promise<void>;
  /**
   * The plugins to use for the PDF viewer.
   */
  plugins: PluginBatchRegistrations;
  /**
   * The children to render for the PDF viewer.
   */
  children: JSX.Element | ((_state: PDFContextState) => JSX.Element);
  /**
   * Whether to auto-mount specific non-visual DOM elements from plugins.
   * @default true
   */
  autoMountDomElements?: boolean;
}

// PDFContextState is exported from context.ts

export const EmbedPDF: Component<EmbedPDFProps> = props => {
  const [registry, setRegistry] = createSignal<PluginRegistry | null>(null);
  const [coreState, setCoreState] = createSignal<CoreState | null>(null);
  const [isInitializing, setIsInitializing] = createSignal(true);
  const [pluginsReady, setPluginsReady] = createSignal(false);

  let unsubscribe: (() => void) | undefined;

  onMount(() => {
    const pdfViewer = new PluginRegistry(props.engine, { logger: props.logger });
    pdfViewer.registerPluginBatch(props.plugins);

    const initialize = async () => {
      await pdfViewer.initialize();

      if (pdfViewer.isDestroyed()) {
        return;
      }

      const store = pdfViewer.getStore();
      setCoreState(store.getState().core);

      unsubscribe = store.subscribe((_action, newState, oldState) => {
        // Only update if it's a core action and the core state changed
        if (store.isCoreAction(_action) && newState.core !== oldState.core) {
          setCoreState(newState.core);
        }
      });

      await props.onInitialized?.(pdfViewer);

      if (pdfViewer.isDestroyed()) {
        unsubscribe?.();
        return;
      }

      pdfViewer.pluginsReady().then(() => {
        if (!pdfViewer.isDestroyed()) {
          setPluginsReady(true);
        }
      });

      setRegistry(pdfViewer);
      setIsInitializing(false);
    };

    initialize().catch(console.error);

    onCleanup(() => {
      unsubscribe?.();
      pdfViewer.destroy();
      setRegistry(null);
      setCoreState(null);
      setIsInitializing(true);
      setPluginsReady(false);
    });
  });

  // Compute convenience accessors
  const contextValue = createMemo((): PDFContextState => {
    const currentCoreState = coreState();
    const activeDocumentId = currentCoreState?.activeDocumentId ?? null;
    const documents = currentCoreState?.documents ?? {};
    const documentOrder = currentCoreState?.documentOrder ?? [];

    // Compute active document
    const activeDocument =
      activeDocumentId && documents[activeDocumentId] ? documents[activeDocumentId] : null;

    // Compute open documents in order
    const documentStates = documentOrder
      .map(docId => documents[docId])
      .filter((doc): doc is DocumentState => doc !== null && doc !== undefined) as DocumentState[];

    return {
      registry: registry(),
      coreState: currentCoreState,
      isInitializing: isInitializing(),
      pluginsReady: pluginsReady(),
      activeDocumentId,
      activeDocument,
      documents,
      documentStates,
    };
  });

  return (
    <PDFContext.Provider value={contextValue()}>
      <Show
        when={pluginsReady() && props.autoMountDomElements !== false}
        fallback={
          typeof props.children === 'function' ? props.children(contextValue()) : props.children
        }
      >
        <AutoMount plugins={props.plugins}>
          {typeof props.children === 'function' ? props.children(contextValue()) : props.children}
        </AutoMount>
      </Show>
    </PDFContext.Provider>
  );
};
