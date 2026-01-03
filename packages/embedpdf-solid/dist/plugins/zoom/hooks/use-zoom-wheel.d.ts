export interface ZoomWheelOptions {
    /** Zoom step per wheel delta (default: 0.1) */
    step?: number;
    /** Enable wheel zoom (default: true) */
    enableWheel?: boolean;
}
/**
 * Hook to enable Ctrl/Cmd+wheel zoom on the viewport
 * Must be used inside a Viewport component to access viewport element context
 * @param getDocumentId Function that returns the document ID
 * @param options Configuration options
 */
export declare function useZoomWheel(getDocumentId: () => string | null, options?: ZoomWheelOptions): void;
//# sourceMappingURL=use-zoom-wheel.d.ts.map