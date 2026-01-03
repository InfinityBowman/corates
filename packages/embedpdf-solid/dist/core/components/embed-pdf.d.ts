import { type Component, type JSX } from 'solid-js';
import { PluginRegistry, type PluginBatchRegistrations } from '@embedpdf/core';
import { type Logger, type PdfEngine } from '@embedpdf/models';
import { type PDFContextState } from '../context';
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
export declare const EmbedPDF: Component<EmbedPDFProps>;
//# sourceMappingURL=embed-pdf.d.ts.map