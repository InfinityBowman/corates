import { createSignal, createEffect, onCleanup } from 'solid-js';
import { useViewportCapability } from './use-viewport';
/**
 * Hook to get the gated state of the viewport for a specific document.
 * The viewport children are not rendered when gated.
 * @param getDocumentId Function that returns the document ID
 */
export function useIsViewportGated(getDocumentId) {
    const capabilityState = useViewportCapability();
    const [isGated, setIsGated] = createSignal(false);
    createEffect(() => {
        const provides = capabilityState.provides;
        const docId = getDocumentId();
        if (!provides || !docId) {
            setIsGated(false);
            return;
        }
        // Set initial state
        setIsGated(provides.isGated(docId));
        // Subscribe to gate state changes
        const unsubscribe = provides.onGateChange((event) => {
            if (event.documentId === docId) {
                setIsGated(event.isGated);
            }
        });
        onCleanup(() => {
            unsubscribe();
        });
    });
    return isGated;
}
//# sourceMappingURL=use-viewport-gated.js.map