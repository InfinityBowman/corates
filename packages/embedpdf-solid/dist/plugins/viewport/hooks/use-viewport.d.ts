import { ViewportPlugin, type ScrollActivity } from '@embedpdf/plugin-viewport';
export declare const useViewportPlugin: () => {
    readonly plugin: ViewportPlugin | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
export declare const useViewportCapability: () => {
    readonly provides: Readonly<import("@embedpdf/plugin-viewport").ViewportCapability> | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
/**
 * Hook to get scroll activity for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export declare function useViewportScrollActivity(getDocumentId: () => string | null): {
    readonly current: ScrollActivity;
};
//# sourceMappingURL=use-viewport.d.ts.map