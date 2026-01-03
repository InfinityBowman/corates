import { type Logger, type PdfEngine } from '@embedpdf/models';
import type { FontFallbackConfig } from '@embedpdf/engines';
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
export declare function createPdfiumEngine(options?: CreatePdfiumEngineOptions): {
    readonly engine: PdfEngine<Blob> | null;
    readonly isLoading: boolean;
    readonly error: Error | null;
};
//# sourceMappingURL=create-pdfium-engine.d.ts.map