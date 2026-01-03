import { type Component, type JSX } from 'solid-js';
export interface RenderLayerProps {
    /**
     * The ID of the document to render from
     */
    documentId: string;
    /**
     * The page index to render (0-based)
     */
    pageIndex: number;
    /**
     * Optional scale override. If not provided, uses document's current scale.
     */
    scale?: number;
    /**
     * Optional device pixel ratio override. If not provided, uses window.devicePixelRatio.
     */
    dpr?: number;
    class?: string;
    style?: string | JSX.CSSProperties;
}
export declare const RenderLayer: Component<RenderLayerProps>;
//# sourceMappingURL=RenderLayer.d.ts.map