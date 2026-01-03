import { type Component, type JSX } from 'solid-js';
export interface ZoomGestureWrapperProps {
    children: JSX.Element;
    documentId: string;
    class?: string;
    style?: string | JSX.CSSProperties;
    /** Enable pinch-to-zoom gesture (default: true) */
    enablePinch?: boolean;
    /** Enable wheel zoom with ctrl/cmd key (default: true) */
    enableWheel?: boolean;
}
/**
 * Wrapper component that enables zoom gestures (wheel and pinch) on its children
 * Must be used inside a Viewport component
 */
export declare const ZoomGestureWrapper: Component<ZoomGestureWrapperProps>;
//# sourceMappingURL=ZoomGestureWrapper.d.ts.map