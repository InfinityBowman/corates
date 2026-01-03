import { useCapability } from '../../../core';
import { RenderPlugin } from '@embedpdf/plugin-render';
import type { RenderScope } from '@embedpdf/plugin-render';

export const useRenderCapability = () => useCapability<RenderPlugin>(RenderPlugin.id);

export interface UseRenderReturn {
  provides: RenderScope | null;
}

/**
 * Hook to access render capability for a specific document
 * @param getDocumentId Function that returns the document ID
 */
export function useRender(getDocumentId: () => string | null): UseRenderReturn {
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
