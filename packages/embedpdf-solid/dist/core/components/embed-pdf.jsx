import { createSignal, onMount, onCleanup, createMemo, Show, } from 'solid-js';
import { PluginRegistry, } from '@embedpdf/core';
import { PDFContext } from '../context';
import { AutoMount } from './auto-mount';
// PDFContextState is exported from context.ts
export const EmbedPDF = props => {
    const [registry, setRegistry] = createSignal(null);
    const [coreState, setCoreState] = createSignal(null);
    const [isInitializing, setIsInitializing] = createSignal(true);
    const [pluginsReady, setPluginsReady] = createSignal(false);
    let unsubscribe;
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
    const contextValue = createMemo(() => {
        const currentCoreState = coreState();
        const activeDocumentId = currentCoreState?.activeDocumentId ?? null;
        const documents = currentCoreState?.documents ?? {};
        const documentOrder = currentCoreState?.documentOrder ?? [];
        // Compute active document
        const activeDocument = activeDocumentId && documents[activeDocumentId] ? documents[activeDocumentId] : null;
        // Compute open documents in order
        const documentStates = documentOrder
            .map(docId => documents[docId])
            .filter((doc) => doc !== null && doc !== undefined);
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
    return (<PDFContext.Provider value={contextValue()}>
      <Show when={pluginsReady() && props.autoMountDomElements !== false} fallback={typeof props.children === 'function' ? props.children(contextValue()) : props.children}>
        <AutoMount plugins={props.plugins}>
          {typeof props.children === 'function' ? props.children(contextValue()) : props.children}
        </AutoMount>
      </Show>
    </PDFContext.Provider>);
};
//# sourceMappingURL=embed-pdf.jsx.map