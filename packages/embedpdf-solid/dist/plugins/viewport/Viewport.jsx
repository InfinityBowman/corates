import { createMemo } from 'solid-js';
import { useViewportRef, useViewportCapability, useIsViewportGated } from './hooks';
export const Viewport = props => {
    const { setContainerRef } = useViewportRef(() => props.documentId);
    const capabilityState = useViewportCapability();
    const isGated = useIsViewportGated(() => props.documentId);
    const viewportGap = createMemo(() => {
        const provides = capabilityState.provides;
        return provides?.getViewportGap() ?? 0;
    });
    return (<div ref={setContainerRef} style={{
            width: '100%',
            height: '100%',
            overflow: 'auto',
            padding: `${viewportGap()}px`,
            ...(typeof props.style === 'string' ? {} : props.style),
        }} class={props.class}>
      {!isGated() && props.children}
    </div>);
};
//# sourceMappingURL=Viewport.jsx.map