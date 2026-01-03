import { createSignal, createEffect, onCleanup } from 'solid-js';
import { ignore } from '@embedpdf/models';
const defaultWasmUrl = 'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.1.1/dist/pdfium.wasm';
/**
 * Creates a Solid hook for the PDFium engine.
 * @param options Configuration options for the engine
 * @returns State object with engine, isLoading, and error
 */
export function createPdfiumEngine(options) {
    const { wasmUrl = defaultWasmUrl, worker = true, logger, fontFallback } = options ?? {};
    const [engine, setEngine] = createSignal(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal(null);
    let engineRef = null;
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser) {
        createEffect(() => {
            let cancelled = false;
            (async () => {
                try {
                    const { createPdfiumEngine } = worker ?
                        await import('@embedpdf/engines/pdfium-worker-engine')
                        : await import('@embedpdf/engines/pdfium-direct-engine');
                    const pdfEngine = await createPdfiumEngine(wasmUrl, { logger, fontFallback });
                    engineRef = pdfEngine;
                    if (!cancelled) {
                        setEngine(pdfEngine);
                        setIsLoading(false);
                    }
                }
                catch (e) {
                    if (!cancelled) {
                        setError(e);
                        setIsLoading(false);
                    }
                }
            })();
            onCleanup(() => {
                cancelled = true;
                engineRef?.closeAllDocuments?.().wait(() => {
                    engineRef?.destroy?.();
                    engineRef = null;
                }, ignore);
            });
        });
    }
    return {
        get engine() {
            return engine();
        },
        get isLoading() {
            return isLoading();
        },
        get error() {
            return error();
        },
    };
}
//# sourceMappingURL=create-pdfium-engine.js.map