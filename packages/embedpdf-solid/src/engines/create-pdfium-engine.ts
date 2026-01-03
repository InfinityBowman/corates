import { createSignal, createEffect, onCleanup } from 'solid-js';
import { ignore, type Logger, type PdfEngine } from '@embedpdf/models';
import type { FontFallbackConfig } from '@embedpdf/engines';

const defaultWasmUrl =
  'https://cdn.jsdelivr.net/npm/@embedpdf/pdfium@2.1.1/dist/pdfium.wasm';

export interface CreatePdfiumEngineOptions {
  wasmUrl?: string;
  worker?: boolean;
  logger?: Logger;
  /**
   * Font fallback configuration for handling missing fonts in PDFs.
   */
  fontFallback?: FontFallbackConfig;
}

/**
 * Creates a Solid hook for the PDFium engine.
 * @param options Configuration options for the engine
 * @returns State object with engine, isLoading, and error
 */
export function createPdfiumEngine(options?: CreatePdfiumEngineOptions) {
  const { wasmUrl = defaultWasmUrl, worker = true, logger, fontFallback } = options ?? {};

  const [engine, setEngine] = createSignal<PdfEngine | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<Error | null>(null);

  let engineRef: PdfEngine | null = null;

  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    createEffect(() => {
      let cancelled = false;

      (async () => {
        try {
          const { createPdfiumEngine } =
            worker ?
              await import('@embedpdf/engines/pdfium-worker-engine')
            : await import('@embedpdf/engines/pdfium-direct-engine');

          const pdfEngine = await createPdfiumEngine(wasmUrl, { logger, fontFallback });
          engineRef = pdfEngine;
          if (!cancelled) {
            setEngine(pdfEngine);
            setIsLoading(false);
          }
        } catch (e) {
          if (!cancelled) {
            setError(e as Error);
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
