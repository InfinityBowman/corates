import type { CoreState, DocumentState, PluginRegistry } from '@embedpdf/core';
export interface PDFContextState {
    registry: PluginRegistry | null;
    coreState: CoreState | null;
    isInitializing: boolean;
    pluginsReady: boolean;
    activeDocumentId: string | null;
    activeDocument: DocumentState | null;
    documents: Record<string, DocumentState>;
    documentStates: DocumentState[];
}
export declare const PDFContext: import("solid-js").Context<PDFContextState>;
export declare function usePDFContext(): PDFContextState;
//# sourceMappingURL=context.d.ts.map