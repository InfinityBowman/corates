import { createContext, useContext } from 'solid-js';
const defaultContextState = {
    registry: null,
    coreState: null,
    isInitializing: true,
    pluginsReady: false,
    activeDocumentId: null,
    activeDocument: null,
    documents: {},
    documentStates: [],
};
export const PDFContext = createContext(defaultContextState);
export function usePDFContext() {
    const context = useContext(PDFContext);
    if (!context) {
        throw new Error('usePDFContext must be used inside <EmbedPDF>');
    }
    return context;
}
//# sourceMappingURL=context.js.map