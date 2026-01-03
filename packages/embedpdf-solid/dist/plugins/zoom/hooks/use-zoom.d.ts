import { ZoomPlugin, type ZoomDocumentState } from '@embedpdf/plugin-zoom';
export declare const useZoomCapability: () => {
    readonly provides: Readonly<import("@embedpdf/plugin-zoom").ZoomCapability> | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
export declare const useZoomPlugin: () => {
    readonly plugin: ZoomPlugin | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
/**
 * Hook for zoom state for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export declare function useZoom(getDocumentId: () => string | null): {
    state: import("solid-js").Accessor<ZoomDocumentState>;
    provides: import("solid-js").Accessor<import("@embedpdf/plugin-zoom").ZoomScope | null>;
};
//# sourceMappingURL=use-zoom.d.ts.map