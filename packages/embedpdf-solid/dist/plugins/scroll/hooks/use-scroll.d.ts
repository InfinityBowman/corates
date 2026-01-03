import type { ScrollScope } from '@embedpdf/plugin-scroll';
export declare const useScrollCapability: () => {
    readonly provides: Readonly<import("@embedpdf/plugin-scroll").ScrollCapability> | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
export interface UseScrollReturn {
    provides: ScrollScope | null;
    state: {
        currentPage: number;
        totalPages: number;
    };
}
/**
 * Hook for scroll state for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export declare function useScroll(getDocumentId: () => string | null): UseScrollReturn;
//# sourceMappingURL=use-scroll.d.ts.map