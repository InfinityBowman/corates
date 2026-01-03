import { useCapability } from '../../../core';
import { RenderPlugin } from '@embedpdf/plugin-render';
export const useRenderCapability = () => useCapability(RenderPlugin.id);
/**
 * Hook to access render capability for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export function useRender(getDocumentId) {
    const capabilityState = useRenderCapability();
    const scopedProvides = () => {
        const provides = capabilityState.provides;
        const docId = getDocumentId();
        return provides && docId ? provides.forDocument(docId) : null;
    };
    return {
        get provides() {
            return scopedProvides();
        },
    };
}
//# sourceMappingURL=use-render.js.map