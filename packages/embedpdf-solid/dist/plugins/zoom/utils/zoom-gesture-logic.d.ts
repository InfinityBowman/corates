import type { ZoomCapability } from '@embedpdf/plugin-zoom';
export interface ZoomGestureOptions {
    /** Enable pinch-to-zoom gesture (default: true) */
    enablePinch?: boolean;
    /** Enable wheel zoom with ctrl/cmd key (default: true) */
    enableWheel?: boolean;
}
export interface ZoomGestureDeps {
    element: HTMLDivElement;
    /** Viewport container element for attaching events */
    container: HTMLElement;
    documentId: string;
    zoomProvides: ZoomCapability;
    /** Viewport gap in pixels (default: 0) */
    viewportGap?: number;
    options?: ZoomGestureOptions;
}
export declare function setupZoomGestures({ element, container, documentId, zoomProvides, viewportGap, options, }: ZoomGestureDeps): () => void;
//# sourceMappingURL=zoom-gesture-logic.d.ts.map