import { type Component, type JSX } from 'solid-js';
export interface ViewportProps {
    /**
     * The ID of the document that this viewport displays
     */
    documentId: string;
    children: JSX.Element;
    class?: string;
    style?: string | JSX.CSSProperties;
}
export declare const Viewport: Component<ViewportProps>;
//# sourceMappingURL=Viewport.d.ts.map