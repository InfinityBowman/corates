import { createSignal, createEffect, onCleanup, createMemo, Show, } from 'solid-js';
import { PluginRegistry, } from '@embedpdf/core';
import { PDFContext } from '../context';
import { AutoMount } from './auto-mount';
// PDFContextState is exported from context.ts
export const EmbedPDF = props => {
    const [registry, setRegistry] = createSignal(null);
    const [coreState, setCoreState] = createSignal(null);
    const [isInitializing, setIsInitializing] = createSignal(true);
    const [pluginsReady, setPluginsReady] = createSignal(false);
    // Track latest onInitialized callback
    let latestInit = props.onInitialized;
    createEffect(() => {
        if (props.onInitialized) {
            latestInit = props.onInitialized;
        }
    });
    createEffect(() => {
        const engine = props.engine;
        const plugins = props.plugins;
        const logger = props.logger;
        if (!engine) {
            return;
        }
        const pdfViewer = new PluginRegistry(engine, { logger });
        pdfViewer.registerPluginBatch(plugins);
        const initialize = async () => {
            await pdfViewer.initialize();
            if (pdfViewer.isDestroyed()) {
                return;
            }
            const store = pdfViewer.getStore();
            setCoreState(store.getState().core);
            const unsubscribe = store.subscribe((_action, newState, oldState) => {
                // Only update if it's a core action and the core state changed
                if (store.isCoreAction(_action) && newState.core !== oldState.core) {
                    setCoreState(newState.core);
                }
            });
            // Always call the latest callback
            await latestInit?.(pdfViewer);
            if (pdfViewer.isDestroyed()) {
                unsubscribe();
                return;
            }
            pdfViewer.pluginsReady().then(() => {
                if (!pdfViewer.isDestroyed()) {
                    setPluginsReady(true);
                }
            });
            setRegistry(pdfViewer);
            setIsInitializing(false);
            return unsubscribe;
        };
        let cleanup;
        initialize()
            .then(unsub => {
            cleanup = unsub;
        })
            .catch(console.error);
        onCleanup(() => {
            cleanup?.();
            pdfViewer.destroy();
            setRegistry(null);
            setCoreState(null);
            setIsInitializing(true);
            setPluginsReady(false);
        });
    });
    // Compute convenience accessors with individual memos for fine-grained reactivity
    const activeDocumentId = createMemo(() => coreState()?.activeDocumentId ?? null);
    const documents = createMemo(() => coreState()?.documents ?? {});
    const documentOrder = createMemo(() => coreState()?.documentOrder ?? []);
    const activeDocument = createMemo(() => {
        const docId = activeDocumentId();
        const docs = documents();
        return docId && docs[docId] ? docs[docId] : null;
    });
    const documentStates = createMemo(() => documentOrder()
        .map(docId => documents()[docId])
        .filter((doc) => doc !== null && doc !== undefined));
    // Create a reactive context value object with getters
    // This ensures consumers can access current values reactively
    const contextValue = {
        get registry() {
            return registry();
        },
        get coreState() {
            return coreState();
        },
        get isInitializing() {
            return isInitializing();
        },
        get pluginsReady() {
            return pluginsReady();
        },
        get activeDocumentId() {
            return activeDocumentId();
        },
        get activeDocument() {
            return activeDocument();
        },
        get documents() {
            return documents();
        },
        get documentStates() {
            return documentStates();
        },
    };
    // For render prop children, create a snapshot function
    const getContextSnapshot = () => ({
        registry: registry(),
        coreState: coreState(),
        isInitializing: isInitializing(),
        pluginsReady: pluginsReady(),
        activeDocumentId: activeDocumentId(),
        activeDocument: activeDocument(),
        documents: documents(),
        documentStates: documentStates(),
    });
    return (<PDFContext.Provider value={contextValue}>
      <Show when={pluginsReady() && props.autoMountDomElements !== false} fallback={typeof props.children === 'function' ? props.children(getContextSnapshot()) : props.children}>
        <AutoMount plugins={props.plugins}>
          {typeof props.children === 'function' ? props.children(getContextSnapshot()) : props.children}
        </AutoMount>
      </Show>
    </PDFContext.Provider>);
};
//# sourceMappingURL=embed-pdf.jsx.map