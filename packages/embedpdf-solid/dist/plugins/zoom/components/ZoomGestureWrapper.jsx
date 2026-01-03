import { createRenderEffect, onCleanup, createSignal } from 'solid-js';
import { useZoomCapability } from '../hooks/use-zoom';
import { useViewportElement } from '../../viewport';
import { useViewportCapability } from '../../viewport/hooks/use-viewport';
import { setupZoomGestures } from '../utils/zoom-gesture-logic';
/**
 * Wrapper component that enables zoom gestures (wheel and pinch) on its children
 * Must be used inside a Viewport component
 */
export const ZoomGestureWrapper = props => {
    const zoomCapability = useZoomCapability();
    const viewportCapability = useViewportCapability();
    const [elementRef, setElementRef] = createSignal();
    let viewportElement = null;
    try {
        viewportElement = useViewportElement();
    }
    catch {
        // Not inside Viewport - zoom gestures won't work
        return <>{props.children}</>;
    }
    const options = {
        enablePinch: props.enablePinch ?? true,
        enableWheel: props.enableWheel ?? true,
    };
    createRenderEffect(() => {
        // Wait for zoom capability to be ready
        if (zoomCapability.isLoading) {
            return;
        }
        const element = elementRef();
        const container = viewportElement?.current;
        const zoomProvides = zoomCapability.provides;
        const viewportProvides = viewportCapability.provides;
        if (!element || !container || !zoomProvides) {
            return;
        }
        // Ensure element is connected to DOM
        if (!element.isConnected) {
            return;
        }
        const cleanup = setupZoomGestures({
            element,
            container,
            documentId: props.documentId,
            zoomProvides,
            viewportGap: viewportProvides?.getViewportGap() || 0,
            options,
        });
        onCleanup(() => {
            cleanup();
        });
    });
    return (<div ref={setElementRef} class={props.class} style={{
            display: 'inline-block',
            overflow: 'visible',
            'box-sizing': 'border-box',
            ...(typeof props.style === 'string' ? {} : props.style),
        }}>
      {props.children}
    </div>);
};
//# sourceMappingURL=ZoomGestureWrapper.jsx.map