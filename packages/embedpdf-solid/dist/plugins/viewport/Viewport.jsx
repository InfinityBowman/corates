import { createMemo } from 'solid-js';
import { useViewportRef, useViewportCapability, useIsViewportGated } from './hooks';
import { ViewportElementProvider } from './context';
export const Viewport = props => {
    const viewportRef = useViewportRef(() => props.documentId);
    const capabilityState = useViewportCapability();
    const isGated = useIsViewportGated(() => props.documentId);
    const viewportGap = createMemo(() => {
        const provides = capabilityState.provides;
        return provides?.getViewportGap() ?? 0;
    });
    // Provide the viewport element to child components via context
    const viewportElementContext = {
        get current() {
            return viewportRef.containerRef;
        },
    };
    return (<ViewportElementProvider value={viewportElementContext}>
      <div ref={viewportRef.setContainerRef} style={{
            width: '100%',
            height: '100%',
            overflow: 'auto',
            padding: `${viewportGap()}px`,
            ...(typeof props.style === 'string' ? {} : props.style),
        }} class={props.class}>
        {!isGated() && props.children}
      </div>
    </ViewportElementProvider>);
};
//# sourceMappingURL=Viewport.jsx.map