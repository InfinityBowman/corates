import type { RenderScope } from '@embedpdf/plugin-render';
export declare const useRenderCapability: () => {
    readonly provides: Readonly<import("@embedpdf/plugin-render").RenderCapability> | null;
    readonly isLoading: boolean;
    readonly ready: Promise<void>;
};
export interface UseRenderReturn {
    provides: RenderScope | null;
}
/**
 * Hook to access render capability for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export declare function useRender(getDocumentId: () => string | null): UseRenderReturn;
//# sourceMappingURL=use-render.d.ts.map