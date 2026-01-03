import { type Component, type JSX } from 'solid-js';
import type { DocumentState } from '@embedpdf/core';
export interface DocumentContentRenderProps {
    documentState: DocumentState;
    isLoading: boolean;
    isError: boolean;
    isLoaded: boolean;
}
export interface DocumentContentProps {
    documentId: string | null;
    children: (_props: DocumentContentRenderProps) => JSX.Element;
}
/**
 * Headless component for rendering document content with loading/error states
 */
export declare const DocumentContent: Component<DocumentContentProps>;
//# sourceMappingURL=DocumentContent.d.ts.map